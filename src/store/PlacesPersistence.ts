import type { SavedLocation } from './settingsSlice';
import { SettingsPersistence } from './SettingsPersistence';

export const FAVORITE_LIMIT = 50;
export const RECENT_LIMIT = 20;
export const PLACE_NAME_LIMIT = 80;
export const PLACES_STORAGE_WARNING = 'Changes could not be saved; available for this session only.';
const STORAGE_KEY = 'fpvsim_places';

export interface PlacesSnapshot {
  favoritePlaces: SavedLocation[];
  recentPlaces: SavedLocation[];
}

export function placeKey(location: Pick<SavedLocation, 'lat' | 'lng'>): string {
  return `${location.lat.toFixed(6)}:${location.lng.toFixed(6)}`;
}

function parsePlace(value: unknown): SavedLocation | null {
  if (!value || typeof value !== 'object') return null;
  const place = value as Partial<SavedLocation>;
  if (typeof place.lat !== 'number' || typeof place.lng !== 'number' ||
      !SettingsPersistence.isFiniteLatLng(place.lat, place.lng) || typeof place.name !== 'string') return null;
  const name = place.name.trim();
  if (!name || name.length > PLACE_NAME_LIMIT) return null;
  return { lat: place.lat, lng: place.lng, name };
}

function readList(values: unknown[], limit: number): SavedLocation[] {
  const places: SavedLocation[] = [];
  const keys = new Set<string>();
  for (const value of values) {
    const place = parsePlace(value);
    if (!place || keys.has(placeKey(place))) continue;
    keys.add(placeKey(place));
    places.push(place);
    if (places.length === limit) break;
  }
  return places;
}

export const PlacesPersistence = {
  read(): PlacesSnapshot & { placesStorageError: string | null } {
    const empty = { favoritePlaces: [], recentPlaces: [], placesStorageError: null };
    try {
      if (typeof localStorage === 'undefined') return { ...empty, placesStorageError: PLACES_STORAGE_WARNING };
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return empty;
      const saved: unknown = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return empty;
      const document = saved as { version?: unknown; favorites?: unknown; recent?: unknown };
      if (document.version !== 1 || !Array.isArray(document.favorites) || !Array.isArray(document.recent)) return empty;
      return {
        favoritePlaces: readList(document.favorites, FAVORITE_LIMIT),
        recentPlaces: readList(document.recent, RECENT_LIMIT),
        placesStorageError: null,
      };
    } catch (error) {
      return { ...empty, placesStorageError: error instanceof SyntaxError ? null : PLACES_STORAGE_WARNING };
    }
  },
  write(places: PlacesSnapshot): boolean {
    try {
      if (typeof localStorage === 'undefined') return false;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, favorites: places.favoritePlaces, recent: places.recentPlaces }));
      return true;
    } catch { return false; }
  },
};
