import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { LocationPicker } from './LocationPicker/LocationPicker';
import { SimView } from './SimView/SimView';
import { SetupRequired } from './SetupRequired';
import { ServiceProvider, useServices } from './ServiceProvider';

export function App() {
  const hasApiKeys = useRef(checkApiKeys());

  if (!hasApiKeys.current) {
    return <SetupRequired />;
  }

  return (
    <ServiceProvider>
      <AppContent />
    </ServiceProvider>
  );
}

function AppContent() {
  const phase = useStore((s) => s.phase);
  const { simSession } = useServices();

  // ESC key handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code !== 'Escape') return;
    const store = useStore.getState();
    if (store.phase === 'FLYING') {
      simSession.pause();
    } else if (store.phase === 'PAUSED') {
      simSession.resume();
    }
  }, [simSession]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {phase === 'PICKER' && (
        <LocationPicker
          onFlyHere={(location) => {
            simSession.startSession(location);
          }}
        />
      )}
      {(phase === 'FLYING' || phase === 'PAUSED') && (
        <SimView
          session={simSession}
          isPaused={phase === 'PAUSED'}
        />
      )}
    </>
  );
}

function checkApiKeys(): boolean {
  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
  return Boolean(googleKey);
}
