import { useRef, useEffect, useState } from 'react';
import { MapController } from './MapController';
import { ControllerSetup } from '../Settings/ControllerSetup';
import { PhysicsSettings } from '../Settings/PhysicsSettings';
import { colors, fonts, fontSizes, gradients, spacing, glass } from '../theme';
import { useStore } from '../../store';

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
  const defaultLocation = useStore((s) => s.defaultLocation);
  const pickerInitialLocation = useStore((s) => s.pickerInitialLocation);
  const clearPickerInitialLocation = useStore((s) => s.clearPickerInitialLocation);
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    name: string;
  } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [locatingUser, setLocatingUser] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState<'none' | 'controller' | 'physics'>('none');
  const [launching, setLaunching] = useState(false);

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

  const handleFlyHere = () => {
    if (!selectedLocation || launching) return;
    setLaunching(true);
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
        <button
          onClick={() => setSettingsPanel('controller')}
          title="Settings"
          style={{
            padding: '12px 14px',
            border: 'none',
            borderRadius: 0,
            background: glass.background,
            backdropFilter: glass.backdropFilter,
            color: colors.on_surface,
            cursor: 'pointer',
            fontSize: '1.2rem',
            lineHeight: 1,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
          disabled={!selectedLocation || launching}
          style={{
            padding: '14px 48px',
            fontSize: '1.1rem',
            fontFamily: fonts.display,
            fontWeight: 600,
            border: 'none',
            borderRadius: 0,
            cursor: selectedLocation && !launching ? 'pointer' : 'not-allowed',
            background: launching ? 'rgba(255, 182, 147, 0.5)' : selectedLocation ? gradients.cta : 'rgba(255, 182, 147, 0.3)',
            color: selectedLocation ? colors.on_primary : colors.on_surface_muted,
            boxShadow: selectedLocation && !launching ? '0 0 20px rgba(255, 182, 147, 0.3)' : 'none',
            transition: 'all 0.2s',
            opacity: launching ? 0.7 : 1,
          }}
        >
          {launching ? 'Loading...' : 'Fly Here'}
        </button>
      </div>

      {/* Settings overlay */}
      {settingsPanel !== 'none' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: glass.background,
          backdropFilter: glass.backdropFilter,
          zIndex: 20,
        }}>
          <div style={{
            background: colors.surface_container_low,
            borderRadius: 0,
            padding: spacing.xl,
            maxWidth: '560px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
          }}>
            {/* Tab buttons */}
            <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.md }}>
              <button
                onClick={() => setSettingsPanel('controller')}
                style={{
                  ...tabStyle,
                  background: settingsPanel === 'controller' ? colors.primary : 'transparent',
                  color: settingsPanel === 'controller' ? colors.on_primary : colors.on_surface,
                }}
              >
                Controller
              </button>
              <button
                onClick={() => setSettingsPanel('physics')}
                style={{
                  ...tabStyle,
                  background: settingsPanel === 'physics' ? colors.primary : 'transparent',
                  color: settingsPanel === 'physics' ? colors.on_primary : colors.on_surface,
                }}
              >
                Physics
              </button>
            </div>
            {settingsPanel === 'controller' && (
              <ControllerSetup onClose={() => setSettingsPanel('none')} />
            )}
            {settingsPanel === 'physics' && (
              <PhysicsSettings onClose={() => setSettingsPanel('none')} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const tabStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: fontSizes.body_sm,
  fontFamily: fonts.display,
  fontWeight: 600,
  border: '1px solid ' + colors.outline_variant,
  borderRadius: 0,
  cursor: 'pointer',
};
