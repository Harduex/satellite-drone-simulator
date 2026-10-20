import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import type { MapPosition } from '../../core/navigation/types';
import css from './HUD.module.css';

type PlaceLookup = (position: MapPosition) => string | null;
const MIN_LABEL_REFRESH_MS = 1000;
const MIN_LOCATION_CHANGE_METERS = 100;

export function FlightLocation({ fallbackName }: { fallbackName: string }) {
  const position = useStore(s => s.navigation?.position);
  const [lookup, setLookup] = useState<PlaceLookup | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const lastCheck = useRef<{ position: MapPosition; time: number } | null>(null);

  useEffect(() => {
    let disposed = false;
    import('../../world/PlaceNames').then(module => module.loadPlaceLookup())
      .then(resolve => { if (!disposed) setLookup(() => resolve); })
      .catch(() => { if (!disposed) setLookup(null); });
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    if (!position) { lastCheck.current = null; setLabel(null); return; }
    if (!lookup) return;
    const now = performance.now();
    const previous = lastCheck.current;
    if (previous) {
      const dy = (position.lat - previous.position.lat) * 111320;
      const dx = ((position.lng - previous.position.lng + 540) % 360 - 180)
        * Math.cos(position.lat * Math.PI / 180) * 111320;
      if (now - previous.time < MIN_LABEL_REFRESH_MS
        || dx * dx + dy * dy < MIN_LOCATION_CHANGE_METERS * MIN_LOCATION_CHANGE_METERS) return;
    }
    lastCheck.current = { position: { ...position }, time: now };
    setLabel(lookup(position));
  }, [lookup, position]);

  const text = label ?? (position ? `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}` : fallbackName);
  return <div className={css.locationName} aria-label={`Approximate location: ${text}`}
    title="Approximate location from offline Natural Earth data">{text}</div>;
}
