import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Cesium from 'cesium';
import { RenderDiagnostics } from '../RenderDiagnostics';
import { TileLoader } from '../../world/TileLoader';
import type { RenderDiagnosticsSnapshot } from '../../store/diagnosticsSlice';

function createScene() {
  const postRender = new Cesium.Event();
  const tiles = {
    tileLoad: new Cesium.Event(), tileVisible: new Cesium.Event(),
    tileUnload: new Cesium.Event(), tileFailed: new Cesium.Event(),
    statistics: { numberOfPendingRequests: 2, numberOfTilesProcessing: 1,
      numberOfTilesWithContentReady: 5 },
    totalMemoryUsageInBytes: 1024, cacheBytes: 2048,
    maximumCacheOverflowBytes: 512, maximumScreenSpaceError: 8,
    memoryAdjustedScreenSpaceError: 8, skipLevelOfDetail: false,
  };
  const loader = new TileLoader();
  Object.assign(loader, { tileset: tiles });
  const viewer = { scene: { postRender, globe: { show: false } } } as unknown as Cesium.Viewer;
  const published: RenderDiagnosticsSnapshot[] = [];
  const monitor = new RenderDiagnostics(viewer, loader, value => published.push(value));
  return { postRender, tiles, loader, monitor, published };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('RenderDiagnostics', () => {
  it('counts completed tile fetches conservatively, separates known cache hits, and ages out activity', () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    let deliver: (entries: object[]) => void = () => {};
    let disconnected = false;
    vi.stubGlobal('PerformanceObserver', class {
      constructor(callback: (list: { getEntries: () => object[] }) => void) {
        deliver = entries => callback({ getEntries: () => entries });
      }
      observe() {}
      disconnect() { disconnected = true; }
    });
    const { monitor, postRender, published } = createScene();
    monitor.start();
    now = 100;
    deliver([
      { name: 'https://tile.googleapis.com/v1/3dtiles/one.glb?key=private', transferSize: 600, decodedBodySize: 300 },
      { name: 'https://tile.googleapis.com/v1/3dtiles/two.glb', transferSize: 0, decodedBodySize: 300 },
      { name: 'https://tile.googleapis.com/v1/3dtiles/three.glb', transferSize: 0, decodedBodySize: 0 },
      { name: 'https://maps.googleapis.com/maps/api/js', transferSize: 600, decodedBodySize: 300 },
    ]);
    now = 500; postRender.raiseEvent();
    expect(published[0]).toMatchObject({ requestTimingAvailable: true,
      observationSeconds: 0.5,
      tileFetchesLast5Seconds: 3, totalTileFetches: 3, networkTileFetches: 1,
      browserCacheTileFetches: 1, unknownTileFetches: 1 });
    expect(JSON.stringify(published)).not.toContain('private');
    now = 5200; postRender.raiseEvent();
    expect(published[1]).toMatchObject({ observationSeconds: 5.2, tileFetchesLast5Seconds: 0, totalTileFetches: 3 });
    monitor.stop();
    expect(disconnected).toBe(true);
  });

  it('distinguishes resident view tiles from tiles loaded during the sample window', () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { monitor, tiles, postRender, published } = createScene();
    monitor.start();
    const resident = {}, fresh = {};
    now = 100;
    tiles.tileLoad.raiseEvent(fresh);
    for (const timestamp of [125, 250, 375, 500]) {
      now = timestamp;
      tiles.tileVisible.raiseEvent(resident);
      tiles.tileVisible.raiseEvent(fresh);
      tiles.tileVisible.raiseEvent(resident);
      postRender.raiseEvent();
    }
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({ fps: 8, frameTimeMs: 125,
      visibleTiles: 2, residentVisibleTiles: 1, newlyLoadedVisibleTiles: 1,
      loadedTiles: 1, pendingRequests: 2, processingTiles: 1, cachedTiles: 5,
      memoryBytes: 1024, cacheBytes: 2048, overflowBytes: 512, skipLevelOfDetail: false });
    now = 1000;
    tiles.tileVisible.raiseEvent(resident);
    tiles.tileVisible.raiseEvent(fresh);
    postRender.raiseEvent();
    expect(published[1]).toMatchObject({ residentVisibleTiles: 2,
      newlyLoadedVisibleTiles: 0, loadedTiles: 0 });
    monitor.stop();
  });

  it('reports eviction and failure counts without retaining error URLs', () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { monitor, tiles, postRender, published } = createScene();
    monitor.start();
    tiles.tileUnload.raiseEvent({});
    tiles.tileFailed.raiseEvent({ url: 'https://example.test/tile?key=private' });
    now = 500;
    postRender.raiseEvent();
    expect(published[0]).toMatchObject({ evictedTiles: 1, failedTiles: 1 });
    expect(JSON.stringify(published)).not.toContain('private');
    now = 1000;
    postRender.raiseEvent();
    expect(published[1]).toMatchObject({ evictedTiles: 0, failedTiles: 1 });
    monitor.stop();
  });

  it('detaches every listener when hidden and does not duplicate listeners on restart', () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const { monitor, tiles, postRender } = createScene();
    monitor.start(); monitor.start();
    expect(postRender.numberOfListeners).toBe(1);
    expect(tiles.tileLoad.numberOfListeners).toBe(1);
    monitor.stop();
    expect(postRender.numberOfListeners).toBe(0);
    for (const event of [tiles.tileLoad, tiles.tileVisible, tiles.tileUnload, tiles.tileFailed]) {
      expect(event.numberOfListeners).toBe(0);
    }
    monitor.start();
    expect(postRender.numberOfListeners).toBe(1);
    monitor.stop();
  });

  it('starts before a tileset exists and attaches when a flight loads it', () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { monitor, loader, tiles, postRender, published } = createScene();
    Object.assign(loader, { tileset: null });
    monitor.start();
    now = 500; postRender.raiseEvent();
    expect(published[0]).toMatchObject({ tilesetLoaded: false, visibleTiles: 0 });
    Object.assign(loader, { tileset: tiles });
    now = 600; postRender.raiseEvent();
    expect(tiles.tileLoad.numberOfListeners).toBe(1);
    now = 1000; postRender.raiseEvent();
    expect(published[1]).toMatchObject({ tilesetLoaded: true, pendingRequests: 2 });
    monitor.stop();
  });
});
