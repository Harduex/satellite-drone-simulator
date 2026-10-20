import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest';
import urbanAreas from '../../world/data/urban-areas.json?raw';

beforeAll(() => vi.stubGlobal('fetch', vi.fn(async () => new Response(urbanAreas))));
afterAll(() => vi.unstubAllGlobals());

function seededRandom() {
  let seed = 12345;
  return () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
}
import { getRandomLocation } from '../randomLocation';
import { isLandLocation } from '../../world/LandMask';

describe('randomLocation (pure random)', () => {
  it.each([
    [48, 10, true], [-20, 25, true], [-25, 135, true], [-10, -60, true],
    [40, -100, true], [-85, 0, true], [0, 0, false], [0, -140, false],
    [0, 80, false], [35, 18, false], [0, 179.9, false], [0, -179.9, false],
    [NaN, 0, false], [0, Infinity, false],
  ])('classifies latitude %s longitude %s as land=%s', (lat, lng, expected) => {
    expect(isLandLocation(lat, lng)).toBe(expected);
  });
  it('returns diverse urban land candidates in valid geographic bounds', async () => {
    const randomFn = seededRandom();
    const samples = [];
    for (let i = 0; i < 100; i++) {
      const location = await getRandomLocation({ randomFn });
      expect(isLandLocation(location.lat, location.lng)).toBe(true);
      expect(location.random).toBe(true);
      expect(location.name).toMatch(/\u00b0[NS], .*\u00b0[EW]/);
      samples.push(location);
    }
    expect(new Set(samples.map(p => `${p.lat},${p.lng}`)).size).toBe(100);
    expect(samples.some(p => p.lat < 0)).toBe(true);
    expect(samples.some(p => p.lat > 0)).toBe(true);
    expect(samples.some(p => p.lng < 0)).toBe(true);
    expect(samples.some(p => p.lng > 0)).toBe(true);
  });

  it('supports reproducible draws without a city catalog', async () => {
    const first = await getRandomLocation({ randomFn: seededRandom() });
    const second = await getRandomLocation({ randomFn: seededRandom() });
    expect(first).toEqual(second);
  });

  it('bounds rejection when the random source cannot produce eligible candidates', async () => {
    await expect(getRandomLocation({ randomFn: () => NaN })).rejects.toThrow(/urban/i);
  });
});
