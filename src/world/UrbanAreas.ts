import urbanAreasUrl from './data/urban-areas.json?url';
import { createPolygonSampler } from './PolygonSampler';
import type { GeographicPolygon } from './GeographicPolygon';

let sampler: Promise<ReturnType<typeof createPolygonSampler>> | null = null;

export async function sampleUrbanLocation(random: () => number) {
  sampler ??= fetch(urbanAreasUrl).then(async response => {
    if (!response.ok) throw new Error('Unable to load urban area data. Try again.');
    return createPolygonSampler(await response.json() as GeographicPolygon[]);
  }).catch(error => { sampler = null; throw error; });
  return (await sampler)(random);
}
