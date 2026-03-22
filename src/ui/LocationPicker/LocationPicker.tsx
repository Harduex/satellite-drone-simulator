import { useRef, useEffect, useState } from 'react';
import { MapController } from './MapController';
import { colors, fonts, fontSizes, gradients, spacing, glass } from '../theme';

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
  onFlyHere: (location: { lon: number; lat: number; name: string }) => void;
}

export function LocationPicker({ onFlyHere }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapControllerRef = useRef<MapController | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    name: string;
  } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [locatingUser, setLocatingUser] = useState(false);

  useEffect(() => {
    ensureAutocompleteStyles();
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
    if (!apiKey || !mapContainerRef.current || !searchInputRef.current) {
      if (!apiKey) setMapError('Google Maps API key not configured');
      return;
    }

    const controller = new MapController();
    controller.onLocationSelect = (loc) => {
      setSelectedLocation(loc);
    };
    controller.init(mapContainerRef.current, apiKey, searchInputRef.current).catch((e) => {
      setMapError(`Failed to load Google Maps: ${String(e)}`);
    });
    mapControllerRef.current = controller;

    return () => {
      controller.destroy();
      mapControllerRef.current = null;
    };
  }, []);

  const handleFlyHere = () => {
    if (!selectedLocation) return;
    onFlyHere({
      lon: selectedLocation.lng,
      lat: selectedLocation.lat,
      name: selectedLocation.name,
    });
  };

  const handleMyLocation = () => {
    const ctrl = mapControllerRef.current;
    if (!ctrl || locatingUser) return;
    setLocatingUser(true);
    ctrl.goToCurrentLocation()
      .catch((e) => console.warn("Geolocation failed:", e))
      .finally(() => setLocatingUser(false));
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      {/* Map container */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {mapError && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: colors.surface,
          color: colors.on_surface,
          gap: spacing.md,
        }}>
          <h1 style={{ fontSize: fontSizes.display_lg, fontWeight: 300, fontFamily: fonts.display }}>FPV Drone Simulator</h1>
          <p style={{ opacity: 0.6, fontFamily: fonts.body }}>{mapError}</p>
          <p style={{ opacity: 0.4, fontSize: fontSizes.body_sm, fontFamily: fonts.body }}>
            Add VITE_GOOGLE_MAPS_API_KEY to your .env file
          </p>
        </div>
      )}

      {/* Search bar */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        width: 'min(90%, 480px)',
        display: 'flex',
        gap: spacing.sm,
      }}>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search location..."
          style={{
            flex: 1,
            padding: '12px 16px',
            fontSize: fontSizes.display_sm,
            fontFamily: fonts.body,
            border: 'none',
            borderRadius: 0,
            background: glass.background,
            backdropFilter: glass.backdropFilter,
            color: colors.on_surface,
            outline: 'none',
          }}
        />
        <button
          onClick={handleMyLocation}
          disabled={locatingUser}
          title="Go to my location"
          style={{
            padding: '12px 14px',
            border: 'none',
            borderRadius: 0,
            background: glass.background,
            backdropFilter: glass.backdropFilter,
            color: locatingUser ? colors.on_surface_muted : colors.secondary,
            cursor: locatingUser ? 'wait' : 'pointer',
            fontSize: '1.2rem',
            lineHeight: 1,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
          </svg>
        </button>
      </div>

      {/* Fly Here button */}
      <div style={{
        position: 'absolute',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: spacing.sm,
      }}>
        {selectedLocation && (
          <span style={{
            color: colors.on_surface,
            fontSize: fontSizes.body_sm,
            fontFamily: fonts.body,
            background: glass.background,
            backdropFilter: glass.backdropFilter,
            padding: '4px 12px',
            borderRadius: 0,
          }}>
            {selectedLocation.name}
          </span>
        )}
        <button
          onClick={handleFlyHere}
          disabled={!selectedLocation}
          style={{
            padding: '14px 48px',
            fontSize: '1.1rem',
            fontFamily: fonts.display,
            fontWeight: 600,
            border: 'none',
            borderRadius: 0,
            cursor: selectedLocation ? 'pointer' : 'not-allowed',
            background: selectedLocation ? gradients.cta : 'rgba(255, 182, 147, 0.3)',
            color: selectedLocation ? colors.on_primary : colors.on_surface_muted,
            boxShadow: selectedLocation ? '0 0 20px rgba(255, 182, 147, 0.3)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          Fly Here
        </button>
      </div>
    </div>
  );
}
