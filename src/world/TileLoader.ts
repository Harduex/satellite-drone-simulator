import * as Cesium from "cesium";

interface RuntimeTilesetStats {
  numberOfPendingRequests: number;
  numberOfTilesWithContentReady: number;
  visited: number;
}

interface Cesium3DTilesetExtended extends Cesium.Cesium3DTileset {
  statistics: RuntimeTilesetStats;
  cacheBytes: number;
  maximumCacheOverflowBytes: number;
  loadSiblings: boolean;
  foveatedMinimumScreenSpaceError: number;
}

function getRuntimeStats(
  tileset: Cesium.Cesium3DTileset,
): RuntimeTilesetStats {
  return (tileset as Cesium3DTilesetExtended).statistics;
}

export class TileLoader {
  private tileset: Cesium.Cesium3DTileset | null = null;

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
  async loadGoogleTiles(
    viewer: Cesium.Viewer,
    apiKey: string,
  ): Promise<Cesium.Cesium3DTileset> {
    if (this.tileset) {
      return this.tileset;
    }
    const tileset = await Cesium.Cesium3DTileset.fromUrl(
      `https://tile.googleapis.com/v1/3dtiles/root.json?key=${apiKey}`,
    );
    // In-session tile cache — tileset is reused across sessions so the cache persists.
    // cacheBytes is the newer API name (replaces maximumMemoryUsage in Cesium 1.107+).
    // maximumCacheOverflowBytes gives Cesium a soft buffer above cacheBytes before
    // it aggressively evicts tiles — reduces LOD thrashing when switching locations.
    const ext = tileset as Cesium3DTilesetExtended;
    ext.cacheBytes = 768 * 1024 * 1024;
    ext.maximumCacheOverflowBytes = 256 * 1024 * 1024;
    tileset.maximumScreenSpaceError = 8;
    tileset.skipLevelOfDetail = true;
    ext.loadSiblings = true;
    tileset.foveatedScreenSpaceError = true;
    tileset.foveatedConeSize = 0.3;
    ext.foveatedMinimumScreenSpaceError = 4;
    viewer.scene.primitives.add(tileset);
    this.tileset = tileset;
    return tileset;
  }

  getTileset(): Cesium.Cesium3DTileset | null {
    return this.tileset;
  }

  /** Kick tile traversal for the new camera position. */
  prepareForNewLocation(viewer: Cesium.Viewer): void {
    if (!this.tileset) return;
    // Let Cesium's cacheBytes (768MB) + maximumCacheOverflowBytes (256MB) handle
    // natural LRU eviction — no need to aggressively flush all GPU-cached tiles.
    viewer.scene.requestRender();
  }

  async waitForViewRefinement(
    viewer: Cesium.Viewer,
    timeoutMs: number = 4000,
  ): Promise<void> {
    const tileset = this.tileset;
    if (!tileset) {
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
