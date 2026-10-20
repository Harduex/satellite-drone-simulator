import { insidePolygon, type GeographicPolygon } from './GeographicPolygon';

const radians = Math.PI / 180;

export function createPolygonSampler(polygons: GeographicPolygon[]) {
  let totalArea = 0;
  const regions = polygons.map(rings => {
    const outer = rings[0]!;
    const west = Math.min(...outer.map(p => p[0]));
    const east = Math.max(...outer.map(p => p[0]));
    const south = Math.sin(Math.min(...outer.map(p => p[1])) * radians);
    const north = Math.sin(Math.max(...outer.map(p => p[1])) * radians);
    totalArea += (east - west) * (north - south);
    return { rings, west, east, south, north, cumulativeArea: totalArea };
  });
  return (random: () => number) => {
    for (let attempt = 0; attempt < 10000 && regions.length > 0; attempt++) {
      const area = random() * totalArea;
      let low = 0, high = regions.length - 1;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (area < regions[middle]!.cumulativeArea) high = middle;
        else low = middle + 1;
      }
      const region = regions[low]!;
      const lng = region.west + random() * (region.east - region.west);
      const lat = Math.asin(region.south + random() * (region.north - region.south)) / radians;
      // Selecting bounding boxes by area and rejecting outside preserves equal-area sampling.
      if (insidePolygon(lng, lat, region.rings)) return { lat, lng };
    }
    throw new Error('Unable to select a random urban location. Try again.');
  };
}
