import type { StateCreator } from 'zustand';
import type { SavedLocation } from './settingsSlice';
import { SettingsPersistence } from './SettingsPersistence';
import { FAVORITE_LIMIT, PLACE_NAME_LIMIT, PLACES_STORAGE_WARNING, PlacesPersistence, RECENT_LIMIT, placeKey, type PlacesSnapshot } from './PlacesPersistence';

export interface PlacesSlice extends PlacesSnapshot {
  placesStorageError: string | null;
  addFavorite: (location: SavedLocation) => string | null;
  renameFavorite: (key: string, name: string) => string | null;
  removeFavorite: (key: string) => void;
  recordRecentPlace: (location: SavedLocation) => void;
  removeRecentPlace: (key: string) => void;
  clearRecentPlaces: () => void;
}

function nameError(name: string): string | null {
  if (!name.trim()) return 'Enter a name for this place.';
  if (name.trim().length > PLACE_NAME_LIMIT) return `Use at most ${PLACE_NAME_LIMIT} characters.`;
  return null;
}

export const createPlacesSlice: StateCreator<PlacesSlice> = (set, get) => {
  const save = (changes: Partial<PlacesSnapshot>) => {
    const current = get();
    const next = { favoritePlaces: current.favoritePlaces, recentPlaces: current.recentPlaces, ...changes };
    const saved = PlacesPersistence.write(next);
    set({ ...next, placesStorageError: saved ? null : PLACES_STORAGE_WARNING });
  };
  return {
    ...PlacesPersistence.read(),
    addFavorite(location) {
      if (!SettingsPersistence.isFiniteLatLng(location.lat, location.lng)) return 'Choose a valid map location.';
      const error = nameError(location.name);
      if (error) return error;
      const favorites = get().favoritePlaces;
      if (favorites.some(place => placeKey(place) === placeKey(location))) return 'This place is already a favorite.';
      if (favorites.length >= FAVORITE_LIMIT) return 'Favorites are full. Remove a place before adding another.';
      save({ favoritePlaces: [...favorites, { lat: location.lat, lng: location.lng, name: location.name.trim() }] });
      return null;
    },
    renameFavorite(key, name) {
      const error = nameError(name);
      if (error) return error;
      if (!get().favoritePlaces.some(place => placeKey(place) === key)) return 'This favorite is no longer available.';
      save({ favoritePlaces: get().favoritePlaces.map(place => placeKey(place) === key ? { ...place, name: name.trim() } : place) });
      return null;
    },
    removeFavorite(key) { save({ favoritePlaces: get().favoritePlaces.filter(place => placeKey(place) !== key) }); },
    recordRecentPlace(location) {
      if (!SettingsPersistence.isFiniteLatLng(location.lat, location.lng)) return;
      const name = location.name.trim().slice(0, PLACE_NAME_LIMIT);
      if (!name) return;
      const place = { lat: location.lat, lng: location.lng, name };
      save({ recentPlaces: [place, ...get().recentPlaces.filter(recent => placeKey(recent) !== placeKey(place))].slice(0, RECENT_LIMIT) });
    },
    removeRecentPlace(key) { save({ recentPlaces: get().recentPlaces.filter(place => placeKey(place) !== key) }); },
    clearRecentPlaces() { save({ recentPlaces: [] }); },
  };
};
