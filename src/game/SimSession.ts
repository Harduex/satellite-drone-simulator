import * as Cesium from "cesium";
import { createENUFrame, enuToEcef } from "../world/CoordUtils";
import { CesiumManager } from "../world/CesiumManager";
import { TileLoader } from "../world/TileLoader";
import { TerrainSampler } from "../world/TerrainSampler";
import { GameLoop } from "./GameLoop";
import { useStore } from "../store";

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

  constructor(cesiumManager: CesiumManager) {
    this.cesiumManager = cesiumManager;
    this.tileLoader = new TileLoader();
  }

  async startSession(
    location: { lon: number; lat: number; name: string },
  ): Promise<void> {
    const viewer = this.cesiumManager.getViewer();

    // Load Google 3D Tiles
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
    if (apiKey) {
      await this.tileLoader.loadGoogleTiles(viewer, apiKey);
    }

    // Get rough elevation for initial camera placement (may be orthometric from Google API)
    const roughTerrainHeight = await this.resolveTerrainHeight(
      viewer,
      location.lat,
      location.lon,
    );

    // Show Cesium container
    this.cesiumManager.showContainer();

    // Position camera temporarily so globe terrain loads around the spawn point.
    // Use roughTerrainHeight just to get the camera in the right ballpark.
    const store = useStore.getState();
    const spawnAlt = store.physicsConfig.spawnAltitude;
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        location.lon,
        location.lat,
        roughTerrainHeight + spawnAlt + 50,
      ),
      orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0 },
    });
    await this.tileLoader.waitForViewRefinement(viewer);

    // After tiles/globe have loaded, query WGS84 ellipsoidal height from the globe.
    // This is consistent with what TerrainSampler.toEnuHeight() uses internally,
    // ensuring toEnuHeight returns ~0 for the terrain at the anchor lat/lon rather
    // than a large offset caused by the geoid-ellipsoid separation.
    const anchorCarto = Cesium.Cartographic.fromDegrees(location.lon, location.lat);
    const wgs84H = viewer.scene.globe.getHeight(anchorCarto);
    const terrainHeight =
      wgs84H !== undefined && Number.isFinite(wgs84H) ? wgs84H : roughTerrainHeight;
    console.log(
      `Terrain height resolved: rough=${roughTerrainHeight.toFixed(1)}m, WGS84=${terrainHeight.toFixed(1)}m`,
    );

    // Create ENU frame at spawn location using WGS84-consistent height
    const enuFrame = createENUFrame(location.lon, location.lat, terrainHeight);

    // Sample actual surface height (including buildings) from 3D tiles
    const terrainSampler = new TerrainSampler(viewer.scene, enuFrame);

    // Find a nearby flyable start point so landmarks and rooftops don't force
    // the drone onto unstable high-detail geometry.
    const spawnPoint = await terrainSampler.findSpawnPoint(spawnAlt);
    console.log(
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
    await this.tileLoader.waitForViewRefinement(viewer, 2500);

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
      console.warn(
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
        console.log(`Ground elevation at spawn: ${elevation.toFixed(1)}m`);
        return elevation;
      }
    } catch (e) {
      console.warn("Elevation service failed:", e);
    }
    return null;
  }

  reset(): void {
    this.gameLoop?.reset();
  }

  pause(): void {
    this.gameLoop?.stop();
    useStore.getState().setPhase("PAUSED");
  }

  resume(): void {
    this.gameLoop?.start();
    useStore.getState().setPhase("FLYING");
  }

  endSession(): void {
    this.gameLoop?.stop();
    this.gameLoop = null;
    this.cesiumManager.hideContainer();
    this.spawnOrigin = null;
    useStore.getState().resetSession();
  }

  getSpawnOrigin(): SpawnOrigin | null {
    return this.spawnOrigin;
  }

  getGameLoop(): GameLoop | null {
    return this.gameLoop;
  }
}
