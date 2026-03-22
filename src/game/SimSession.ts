import * as Cesium from "cesium";
import { createENUFrame } from "../world/CoordUtils";
import { CesiumManager } from "../world/CesiumManager";
import { TileLoader } from "../world/TileLoader";
import { TerrainSampler } from "../world/TerrainSampler";
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
  private terrainSampler: TerrainSampler;
  private gameLoop: GameLoop | null = null;
  private spawnOrigin: SpawnOrigin | null = null;

  constructor(cesiumManager: CesiumManager) {
    this.cesiumManager = cesiumManager;
    this.tileLoader = new TileLoader();
    this.terrainSampler = new TerrainSampler();
  }

  async startSession(
    location: { lon: number; lat: number; name: string },
  ): Promise<void> {
    const viewer = this.cesiumManager.getViewer();

    // Load Google 3D Tiles if API key present
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
    let usingGoogle3DTiles = false;
    if (apiKey) {
      try {
        await this.tileLoader.loadGoogleTiles(viewer, apiKey);
        usingGoogle3DTiles = true;
      } catch {
        await this.tileLoader.loadFallbackTerrain(viewer);
      }
    } else {
      await this.tileLoader.loadFallbackTerrain(viewer);
    }

    // Determine terrain height at spawn location
    let terrainHeight: number;

    if (usingGoogle3DTiles && apiKey) {
      // Google 3D Tiles are primitives, not terrain — terrainProvider returns 0.
      // Use the Google Elevation API for accurate ground height.
      terrainHeight = await this.getElevationFromGoogleAPI(
        location.lat,
        location.lon,
        apiKey,
      );
    } else {
      await this.terrainSampler.init(viewer, location.lon, location.lat);
      terrainHeight = this.terrainSampler.getDefaultHeight();
    }

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
    this.gameLoop.start();

    useStore.getState().setPhase("FLYING");
  }

  /** Get ground elevation using Google Maps Elevation service (client-side) */
  private async getElevationFromGoogleAPI(
    lat: number,
    lon: number,
    _apiKey: string,
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
