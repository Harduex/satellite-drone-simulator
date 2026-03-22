import * as Cesium from "cesium";

interface RuntimeTilesetStats {
  numberOfPendingRequests: number;
  numberOfTilesWithContentReady: number;
  visited: number;
}

function getRuntimeStats(
  tileset: Cesium.Cesium3DTileset,
): RuntimeTilesetStats {
  return (tileset as Cesium.Cesium3DTileset & {
    statistics: RuntimeTilesetStats;
  }).statistics;
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

  /** Load Google Photorealistic 3D Tiles */
  async loadGoogleTiles(
    viewer: Cesium.Viewer,
    apiKey: string,
  ): Promise<Cesium.Cesium3DTileset> {
    const tileset = await Cesium.Cesium3DTileset.fromUrl(
      `https://tile.googleapis.com/v1/3dtiles/root.json?key=${apiKey}`,
    );
    // Increase in-session tile cache to 1GB for smoother revisits
    // cacheBytes is the newer API name (replaces maximumMemoryUsage in Cesium 1.107+)
    (tileset as unknown as Record<string, number>).cacheBytes = 1024 * 1024 * 1024;
    tileset.maximumScreenSpaceError = 8;
    tileset.skipLevelOfDetail = false;
    tileset.preloadFlightDestinations = true;
    tileset.preferLeaves = true;
    viewer.scene.primitives.add(tileset);
    this.tileset = tileset;
    return tileset;
  }

  getTileset(): Cesium.Cesium3DTileset | null {
    return this.tileset;
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
        if (remainingTiles === 0) {
          settledFrames += 1;
          if (settledFrames >= 3) {
            finish();
          }
        } else {
          settledFrames = 0;
        }
      };

      const removeProgressListener = tileset.loadProgress.addEventListener(
        (pendingRequests?: number, processingTiles?: number) => {
          noteProgress((pendingRequests ?? 0) + (processingTiles ?? 0));
        },
      );

      const removeInitialLoadedListener = tileset.initialTilesLoaded.addEventListener(
        () => {
          noteProgress(0);
        },
      );

      const removeAllLoadedListener = tileset.allTilesLoaded.addEventListener(() => {
        noteProgress(0);
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
      noteProgress(getRuntimeStats(tileset).numberOfPendingRequests);
    });
  }
}
