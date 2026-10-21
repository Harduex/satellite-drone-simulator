import { useRef, useEffect, useState } from 'react';
import { MapController } from './MapController';
import { SettingsDialog } from '../Settings/SettingsDialog';
import { FlightBrand } from '../FlightBrand';
import controls from '../controls.module.css';
import { useStore } from '../../store';
import { getRandomLocation } from '../../game/randomLocation';
import css from './LocationPicker.module.css';
import { FlightMinimap } from '../SimView/FlightMinimap';
import minimapCss from '../SimView/FlightMinimap.module.css';

// Ensure Google Places autocomplete dropdown renders above everything
const GLOBAL_STYLE_ID = 'fpvsim-pac-style';
function ensureAutocompleteStyles() {
  if (document.getElementById(GLOBAL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = GLOBAL_STYLE_ID;
  style.textContent = `.pac-container { z-index: 10000 !important; }`;
  document.head.appendChild(style);
}

interface Props {
  compact?: boolean;
  onFlyHere: (location: { lon: number; lat: number; name: string; random?: boolean }) => Promise<void>;
}

export function LocationPicker({ onFlyHere, compact = false }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapControllerRef = useRef<MapController | null>(null);
  const selectionGeneration = useRef(0);
  const defaultLocation = useStore((s) => s.defaultLocation);
  const pickerInitialLocation = useStore((s) => s.pickerInitialLocation);
  const clearPickerInitialLocation = useStore((s) => s.clearPickerInitialLocation);
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    name: string;
    random?: boolean;
  } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [locatingUser, setLocatingUser] = useState(false);
  const [locatingQuery, setLocatingQuery] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [randomizing, setRandomizing] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const collapsed = useStore(s => s.minimapCollapsed);
  const setCollapsed = useStore(s => s.setMinimapCollapsed);
  const navigation = useStore(s => s.navigation);

  useEffect(() => {
    ensureAutocompleteStyles();
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
    if (!apiKey || !mapContainerRef.current || !searchInputRef.current) {
      if (!apiKey) setMapError('Google Maps API key not configured');
      return;
    }

    const controller = new MapController();
    const fallbackCenter = { lat: 48.8584, lng: 2.2945 };
    const seededLocation = pickerInitialLocation ?? defaultLocation;
    const initialCenter = seededLocation
      ? { lat: seededLocation.lat, lng: seededLocation.lng }
      : fallbackCenter;

    controller.onLocationSelect = (loc) => {
      selectionGeneration.current++;
      setSelectedLocation(loc);
    };
    controller
      .init(
        mapContainerRef.current,
        apiKey,
        searchInputRef.current,
        initialCenter,
        seededLocation ?? undefined,
      )
      .then(ready => { if (ready) setMapReady(true); })
      .catch((e) => {
        setMapError(`Failed to load Google Maps: ${String(e)}`);
      });
    mapControllerRef.current = controller;

    if (pickerInitialLocation) {
      clearPickerInitialLocation();
    }

    return () => {
      controller.destroy();
      mapControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    mapControllerRef.current?.setFlightMode(compact);
    if (!compact && pickerInitialLocation) {
      const { lat, lng } = pickerInitialLocation;
      mapControllerRef.current?.setMarker(lat, lng);
      mapControllerRef.current?.flyTo(lat, lng, 16);
      setSelectedLocation(pickerInitialLocation);
      clearPickerInitialLocation();
    }
  }, [compact, mapReady, pickerInitialLocation, clearPickerInitialLocation]);

  useEffect(() => {
    if (compact && !collapsed && navigation && mapReady) mapControllerRef.current?.updateFlight(navigation);
  }, [compact, collapsed, navigation, mapReady]);

  const handleFlyHere = async () => {
    if (!selectedLocation || launching || randomizing || locatingQuery) return;
    setLaunching(true);
    setLaunchError(null);
    try {
      await onFlyHere({
        lon: selectedLocation.lng,
        lat: selectedLocation.lat,
        name: selectedLocation.name,
        random: selectedLocation.random,
      });
    } catch {
      setLaunchError(selectedLocation.random
        ? 'No usable Google 3D geometry found. Try Random again or choose a location.'
        : 'Unable to start flight. Check your Cesium ion token and access to Google Photorealistic 3D Tiles, then retry.');
    } finally {
      setLaunching(false);
    }
  };

  const handleMyLocation = () => {
    const ctrl = mapControllerRef.current;
    if (!ctrl || locatingUser || launching || randomizing || locatingQuery) return;
    setLocatingUser(true);
    ctrl.goToCurrentLocation()
      .catch((e) => console.warn("Geolocation failed:", e))
      .finally(() => setLocatingUser(false));
  };

  const handleRandomLocation = async () => {
    const ctrl = mapControllerRef.current;
    if (!ctrl || launching || randomizing || locatingQuery) return;
    const generation = ++selectionGeneration.current;
    setRandomizing(true);
    try {
      const loc = await getRandomLocation();
      if (mapControllerRef.current !== ctrl || generation !== selectionGeneration.current) return;
      ctrl.setMarker(loc.lat, loc.lng);
      ctrl.flyTo(loc.lat, loc.lng, 15);
      setSelectedLocation(loc);
      setLaunchError(null);
      if (searchInputRef.current) searchInputRef.current.value = loc.name;
    } catch {
      setLaunchError('Unable to select a random urban location. Try again.');
    } finally {
      setRandomizing(false);
    }
  };

  const handleLocate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const query = searchInputRef.current?.value?.trim();
    const ctrl = mapControllerRef.current;
    if (!ctrl || !query || launching || randomizing || locatingQuery) return;

    setLocatingQuery(true);
    setLaunchError(null);
    try {
      await ctrl.locateQuery(query);
    } catch {
      setLaunchError('Location not found. Check address or coordinates and try again.');
    } finally {
      setLocatingQuery(false);
    }
  };

  return (
    <div className={compact ? `${minimapCss.panel} ${collapsed ? minimapCss.collapsed : ''}` : css.root}>
      <div className={compact ? `${minimapCss.mapClip} ${collapsed ? minimapCss.hidden : ''}` : css.mapContainer}>
        <div ref={mapContainerRef} className={compact ? minimapCss.map : minimapCss.mapFull} />
      </div>
      {compact && <FlightMinimap collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} error={mapError} />}
      <div hidden={compact}>
        <header className={css.header}><FlightBrand />
          <button className={controls.quiet} onClick={() => setShowSettings(true)}>Settings</button>
        </header>
        {mapError && <div role="alert" className={css.errorOverlay}>
          <h1>Map unavailable</h1><p>{mapError}</p><p>Check the Maps API configuration and reload.</p>
        </div>}
        <main className={css.launchDock} aria-label="Choose flight location" aria-busy={launching || randomizing || locatingQuery}>
          <div className={css.destination}>
            <h1>Flight location</h1>
            <div className={css.place}>
              <strong title={selectedLocation?.name}>{selectedLocation?.name ?? 'Choose a location on the map'}</strong>
              <span>{selectedLocation
                ? `${Math.abs(selectedLocation.lat).toFixed(4)}°${selectedLocation.lat >= 0 ? 'N' : 'S'} / ${Math.abs(selectedLocation.lng).toFixed(4)}°${selectedLocation.lng >= 0 ? 'E' : 'W'}`
                : 'Search or click the map.'}</span>
            </div>
          </div>
          <div className={css.discovery}>
            <form onSubmit={handleLocate} className={css.searchForm}>
              <label className={css.searchBar}><span aria-hidden="true">⌕</span>
                <input
                  ref={searchInputRef}
                  type="text"
                  aria-label="Search location"
                  placeholder="Address or coordinates"
                  className={css.searchInput}
                  disabled={!mapReady || launching || randomizing || locatingQuery}
                />
                <button
                  type="submit"
                  onClick={handleLocate}
                  title="Locate"
                  aria-label="Locate address or coordinates"
                  disabled={!mapReady || launching || randomizing || locatingQuery}
                  className={css.locateBtn}
                >
                  {locatingQuery ? 'Locating…' : 'Locate'}
                </button>
              </label>
            </form>
            <div className={css.discoveryActions}>
              <button onClick={handleRandomLocation} title="Random location" disabled={!mapReady || launching || randomizing || locatingQuery} className={controls.secondary}>
                {randomizing ? 'Choosing…' : 'Random location'}
              </button>
              <button onClick={handleMyLocation} disabled={!mapReady || locatingUser || launching || randomizing || locatingQuery} title="Go to my location" className={controls.secondary}>
                {locatingUser ? 'Locating…' : 'My location'}
              </button>
            </div>
          </div>
          <div className={css.launchAction}>
            <button onClick={handleFlyHere} disabled={!selectedLocation || launching || randomizing || locatingQuery} className={controls.primary}>
              {launching ? 'Loading...' : 'Fly Here'}
            </button>
          </div>
          {launchError && <p role="alert" className={css.launchError}>{launchError}</p>}
        </main>
        {!compact && showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      </div>
    </div>
  );
}
