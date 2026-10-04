import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Cesium from 'cesium';
import { TileLoader } from '../TileLoader';

const tileServer = 'tile.googleapis.com:443';
const originalLimit = Cesium.RequestScheduler.requestsByServer[tileServer];

afterEach(() => {
  if (originalLimit === undefined) delete Cesium.RequestScheduler.requestsByServer[tileServer];
  else Cesium.RequestScheduler.requestsByServer[tileServer] = originalLimit;
  vi.unstubAllGlobals();
});

function fetchTile(host = 'tile.googleapis.com') {
  return new Cesium.Resource({
    url: `https://${host}/v1/3dtiles/test.glb`,
    request: new Cesium.Request({ throttleByServer: true }),
  }).fetchArrayBuffer();
}

describe('cache-only practice', () => {
  it('blocks tile fetches, leaves other servers alone, and resumes streaming', async () => {
    const fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal('fetch', fetch);
    const loader = new TileLoader();
    loader.setCacheOnlyPractice(true);
    expect(fetchTile()).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
    expect(await fetchTile('example.com')).toBeInstanceOf(ArrayBuffer);
    loader.setCacheOnlyPractice(false);
    expect(await fetchTile()).toBeInstanceOf(ArrayBuffer);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('restores a previous server limit after repeated enable and disable calls', () => {
    Cesium.RequestScheduler.requestsByServer[tileServer] = 7;
    const loader = new TileLoader();
    loader.setCacheOnlyPractice(true);
    loader.setCacheOnlyPractice(true);
    expect(Cesium.RequestScheduler.requestsByServer[tileServer]).toBe(0);
    loader.setCacheOnlyPractice(false);
    loader.setCacheOnlyPractice(false);
    expect(Cesium.RequestScheduler.requestsByServer[tileServer]).toBe(7);
  });

  it('allows an already started request to finish while blocking new requests', async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
    const pending = fetchTile();
    const loader = new TileLoader();
    loader.setCacheOnlyPractice(true);
    expect(fetchTile()).toBeUndefined();
    finish(new Response(new Uint8Array([1])));
    expect(await pending).toBeInstanceOf(ArrayBuffer);
    loader.setCacheOnlyPractice(false);
  });

  it('retains the warmed cache with in-flight headroom and restores the streaming budget', () => {
    delete Cesium.RequestScheduler.requestsByServer[tileServer];
    const tileset = { cacheBytes: 1536, totalMemoryUsageInBytes: 1600, maximumCacheOverflowBytes: 512 };
    const loader = new TileLoader();
    Object.assign(loader, { tileset });
    loader.setCacheOnlyPractice(true);
    expect(tileset.cacheBytes).toBe(2112);
    loader.setCacheOnlyPractice(true);
    expect(tileset.cacheBytes).toBe(2112);
    loader.setCacheOnlyPractice(false);
    expect(tileset.cacheBytes).toBe(1536);
    expect(Object.hasOwn(Cesium.RequestScheduler.requestsByServer, tileServer)).toBe(false);
  });
});
