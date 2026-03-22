import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { LocationPicker } from './LocationPicker/LocationPicker';
import { SimView } from './SimView/SimView';
import { CesiumManager } from '../world/CesiumManager';
import { SimSession } from '../game/SimSession';
import { SetupRequired } from './SetupRequired';

// Singleton instances — created once, shared across app lifetime
let cesiumManager: CesiumManager | null = null;
let simSession: SimSession | null = null;

function getOrCreateCesiumManager(): CesiumManager {
  if (!cesiumManager) {
    cesiumManager = new CesiumManager();
    cesiumManager.init('cesium-container');
    cesiumManager.hideContainer();
  }
  return cesiumManager;
}

function getOrCreateSimSession(): SimSession {
  if (!simSession) {
    simSession = new SimSession(getOrCreateCesiumManager());
  }
  return simSession;
}

export function App() {
  const phase = useStore((s) => s.phase);
  const hasApiKeys = useRef(checkApiKeys());

  // ESC key handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code !== 'Escape') return;
    const store = useStore.getState();
    if (store.phase === 'FLYING') {
      getOrCreateSimSession().pause();
    } else if (store.phase === 'PAUSED') {
      getOrCreateSimSession().resume();
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Initialize CesiumJS on mount (hidden)
  useEffect(() => {
    if (hasApiKeys.current) {
      getOrCreateCesiumManager();
    }
  }, []);

  if (!hasApiKeys.current) {
    return <SetupRequired />;
  }

  return (
    <>
      {phase === 'PICKER' && (
        <LocationPicker
          onFlyHere={(location) => {
            getOrCreateSimSession().startSession(location);
          }}
        />
      )}
      {(phase === 'FLYING' || phase === 'PAUSED') && (
        <SimView
          session={getOrCreateSimSession()}
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
