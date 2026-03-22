import { useRef, useEffect, useState } from 'react';
import { MapController } from './MapController';

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
          background: '#1a1a2e',
          color: '#e0e0e0',
          gap: '1rem',
        }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 300 }}>FPV Drone Simulator</h1>
          <p style={{ opacity: 0.6 }}>{mapError}</p>
          <p style={{ opacity: 0.4, fontSize: '0.8rem' }}>
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
        gap: '8px',
      }}>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search location..."
          style={{
            flex: 1,
            padding: '12px 16px',
            fontSize: '1rem',
            border: 'none',
            borderRadius: '8px',
            background: 'rgba(26, 26, 46, 0.95)',
            color: '#e0e0e0',
            outline: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        />
        <button
          onClick={handleMyLocation}
          disabled={locatingUser}
          title="Go to my location"
          style={{
            padding: '12px 14px',
            border: 'none',
            borderRadius: '8px',
            background: 'rgba(26, 26, 46, 0.95)',
            color: locatingUser ? '#888' : '#00ff88',
            cursor: locatingUser ? 'wait' : 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
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
        gap: '8px',
      }}>
        {selectedLocation && (
          <span style={{
            color: '#e0e0e0',
            fontSize: '0.85rem',
            background: 'rgba(26, 26, 46, 0.85)',
            padding: '4px 12px',
            borderRadius: '4px',
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
            fontWeight: 600,
            border: 'none',
            borderRadius: '8px',
            cursor: selectedLocation ? 'pointer' : 'not-allowed',
            background: selectedLocation ? '#00ff88' : 'rgba(0, 255, 136, 0.3)',
            color: selectedLocation ? '#1a1a2e' : 'rgba(26, 26, 46, 0.5)',
            boxShadow: selectedLocation ? '0 4px 16px rgba(0, 255, 136, 0.3)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          Fly Here
        </button>
      </div>
    </div>
  );
}
