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
    if (apiKey) {
      try {
        await this.tileLoader.loadGoogleTiles(viewer, apiKey);
      } catch {
        // Fallback to terrain
        await this.tileLoader.loadFallbackTerrain(viewer);
      }
    } else {
      await this.tileLoader.loadFallbackTerrain(viewer);
    }

    // Initialize terrain sampler
    await this.terrainSampler.init(viewer, location.lon, location.lat);
    const terrainHeight = this.terrainSampler.getDefaultHeight();

    // Create ENU frame at spawn location
    const enuFrame = createENUFrame(location.lon, location.lat, terrainHeight);

    this.spawnOrigin = {
      longitude: location.lon,
      latitude: location.lat,
      terrainHeight,
      name: location.name,
    };

    // Fly camera to spawn location
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        location.lon,
        location.lat,
        terrainHeight + DEFAULT_DRONE_CONFIG.spawnAltitude,
      ),
      duration: 0,
    });

    // Show Cesium container
    this.cesiumManager.showContainer();

    // Start game loop
    const store = useStore.getState();
    this.gameLoop = new GameLoop({
      viewer,
      enuFrame,
      physicsConfig: store.physicsConfig,
      ratesConfig: store.rates,
      terrainSampler: this.terrainSampler,
      terrainHeight,
    });
    this.gameLoop.start();

    useStore.getState().setPhase("FLYING");
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
