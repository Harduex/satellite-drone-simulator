import { describe, expect, it, vi } from 'vitest';
import { RoadSource, normalizeRoadProperties, selectCoverageTiles, readBoundedResponse, validateTileTemplate } from '../RoadSource';

describe('road source boundary', () => {
  it('does not invoke native fetch with the source object as receiver', async () => {
    vi.stubGlobal('fetch', function(this: unknown) {
      if(this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
      return Promise.resolve(new Response(JSON.stringify({tiles:['https://tiles.openfreemap.org/v/{z}/{x}/{y}.pbf']})));
    });
    try { await expect(new RoadSource(()=>({x:0,y:0,z:0})).loadTiles([],new AbortController().signal)).resolves.toEqual([]); }
    finally { vi.unstubAllGlobals(); }
  });
  it('rejects restricted access regardless of provider representation', () => {
    for (const access of [false, 'no', 'private']) expect(normalizeRoadProperties({ class: 'minor', access })).toBeNull();
    expect(normalizeRoadProperties({ class: 'minor', oneway: -1 })).toMatchObject({ oneway: -1 });
    expect(normalizeRoadProperties({ class: 'minor' })).toMatchObject({ oneway: 0 });
  });
  it('excludes buried, pedestrian, service and unknown direction geometry', () => {
    for (const properties of [{ class: 'path' }, { class: 'minor', brunnel: 'tunnel' },
      { class: 'minor', service: 'parking_aisle' }, { class: 'primary', oneway: 3 }]) {
      expect(normalizeRoadProperties(properties)).toBeNull();
    }
  });
  it('prioritizes bounded geographic tiles and wraps the antimeridian', () => {
    const keys = selectCoverageTiles({ longitude: 179.999, latitude: 60 });
    expect(keys.length).toBeLessThanOrEqual(16);
    expect(keys.some(k => k.x === 0)).toBe(true);
    expect(keys.every(k => k.x >= 0 && k.x < 16384)).toBe(true);
    expect(selectCoverageTiles({ longitude: 0, latitude: 89 })).toEqual([]);
  });
  it('rejects arbitrary provider hosts and insecure templates', () => {
    expect(() => validateTileTemplate('https://example.com/{z}/{x}/{y}.pbf')).toThrow();
    expect(() => validateTileTemplate('http://tiles.openfreemap.org/{z}/{x}/{y}.pbf')).toThrow();
    expect(validateTileTemplate('https://tiles.openfreemap.org/planet/v/{z}/{x}/{y}.pbf')).toContain('{x}');
  });
  it('limits streamed bytes without trusting content length', async () => {
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(5)); controller.close(); } });
    await expect(readBoundedResponse(new Response(stream), 4)).rejects.toThrow('limit');
  });
});
