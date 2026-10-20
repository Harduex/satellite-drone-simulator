import placeNamesUrl from './data/place-names.json?url';
import type { MapPosition } from '../core/navigation/types';
import { insidePolygon, type GeographicPolygon } from './GeographicPolygon';

const NEARBY_SETTLEMENT_RADIUS_METERS = 50000;
const EARTH_RADIUS_METERS = 6371000;

export interface PlaceNameData {
  countries: { code: string; name: string; polygons: GeographicPolygon[] }[];
  settlements: (MapPosition & { name: string; region: string; country: string; code: string })[];
}

function unitPosition({ lat, lng }: MapPosition) {
  const latitude = lat * Math.PI / 180, longitude = lng * Math.PI / 180;
  return { x: Math.cos(latitude) * Math.cos(longitude), y: Math.cos(latitude) * Math.sin(longitude), z: Math.sin(latitude) };
}

export function createPlaceLookup(data: PlaceNameData) {
  const countries = data.countries.flatMap(country => country.polygons.map(rings => ({
    code: country.code, name: country.name, rings,
    west: Math.min(...rings[0]!.map(p => p[0])), east: Math.max(...rings[0]!.map(p => p[0])),
    south: Math.min(...rings[0]!.map(p => p[1])), north: Math.max(...rings[0]!.map(p => p[1])),
  })));
  const settlements = data.settlements.map(place => ({ ...place, unit: unitPosition(place) }));
  const maximumDistanceCosine = Math.cos(NEARBY_SETTLEMENT_RADIUS_METERS / EARTH_RADIUS_METERS);
  return (position: MapPosition): string | null => {
    const { lat, lng } = position;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    const country = countries.find(p => lng >= p.west && lng <= p.east && lat >= p.south && lat <= p.north
      && insidePolygon(lng, lat, p.rings));
    const unit = unitPosition(position);
    let nearest: typeof settlements[number] | null = null;
    let bestCosine = maximumDistanceCosine;
    for (const place of settlements) {
      if (country && country.code !== place.code) continue;
      const cosine = unit.x * place.unit.x + unit.y * place.unit.y + unit.z * place.unit.z;
      if (cosine > bestCosine) { nearest = place; bestCosine = cosine; }
    }
    if (!nearest) return country?.name ?? null;
    const parts = [...new Set([nearest.name, nearest.region, country?.name ?? nearest.country].filter(Boolean))];
    return `Near ${parts.join(', ')}`;
  };
}

let lookup: Promise<ReturnType<typeof createPlaceLookup>> | null = null;

export function loadPlaceLookup() {
  lookup ??= fetch(placeNamesUrl).then(async response => {
    if (!response.ok) throw new Error('Offline place names unavailable');
    return createPlaceLookup(await response.json() as PlaceNameData);
  }).catch(error => { lookup = null; throw error; });
  return lookup;
}
