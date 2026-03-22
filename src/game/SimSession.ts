import * as Cesium from "cesium";
import { createENUFrame } from "../world/CoordUtils";
import { CesiumManager } from "../world/CesiumManager";
import { TileLoader } from "../world/TileLoader";
import { GameLoop } from "./GameLoop";
import { useStore } from "../store";
import { DEFAULT_DRONE_CONFIG } from "../core/physics/types";

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

    // Get ground elevation via Google Elevation Service
    const terrainHeight = await this.getElevationFromGoogleAPI(
      location.lat,
      location.lon,
    );

    // Show Cesium container
    this.cesiumManager.showContainer();

    // Create ENU frame at spawn location (at ground level)
    const enuFrame = createENUFrame(location.lon, location.lat, terrainHeight);

    this.spawnOrigin = {
      longitude: location.lon,
      latitude: location.lat,
      terrainHeight,
      name: location.name,
    };

    // Position camera at spawn altitude above terrain, looking forward (North)
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        location.lon,
        location.lat,
        terrainHeight + DEFAULT_DRONE_CONFIG.spawnAltitude,
      ),
      orientation: {
        heading: 0,
        pitch: 0,
        roll: 0,
      },
    });

    // Start game loop
    const store = useStore.getState();
    this.gameLoop = new GameLoop({
      viewer,
      enuFrame,
      physicsConfig: store.physicsConfig,
      ratesConfig: store.rates,
    });

    // Wire crash callback to Zustand store (no window globals)
    this.gameLoop.onCrash(() => {
      useStore.getState().triggerCrashFlash();
    });

    this.gameLoop.start();

    // Set up distance-based globe toggle (hide within 2km for 3D tile clarity)
    const spawnEcef = Cesium.Cartesian3.fromDegrees(
      location.lon,
      location.lat,
      terrainHeight + DEFAULT_DRONE_CONFIG.spawnAltitude,
    );
    this.cesiumManager.setupGlobeToggle(spawnEcef, 2000);

    useStore.getState().setPhase("FLYING");
  }

  /** Get ground elevation using Google Maps Elevation service (client-side) */
  private async getElevationFromGoogleAPI(
    lat: number,
    lon: number,
  ): Promise<number> {
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
    return 0;
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
