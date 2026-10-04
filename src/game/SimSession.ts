import * as Cesium from "cesium";
import { createENUFrame, enuToEcef } from "../world/CoordUtils";
import { buildGoogleMapsUrl } from "./mapsUrl";
import { CesiumManager } from "../world/CesiumManager";
import { TileLoader } from "../world/TileLoader";
import { TerrainSampler } from "../world/TerrainSampler";
import { GameLoop } from "./GameLoop";
import { RenderDiagnostics } from "./RenderDiagnostics";
import { DroneAudio } from "./DroneAudio";
import { FlightRecorder } from './FlightRecorder';
import { createRecordingFrameSource } from '../world/RecordingFrameSource';
import { useStore } from "../store";
import type { SavedLocation } from "../store/settingsSlice";

export interface SpawnOrigin {
  longitude: number;
  latitude: number;
  terrainHeight: number;
  name: string;
}

export class SimSession {
  private cesiumManager: CesiumManager;
  private tileLoader: TileLoader;
  private gameLoop: GameLoop | null = null;
  private spawnOrigin: SpawnOrigin | null = null;
  private isStarting = false;
  private renderDiagnostics: RenderDiagnostics | null = null;
  private droneAudio = new DroneAudio();
  private flightRecorder: FlightRecorder;
  private exitPromise: Promise<void> | null = null;
  private disposed = false;
  private sessionGeneration = 0;

  constructor(cesiumManager: CesiumManager) {
    this.cesiumManager = cesiumManager;
    this.tileLoader = new TileLoader();
    this.flightRecorder = new FlightRecorder({
      createFrameSource: () => createRecordingFrameSource(this.cesiumManager.getViewer()),
      createAudioSource: () => this.droneAudio.createRecordingSource(),
      publish: snapshot => useStore.getState().setRecording(snapshot),
    });
  }

  setDiagnosticsEnabled(enabled: boolean): void {
    if (enabled) {
      this.renderDiagnostics ??= new RenderDiagnostics(
        this.cesiumManager.getViewer(), this.tileLoader,
        snapshot => useStore.getState().updateRenderDiagnostics(snapshot),
      );
      this.renderDiagnostics.start();
    } else {
      this.renderDiagnostics?.stop();
      useStore.getState().updateRenderDiagnostics(null);
    }
  }

  setCacheOnlyPractice(enabled: boolean): void {
    this.tileLoader.setCacheOnlyPractice(enabled);
    useStore.getState().setCacheOnlyPractice(enabled);
  }

  async startSession(
    location: { lon: number; lat: number; name: string },
  ): Promise<void> {
    if (this.disposed || this.isStarting || this.exitPromise) return;
    const generation = ++this.sessionGeneration;
    this.droneAudio.unlock();
    this.setCacheOnlyPractice(false);
    this.isStarting = true;
    try {
    const viewer = this.cesiumManager.getViewer();

    await this.tileLoader.loadPhotorealisticTiles(viewer);
    if (generation !== this.sessionGeneration) return;

    // Get rough elevation for initial camera placement (may be orthometric from Google API)
    const roughTerrainHeight = await this.resolveTerrainHeight(
      viewer,
      location.lat,
      location.lon,
    );
    if (generation !== this.sessionGeneration) return;

    // Show Cesium container
    this.cesiumManager.showContainer();

    // Position camera temporarily so globe terrain loads around the spawn point.
    // Use a generous altitude buffer (500m) above the rough estimate to absorb
    // geoid-ellipsoid offset (up to ~100m) — the Google Elevation API returns
    // orthometric heights but Cesium.Cartesian3.fromDegrees expects WGS84.
    const store = useStore.getState();
    const spawnAlt = store.physicsConfig.spawnAltitude;
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        location.lon,
        location.lat,
        roughTerrainHeight + 500,
      ),
      orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0 },
    });
    this.tileLoader.prepareForNewLocation();
    await this.tileLoader.waitForViewRefinement();
    if (generation !== this.sessionGeneration) return;

    // After tiles/globe have loaded, query WGS84 ellipsoidal height from the globe.
    // This is consistent with what TerrainSampler.toEnuHeight() uses internally,
    // ensuring toEnuHeight returns ~0 for the terrain at the anchor lat/lon rather
    // than a large offset caused by the geoid-ellipsoid separation.
    const anchorCarto = Cesium.Cartographic.fromDegrees(location.lon, location.lat);
    const wgs84H = viewer.scene.globe.getHeight(anchorCarto);
    const terrainHeight =
      wgs84H !== undefined && Number.isFinite(wgs84H) ? wgs84H : roughTerrainHeight;
    if (import.meta.env.DEV) console.log(
      `Terrain height resolved: rough=${roughTerrainHeight.toFixed(1)}m, WGS84=${terrainHeight.toFixed(1)}m`,
    );

    // Create ENU frame at spawn location using WGS84-consistent height
    const enuFrame = createENUFrame(location.lon, location.lat, terrainHeight);

    // Sample actual surface height (including buildings) from 3D tiles
    const terrainSampler = new TerrainSampler(viewer.scene, enuFrame);

    // Find a nearby flyable start point so landmarks and rooftops don't force
    // the drone onto unstable high-detail geometry.
    const spawnPoint = await terrainSampler.findSpawnPoint(spawnAlt);
    if (generation !== this.sessionGeneration) return;
    if (import.meta.env.DEV) console.log(
      `Spawn point resolved to ENU (${spawnPoint.x.toFixed(1)}, ${spawnPoint.y.toFixed(1)}, ${spawnPoint.z.toFixed(1)})`,
    );

    this.spawnOrigin = {
      longitude: location.lon,
      latitude: location.lat,
      terrainHeight,
      name: location.name,
    };

    this.cesiumManager.setEnvironmentAnchor(
      location.lon,
      location.lat,
      terrainHeight,
    );

    // Position camera at actual spawn altitude above surface, looking forward (North)
    viewer.camera.setView({
      destination: enuToEcef(spawnPoint, enuFrame),
      orientation: {
        heading: 0,
        pitch: 0,
        roll: 0,
      },
    });
    await this.tileLoader.waitForViewRefinement();
    if (generation !== this.sessionGeneration) return;

    // Start game loop with terrain sampler for real-time ground collision
    const sceneExclusions: object[] = [];
    const cloudCollection = this.cesiumManager.getCloudCollection();
    if (cloudCollection) {
      sceneExclusions.push(cloudCollection);
    }

    this.gameLoop = new GameLoop({
      viewer,
      enuFrame,
      physicsConfig: { ...store.physicsConfig, spawnAltitude: spawnAlt },
      ratesConfig: store.rates,
      terrainSampler,
      initialPosition: spawnPoint,
      sceneExclusions,
      audio: this.droneAudio,
    });

    // Wire crash callback to Zustand store (no window globals)
    this.gameLoop.onCrash(() => {
      useStore.getState().triggerCrashFlash();
    });

    this.gameLoop.start();

    // Set up distance-based globe toggle (hide within 2km for 3D tile clarity)
    const spawnEcef = enuToEcef(spawnPoint, enuFrame);
    this.cesiumManager.setupGlobeToggle(
      spawnEcef,
      2000,
      () => this.tileLoader.hasRenderableTilesInView(),
    );

    useStore.getState().setPhase("FLYING");
    } finally {
      if (generation === this.sessionGeneration) {
        if (!this.gameLoop) this.droneAudio.dispose();
        this.isStarting = false;
      }
    }
  }

  private async resolveTerrainHeight(
    viewer: Cesium.Viewer,
    lat: number,
    lon: number,
  ): Promise<number> {
    const googleElevation = await this.getElevationFromGoogleAPI(lat, lon);
    if (googleElevation !== null) {
      return googleElevation;
    }

    const cartographic = Cesium.Cartographic.fromDegrees(lon, lat);
    const globeHeight = viewer.scene.globe.getHeight(cartographic);
    if (globeHeight !== undefined && Number.isFinite(globeHeight)) {
      if (import.meta.env.DEV) console.warn(
        `Using Cesium globe height fallback at spawn: ${globeHeight.toFixed(1)}m`,
      );
      return globeHeight;
    }

    return 0;
  }

  /** Get ground elevation using Google Maps Elevation service (client-side) */
  private async getElevationFromGoogleAPI(
    lat: number,
    lon: number,
  ): Promise<number | null> {
    try {
      // Use the Google Maps JavaScript API Elevation service (loaded in LocationPicker)
      const elevator = new google.maps.ElevationService();
      const result = await elevator.getElevationForLocations({
        locations: [{ lat, lng: lon }],
      });
      if (result.results?.[0]) {
        const elevation = result.results[0].elevation;
        if (import.meta.env.DEV) console.log(`Ground elevation at spawn: ${elevation.toFixed(1)}m`);
        return elevation;
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn("Elevation service failed:", e);
    }
    return null;
  }

  reset(): void {
    this.gameLoop?.reset();
  }

  private getCurrentLocationForPicker(): SavedLocation | null {
    if (this.gameLoop && this.spawnOrigin) {
      try {
        const droneState = this.gameLoop.getDroneState();
        const ecef = enuToEcef(droneState.position, this.gameLoop.getEnuFrame());
        const cartographic = Cesium.Cartographic.fromCartesian(ecef);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);
        const lng = Cesium.Math.toDegrees(cartographic.longitude);

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return {
            lat,
            lng,
            name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          };
        }
      } catch (err) {
        if (import.meta.env.DEV) console.warn("Failed to convert paused drone position to lat/lng", err);
      }
    }

    if (!this.spawnOrigin) return null;
    return {
      lat: this.spawnOrigin.latitude,
      lng: this.spawnOrigin.longitude,
      name: this.spawnOrigin.name,
    };
  }

  saveCurrentLocationAsDefault(): void {
    const currentLocation = this.getCurrentLocationForPicker();
    if (!currentLocation) return;

    const store = useStore.getState();
    store.setDefaultLocation(currentLocation);
    store.setPickerInitialLocation(currentLocation);
  }

  async copyLocationLink(): Promise<boolean> {
    const location = this.getCurrentLocationForPicker();
    if (!location) return false;
    try {
      await navigator.clipboard.writeText(buildGoogleMapsUrl(location.lat, location.lng));
      return true;
    } catch (err) {
      if (import.meta.env.DEV) console.warn("Failed to copy location link", err);
      return false;
    }
  }

  async changeLocationFromPause(): Promise<void> {
    const currentLocation = this.getCurrentLocationForPicker();
    if (currentLocation) {
      useStore.getState().setPickerInitialLocation(currentLocation);
    }
    await this.endSession();
  }

  pause(): void {
    this.flightRecorder.pause();
    const recording = useStore.getState().recording;
    if (recording.status === 'finalizing' && recording.stopReason === null) void this.flightRecorder.stop();
    this.gameLoop?.stop();
    useStore.getState().setPhase("PAUSED");
  }

  resume(): void {
    if (this.exitPromise || this.disposed) return;
    this.gameLoop?.applyStoreSettings();
    this.gameLoop?.start();
    this.flightRecorder.resume();
    useStore.getState().setPhase("FLYING");
  }

  endSession(): Promise<void> {
    if (this.exitPromise) return this.exitPromise;
    ++this.sessionGeneration;
    this.exitPromise = this.finishSession().finally(() => { this.exitPromise = null; });
    return this.exitPromise;
  }

  private async finishSession(): Promise<void> {
    await this.flightRecorder.stop('session_exit');
    this.setCacheOnlyPractice(false);
    this.gameLoop?.stop();
    this.droneAudio.dispose();
    this.gameLoop = null;
    this.isStarting = false;
    this.cesiumManager.teardownGlobeToggle();
    this.cesiumManager.hideContainer();
    this.spawnOrigin = null;
    useStore.getState().updateNavigation(null);
    useStore.getState().resetSession();
  }

  startRecording(): Promise<void> {
    const store = useStore.getState();
    if (store.phase !== 'FLYING' || this.exitPromise) {
      store.setRecording({ ...store.recording, status: store.recording.status === 'ready' ? 'ready' : 'error',
        error: { code: 'not_flying', message: 'Resume the flight before recording.' } });
      return Promise.resolve();
    }
    return this.flightRecorder.start();
  }

  stopRecording(): Promise<void> { return this.flightRecorder.stop(); }
  downloadRecording(): void { this.flightRecorder.download(); }
  discardRecording(): void { this.flightRecorder.discard(); }

  async dispose(): Promise<void> {
    this.disposed = true;
    await this.endSession();
    await this.flightRecorder.dispose();
  }

  getSpawnOrigin(): SpawnOrigin | null {
    return this.spawnOrigin;
  }

  getGameLoop(): GameLoop | null {
    return this.gameLoop;
  }
}
