import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
const polygons = [[[[10, 45], [11, 45], [11, 46], [10, 46], [10, 45]]]];

it('retries a failed data request on the next selection', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(polygons)));
  vi.stubGlobal('fetch', fetch);
  const { sampleUrbanLocation } = await import('../UrbanAreas');
  await expect(sampleUrbanLocation(() => 0.5)).rejects.toThrow(/load urban/);
  expect((await sampleUrbanLocation(() => 0.5)).lng).toBe(10.5);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('shares one data request between concurrent selections', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify(polygons)));
  vi.stubGlobal('fetch', fetch);
  const { sampleUrbanLocation } = await import('../UrbanAreas');
  const results = await Promise.all([sampleUrbanLocation(() => 0.5), sampleUrbanLocation(() => 0.25)]);
  expect(results.map(point => point.lng)).toEqual([10.5, 10.25]);
  expect(fetch).toHaveBeenCalledOnce();
});
