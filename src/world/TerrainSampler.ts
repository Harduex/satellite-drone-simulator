import * as Cesium from "cesium";
import type { Vector3 } from "../core/physics/types";
import { enuToEcef } from "./CoordUtils";

const MAX_REASONABLE_SURFACE_OFFSET_METERS = 10000;
const MIN_SAFE_SPAWN_AGL_METERS = 8;
const SPAWN_SAMPLE_OFFSETS: readonly [number, number][] = [
  [90, 0],
  [-90, 0],
  [0, 90],
  [0, -90],
  [90, 90],
  [90, -90],
  [-90, 90],
  [-90, -90],
  [140, 0],
  [-140, 0],
  [0, 140],
  [0, -140],
  [140, 140],
  [140, -140],
  [-140, 140],
  [-140, -140],
  [0, 0],
];

/**
 * Samples ground height (terrain + buildings from 3D tiles) at the drone's
 * current position using CesiumJS scene.sampleHeight().
 *
 * Results are cached and updated each render frame (~60Hz).
 * The physics loop (500Hz) reads the cached value for its ground floor.
 */
export class TerrainSampler {
  private scene: Cesium.Scene;
  private enuFrame: Cesium.Matrix4;
  private cachedGroundHeight = 0; // ENU Z coordinate of the ground surface
  private originCartographic: Cesium.Cartographic;
  private objectsToExclude: object[] = [];

  constructor(scene: Cesium.Scene, enuFrame: Cesium.Matrix4) {
    this.scene = scene;
    this.enuFrame = enuFrame;

    // Cache the WGS84 origin for height-to-ENU conversion
    const originEcef = Cesium.Matrix4.getTranslation(enuFrame, new Cesium.Cartesian3());
    this.originCartographic = Cesium.Cartographic.fromCartesian(originEcef);
  }

  /** Set objects (entities, primitives) to exclude from scene.sampleHeight() */
  setExclusions(objects: object[]): void {
    this.objectsToExclude = objects.filter(Boolean);
  }

  /** Get the cached ground height in ENU Z coordinates */
  getGroundHeight(): number {
    return this.cachedGroundHeight;
  }

  private toEnuHeight(sampledHeight: number | undefined): number | null {
    if (sampledHeight === undefined || !Number.isFinite(sampledHeight)) {
      return null;
    }

    const enuZ = sampledHeight - this.originCartographic.height;
    if (
      !Number.isFinite(enuZ) ||
      Math.abs(enuZ) > MAX_REASONABLE_SURFACE_OFFSET_METERS
    ) {
      return null;
    }

    return enuZ;
  }

  private sampleHeightFromScene(carto: Cesium.Cartographic): number | null {
    if (!this.scene.sampleHeightSupported) {
      return null;
    }

    return this.toEnuHeight(this.scene.sampleHeight(carto, this.objectsToExclude));
  }

  private sampleHeightFromGlobe(carto: Cesium.Cartographic): number | null {
    return this.toEnuHeight(this.scene.globe.getHeight(carto));
  }

  private sampleCartographicAtOffset(east: number, north: number): Cesium.Cartographic {
    const ecef = Cesium.Matrix4.multiplyByPoint(
      this.enuFrame,
      new Cesium.Cartesian3(east, north, 0),
      new Cesium.Cartesian3(),
    );

    return Cesium.Cartographic.fromCartesian(ecef);
  }

  private sampleNearbySpawnSurface(): { x: number; y: number; z: number } | null {
    let bestSurface: { x: number; y: number; z: number } | null = null;

    for (const [east, north] of SPAWN_SAMPLE_OFFSETS) {
      const carto = this.sampleCartographicAtOffset(east, north);
      const sampledGroundHeight =
        this.sampleHeightFromScene(carto) ?? this.sampleHeightFromGlobe(carto);

      if (sampledGroundHeight === null) {
        continue;
      }

      if (!bestSurface || sampledGroundHeight < bestSurface.z) {
        bestSurface = { x: east, y: north, z: sampledGroundHeight };
      }
    }

    return bestSurface;
  }

  /**
   * Sample ground height at the drone's current XY position.
   * Called once per render frame. Uses scene.sampleHeight() for synchronous
   * results against loaded 3D tiles.
   */
  sampleAtPosition(dronePosition: Vector3): void {
    try {
      // Convert drone ENU position to ECEF, then to Cartographic
      const ecef = enuToEcef(dronePosition, this.enuFrame);
      const carto = Cesium.Cartographic.fromCartesian(ecef);

      const sampledGroundHeight =
        this.sampleHeightFromScene(carto) ?? this.sampleHeightFromGlobe(carto);
      if (sampledGroundHeight !== null) {
        this.cachedGroundHeight = sampledGroundHeight;
      }
    } catch {
      // sampleHeight can fail if tiles aren't loaded yet — keep last cached value
    }
  }

  /**
   * Async initial sample at the spawn point. Waits for tiles to be ready
   * so the first spawn height is accurate (including buildings).
   */
  async findSpawnPoint(spawnAltitude: number): Promise<Vector3> {
    const safeSpawnAltitude = Math.max(
      spawnAltitude,
      MIN_SAFE_SPAWN_AGL_METERS,
    );

    // Try multiple times as tiles load in
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const bestSurface = this.sampleNearbySpawnSurface();
        if (bestSurface) {
          this.cachedGroundHeight = bestSurface.z;
          return {
            x: bestSurface.x,
            y: bestSurface.y,
            z: bestSurface.z + safeSpawnAltitude,
          };
        }
      } catch {
        // tiles not ready yet
      }
      // Wait for next render frame to allow tiles to load
      await new Promise<void>((resolve) => {
        this.scene.requestRender();
        requestAnimationFrame(() => resolve());
      });
    }

    const fallbackGroundHeight = this.sampleHeightFromGlobe(
      this.originCartographic,
    );
    if (fallbackGroundHeight !== null) {
      this.cachedGroundHeight = fallbackGroundHeight;
      return { x: 0, y: 0, z: fallbackGroundHeight + safeSpawnAltitude };
    }

    return { x: 0, y: 0, z: safeSpawnAltitude };
  }
}
