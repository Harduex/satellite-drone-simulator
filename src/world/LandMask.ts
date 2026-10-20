import landGeoJson from './data/ne_110m_land.geojson?raw';
import { insidePolygon } from './GeographicPolygon';

type Ring = [number, number][];
type Polygon = Ring[];
interface LandFeatures {
  features: { geometry: { type: 'Polygon'; coordinates: Polygon } | { type: 'MultiPolygon'; coordinates: Polygon[] } }[];
}

const polygons = (JSON.parse(landGeoJson) as LandFeatures).features.flatMap(({ geometry }) =>
  geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates,
).map(rings => {
  const outer = rings[0]!;
  return {
    rings,
    west: Math.min(...outer.map(point => point[0])),
    east: Math.max(...outer.map(point => point[0])),
    south: Math.min(...outer.map(point => point[1])),
    north: Math.max(...outer.map(point => point[1])),
  };
});

/** Coarse coastline eligibility; inland water and small coastal details remain approximate. */
export function isLandLocation(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return polygons.some(({ rings, west, east, south, north }) =>
    lng >= west && lng <= east && lat >= south && lat <= north
    && insidePolygon(lng, lat, rings),
  );
}
