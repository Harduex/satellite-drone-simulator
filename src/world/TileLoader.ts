import * as Cesium from "cesium";

interface RuntimeTilesetStats {
  numberOfPendingRequests: number;
  numberOfTilesProcessing: number;
  numberOfTilesWithContentReady: number;
  visited: number;
}

interface Cesium3DTilesetExtended extends Cesium.Cesium3DTileset {
  statistics: RuntimeTilesetStats;
  memoryAdjustedScreenSpaceError: number;
}

function getRuntimeStats(
  tileset: Cesium.Cesium3DTileset,
): RuntimeTilesetStats {
  return (tileset as Cesium3DTilesetExtended).statistics;
}

export class TileLoader {
  private tileset: Cesium.Cesium3DTileset | null = null;
  private viewer: Cesium.Viewer | null = null;
  private cacheOnlyPractice = false;
  private previousTileServerLimit: number | undefined;
  private previousCacheBytes: number | null = null;

  setCacheOnlyPractice(enabled: boolean): void {
    if (enabled === this.cacheOnlyPractice) return;
    const serverLimits = Cesium.RequestScheduler.requestsByServer;
    const tileServer = 'tile.googleapis.com:443';
    if (enabled) {
      this.previousTileServerLimit = serverLimits[tileServer];
      // A saturated server defers content requests without marking tiles as failed.
      serverLimits[tileServer] = 0;
      if (this.tileset) {
        this.previousCacheBytes = this.tileset.cacheBytes;
        // Keep the warmed area while allowing requests already in flight to finish.
        this.tileset.cacheBytes = Math.max(this.tileset.cacheBytes, this.tileset.totalMemoryUsageInBytes)
          + this.tileset.maximumCacheOverflowBytes;
      }
    } else {
      if (this.previousTileServerLimit === undefined) delete serverLimits[tileServer];
      else serverLimits[tileServer] = this.previousTileServerLimit;
      if (this.tileset && this.previousCacheBytes !== null) this.tileset.cacheBytes = this.previousCacheBytes;
      this.previousCacheBytes = null;
    }
    this.cacheOnlyPractice = enabled;
    this.viewer?.scene.requestRender();
  }

  hasRenderableTilesInView(): boolean {
    const tileset = this.tileset;
    if (!tileset) {
      return false;
    }

    const statistics = getRuntimeStats(tileset);
    // Require tiles to be both actively traversed (per-frame) AND have content.
    // Using AND prevents the globe from hiding when the camera moves to a new area
    // where tiles haven't streamed in yet — `visited` resets while new tiles load.
    return (
      statistics.visited > 0 &&
      statistics.numberOfTilesWithContentReady > 0
    );
  }

  /** Load Google Photorealistic 3D Tiles (reuses existing tileset if present) */
  async loadPhotorealisticTiles(
    viewer: Cesium.Viewer,
  ): Promise<Cesium.Cesium3DTileset> {
    this.viewer = viewer;

    if (this.tileset) {
      return this.tileset;
    }
    const tileset = await Cesium.createGooglePhotorealistic3DTileset(
      { onlyUsingWithGoogleGeocoder: true },
      // The helper enables camera collisions by default; physics handles them here.
      { enableCollision: false, showCreditsOnScreen: true },
    );
    // Retain visited tiles across flights while leaving GPU memory for rendering.
    // Overflow is reserved for tiles needed by the current view, not LRU retention.
    const ext = tileset as Cesium3DTilesetExtended;
    ext.cacheBytes = 6 * 1024 * 1024 * 1024;
    ext.maximumCacheOverflowBytes = 512 * 1024 * 1024;
    tileset.maximumScreenSpaceError = 8;
    // Standard replacement avoids overlapping coarse and detailed photogrammetry.
    tileset.skipLevelOfDetail = false;
    // Scanned buildings contain photographed shadows; dynamic self-shadows cause roof striping.
    tileset.shadows = Cesium.ShadowMode.DISABLED;
    // Avoid speculative downloads outside the view; visited tiles remain cached.
    ext.loadSiblings = false;
    tileset.foveatedScreenSpaceError = true;
    tileset.foveatedConeSize = 0.3;
    tileset.foveatedMinimumScreenSpaceErrorRelaxation = 4;
    viewer.scene.primitives.add(tileset);
    tileset.customShader = createTileColorGradingShader();
    this.tileset = tileset;
    return tileset;
  }

  setEnvironmentExposure(exposure: number): void {
    if (!Number.isFinite(exposure)) return;
    this.tileset?.customShader?.setUniform("u_environmentExposure", Math.max(0.01, Math.min(1, exposure)));
  }

  getTileset(): Cesium.Cesium3DTileset | null {
    return this.tileset;
  }

  getStreamingStatistics(): RuntimeTilesetStats | null {
    return this.tileset ? getRuntimeStats(this.tileset) : null;
  }

  getEffectiveScreenSpaceError(): number {
    return this.tileset
      ? (this.tileset as Cesium3DTilesetExtended).memoryAdjustedScreenSpaceError : 0;
  }

  /** Kick tile traversal for the new camera position. */
  prepareForNewLocation(): void {
    if (!this.tileset || !this.viewer) return;
    // Preserve visited tiles and let Cesium evict them only under memory pressure.
    this.viewer.scene.requestRender();
  }

  async waitForViewRefinement(timeoutMs: number = 4000): Promise<void> {
    const tileset = this.tileset;
    const viewer = this.viewer;
    if (!tileset || !viewer) {
      return;
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      let settledFrames = 0;
      let sawActivity = false;
      const startTime = performance.now();
      const MIN_WAIT_MS = 800;

      const finish = () => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeoutId);
        removeProgressListener();
        removeInitialLoadedListener();
        removeAllLoadedListener();
        resolve();
      };

      const noteProgress = (remainingTiles = 0) => {
        if (remainingTiles > 0) {
          sawActivity = true;
          settledFrames = 0;
        } else if (sawActivity && (performance.now() - startTime) >= MIN_WAIT_MS) {
          settledFrames += 1;
          if (settledFrames >= 5) {
            finish();
          }
        }
      };

      const removeProgressListener = tileset.loadProgress.addEventListener(
        (pendingRequests?: number, processingTiles?: number) => {
          noteProgress((pendingRequests ?? 0) + (processingTiles ?? 0));
        },
      );

      const removeInitialLoadedListener = tileset.initialTilesLoaded.addEventListener(
        () => {
          if (sawActivity) noteProgress(0);
        },
      );

      const removeAllLoadedListener = tileset.allTilesLoaded.addEventListener(() => {
        if (sawActivity) noteProgress(0);
      });

      const pump = () => {
        if (settled) {
          return;
        }

        viewer.scene.requestRender();
        requestAnimationFrame(pump);
      };

      const timeoutId = window.setTimeout(finish, timeoutMs);
      pump();
    });
  }
}

/** Color-grading shader for Google 3D Tiles — fixes washed-out/flat appearance. */
function createTileColorGradingShader(): Cesium.CustomShader {
  return new Cesium.CustomShader({
    mode: Cesium.CustomShaderMode.MODIFY_MATERIAL,
    uniforms: {
      u_environmentExposure: { type: Cesium.UniformType.FLOAT, value: 1 },
      u_saturation: { type: Cesium.UniformType.FLOAT, value: 1.2 },
      u_contrast: { type: Cesium.UniformType.FLOAT, value: 1.08 },
      u_aoStrength: { type: Cesium.UniformType.FLOAT, value: 0.4 },
      u_warmShift: { type: Cesium.UniformType.FLOAT, value: 0.03 },
    },
    fragmentShaderText: `
      void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
        // Saturation boost
        float luma = dot(material.diffuse, vec3(0.2126, 0.7152, 0.0722));
        material.diffuse = mix(vec3(luma), material.diffuse, u_saturation);

        // Contrast boost (pivot at mid-gray)
        material.diffuse = mix(vec3(0.5), material.diffuse, u_contrast);

        // Warm color shift (subtle)
        material.diffuse *= vec3(1.0 + u_warmShift, 1.0, 1.0 - u_warmShift);

        // Fake hemisphere AO from surface normal
        float ao = 0.5 + 0.5 * dot(fsInput.attributes.normalEC, vec3(0.0, 0.0, 1.0));
        ao = pow(ao, u_aoStrength);
        material.occlusion *= ao;
        material.diffuse *= u_environmentExposure;
        material.emissive *= u_environmentExposure;
      }
    `,
  });
}
