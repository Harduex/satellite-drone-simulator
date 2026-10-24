// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import { createPlacesSlice, type PlacesSlice } from '../placesSlice';

const paris = { lat: 48.8584, lng: 2.2945, name: 'Paris' };
const makeStore = () => create<PlacesSlice>()(createPlacesSlice);
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('saved places', () => {
  it('persists favorites and recent launch order across reloads', () => {
    const store = makeStore();
    expect(store.getState().addFavorite({ ...paris, name: '  Tower  ' })).toBeNull();
    store.getState().recordRecentPlace(paris);
    store.getState().recordRecentPlace({ lat: 51.5, lng: -0.1, name: 'London' });
    const saved = makeStore().getState();
    expect(saved.favoritePlaces).toEqual([{ ...paris, name: 'Tower' }]);
    expect(saved.recentPlaces.map(place => place.name)).toEqual(['London', 'Paris']);
  });

  it('deduplicates nearby rounded coordinates without renaming favorites', () => {
    const store = makeStore();
    store.getState().addFavorite(paris);
    expect(store.getState().addFavorite({ ...paris, lat: 48.85840001, name: 'Other' })).not.toBeNull();
    store.getState().recordRecentPlace(paris);
    store.getState().recordRecentPlace({ ...paris, lat: 48.85840001, name: 'Return' });
    expect(store.getState().favoritePlaces).toEqual([paris]);
    expect(store.getState().recentPlaces).toHaveLength(1);
    expect(store.getState().recentPlaces[0]!.name).toBe('Return');
  });

  it('rejects invalid coordinates and favorite names without changing stored places', () => {
    const store = makeStore();
    for (const value of [{ ...paris, lat: NaN }, { ...paris, lng: 181 }, { ...paris, name: ' ' }, { ...paris, name: 'x'.repeat(81) }]) {
      expect(store.getState().addFavorite(value)).not.toBeNull();
    }
    expect(store.getState().favoritePlaces).toEqual([]);
    store.getState().recordRecentPlace({ ...paris, lat: 91 });
    expect(store.getState().recentPlaces).toEqual([]);
  });

  it('preserves 50 favorites at capacity and keeps only the latest 20 recent places', () => {
    const store = makeStore();
    for (let lat = 0; lat < 50; lat++) {
      expect(store.getState().addFavorite({ lat, lng: 0, name: `Place ${lat}` })).toBeNull();
      store.getState().recordRecentPlace({ lat, lng: 0, name: `Place ${lat}` });
    }
    expect(store.getState().addFavorite({ lat: 60, lng: 0, name: 'Overflow' })).not.toBeNull();
    expect(store.getState().favoritePlaces).toHaveLength(50);
    expect(store.getState().favoritePlaces[0]!.name).toBe('Place 0');
    expect(store.getState().recentPlaces.map(place => place.lat)).toEqual([49,48,47,46,45,44,43,42,41,40,39,38,37,36,35,34,33,32,31,30]);
  });

  it('renames and removes favorites independently from recent history', () => {
    const store = makeStore();
    store.getState().addFavorite(paris);
    store.getState().recordRecentPlace(paris);
    const key = '48.858400:2.294500';
    expect(store.getState().renameFavorite(key, ' Home ')).toBeNull();
    expect(store.getState().favoritePlaces[0]!.name).toBe('Home');
    expect(store.getState().recentPlaces[0]!.name).toBe('Paris');
    expect(store.getState().renameFavorite(key, '')).not.toBeNull();
    store.getState().clearRecentPlaces();
    expect(store.getState().favoritePlaces).toHaveLength(1);
    store.getState().removeFavorite(key);
    expect(makeStore().getState().favoritePlaces).toEqual([]);
  });

  it('removes individual recent entries without deleting favorites', () => {
    const store = makeStore();
    store.getState().addFavorite(paris);
    store.getState().recordRecentPlace(paris);
    store.getState().removeRecentPlace('48.858400:2.294500');
    expect(makeStore().getState().recentPlaces).toEqual([]);
    expect(store.getState().favoritePlaces).toHaveLength(1);
  });

  it('validates storage entries, removes duplicates and does not rewrite on read', () => {
    const raw = JSON.stringify({ version: 1, favorites: [paris, paris, { ...paris, lat: 100 }, null], recent: [paris] });
    localStorage.setItem('fpvsim_places', raw);
    expect(makeStore().getState().favoritePlaces).toEqual([paris]);
    expect(localStorage.getItem('fpvsim_places')).toBe(raw);
  });

  it.each(['{', '{"version":2,"favorites":[],"recent":[]}', '{"version":1,"favorites":null,"recent":[]}'])('ignores malformed or unsupported documents: %s', raw => {
    localStorage.setItem('fpvsim_places', raw);
    expect(makeStore().getState().favoritePlaces).toEqual([]);
    expect(localStorage.getItem('fpvsim_places')).toBe(raw);
  });

  it('keeps session edits and reports denied storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    const store = makeStore();
    expect(store.getState().placesStorageError).not.toBeNull();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(store.getState().addFavorite(paris)).toBeNull();
    expect(store.getState().favoritePlaces).toEqual([paris]);
    expect(store.getState().placesStorageError).not.toBeNull();
  });
});
