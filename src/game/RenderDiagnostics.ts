import type * as Cesium from 'cesium';
import type { TileLoader } from '../world/TileLoader';
import type { RenderDiagnosticsSnapshot } from '../store/diagnosticsSlice';

export class RenderDiagnostics {
  private removePostRender: Cesium.Event.RemoveCallback | null = null;
  private tileCleanups: Cesium.Event.RemoveCallback[] = [];
  private observedTileset: Cesium.Cesium3DTileset | null = null;
  private visibleTiles = new Set<Cesium.Cesium3DTile>();
  private loadedAt = new WeakMap<Cesium.Cesium3DTile, number>();
  private sampleStart = 0;
  private observationStart = 0;
  private frames = 0;
  private loadedTiles = 0;
  private evictedTiles = 0;
  private failedTiles = 0;
  private resourceObserver: PerformanceObserver | null = null;
  private recentTileFetches: number[] = [];
  private totalTileFetches = 0;
  private networkTileFetches = 0;
  private browserCacheTileFetches = 0;
  private unknownTileFetches = 0;

  constructor(
    private viewer: Cesium.Viewer,
    private tileLoader: TileLoader,
    private publish: (snapshot: RenderDiagnosticsSnapshot) => void,
  ) {}

  start(): void {
    if (this.removePostRender) return;
    this.sampleStart = performance.now();
    this.observationStart = this.sampleStart;
    this.frames = this.loadedTiles = this.evictedTiles = this.failedTiles = 0;
    this.totalTileFetches = this.networkTileFetches = this.browserCacheTileFetches = this.unknownTileFetches = 0;
    this.recentTileFetches.length = 0;
    if (typeof PerformanceObserver !== 'undefined') {
      this.resourceObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) this.recordTileFetch(entry as PerformanceResourceTiming);
      });
      this.resourceObserver.observe({ type: 'resource', buffered: false });
    }
    this.attachTileset();
    this.removePostRender = this.viewer.scene.postRender.addEventListener(() => this.sample());
  }

  stop(): void {
    this.removePostRender?.();
    this.removePostRender = null;
    this.resourceObserver?.disconnect();
    this.resourceObserver = null;
    this.recentTileFetches.length = 0;
    this.detachTileset();
  }

  private detachTileset(): void {
    for (const cleanup of this.tileCleanups) cleanup();
    this.tileCleanups.length = 0;
    this.observedTileset = null;
    this.visibleTiles.clear();
    this.loadedAt = new WeakMap();
  }

  private attachTileset(): void {
    const tileset = this.tileLoader.getTileset();
    if (tileset === this.observedTileset) return;
    this.detachTileset();
    this.observedTileset = tileset;
    if (!tileset) return;
    this.tileCleanups.push(
      tileset.tileLoad.addEventListener((tile: Cesium.Cesium3DTile) => {
        this.loadedAt.set(tile, performance.now());
        this.loadedTiles++;
      }),
      tileset.tileVisible.addEventListener((tile: Cesium.Cesium3DTile) => {
        this.visibleTiles.add(tile);
      }),
      tileset.tileUnload.addEventListener((tile: Cesium.Cesium3DTile) => {
        this.loadedAt.delete(tile);
        this.evictedTiles++;
      }),
      tileset.tileFailed.addEventListener(() => { this.failedTiles++; }),
    );
  }

  private sample(): void {
    this.attachTileset();
    this.frames++;
    const now = performance.now();
    const elapsed = now - this.sampleStart;
    if (elapsed >= 500) {
      let expired = 0;
      while (expired < this.recentTileFetches.length && this.recentTileFetches[expired]! <= now - 5000) expired++;
      if (expired > 0) this.recentTileFetches.splice(0, expired);
      let newlyLoadedVisibleTiles = 0;
      for (const tile of this.visibleTiles) {
        const loaded = this.loadedAt.get(tile);
        if (loaded !== undefined && loaded >= this.sampleStart) newlyLoadedVisibleTiles++;
      }
      const tileset = this.observedTileset;
      const statistics = this.tileLoader.getStreamingStatistics();
      this.publish({
        fps: this.frames * 1000 / elapsed,
        frameTimeMs: elapsed / this.frames,
        sampleSeconds: elapsed / 1000,
        observationSeconds: (now - this.observationStart) / 1000,
        tilesetLoaded: tileset !== null,
        visibleTiles: this.visibleTiles.size,
        residentVisibleTiles: this.visibleTiles.size - newlyLoadedVisibleTiles,
        newlyLoadedVisibleTiles,
        cachedTiles: statistics?.numberOfTilesWithContentReady ?? 0,
        pendingRequests: statistics?.numberOfPendingRequests ?? 0,
        processingTiles: statistics?.numberOfTilesProcessing ?? 0,
        memoryBytes: tileset?.totalMemoryUsageInBytes ?? 0,
        cacheBytes: tileset?.cacheBytes ?? 0,
        overflowBytes: tileset?.maximumCacheOverflowBytes ?? 0,
        loadedTiles: this.loadedTiles,
        evictedTiles: this.evictedTiles,
        failedTiles: this.failedTiles,
        skipLevelOfDetail: tileset?.skipLevelOfDetail ?? false,
        maximumScreenSpaceError: tileset?.maximumScreenSpaceError ?? 0,
        memoryAdjustedScreenSpaceError: this.tileLoader.getEffectiveScreenSpaceError(),
        globeVisible: this.viewer.scene.globe.show,
        requestTimingAvailable: this.resourceObserver !== null,
        tileFetchesLast5Seconds: this.recentTileFetches.length,
        totalTileFetches: this.totalTileFetches,
        networkTileFetches: this.networkTileFetches,
        browserCacheTileFetches: this.browserCacheTileFetches,
        unknownTileFetches: this.unknownTileFetches,
      });
      this.sampleStart = now;
      this.frames = this.loadedTiles = this.evictedTiles = 0;
    }
    this.visibleTiles.clear();
  }

  private recordTileFetch(entry: PerformanceResourceTiming & { deliveryType?: string }): void {
    // Photorealistic tile fetches include hierarchy JSON as well as model content.
    // Maps imagery and geocoding have separate request budgets.
    if (!entry.name.startsWith('https://tile.googleapis.com/v1/3dtiles/')) return;
    this.recentTileFetches.push(performance.now());
    this.totalTileFetches++;
    if (entry.transferSize > 0) this.networkTileFetches++;
    else if (entry.decodedBodySize > 0 || entry.deliveryType === 'cache') this.browserCacheTileFetches++;
    else this.unknownTileFetches++;
  }
}
