import { createContext, useContext, useRef } from 'react';
import { CesiumManager } from '../world/CesiumManager';
import { SimSession } from '../game/SimSession';

export interface Services {
  cesiumManager: CesiumManager;
  simSession: SimSession;
}

const ServiceContext = createContext<Services | null>(null);

export function useServices(): Services {
  const ctx = useContext(ServiceContext);
  if (!ctx) throw new Error('useServices must be used within ServiceProvider');
  return ctx;
}

export function ServiceProvider({ children }: { children: React.ReactNode }) {
  const servicesRef = useRef<Services | null>(null);

  if (!servicesRef.current) {
    const cesiumManager = new CesiumManager();
    cesiumManager.init('cesium-container');
    cesiumManager.hideContainer();
    const simSession = new SimSession(cesiumManager);
    servicesRef.current = { cesiumManager, simSession };
  }

  return (
    <ServiceContext.Provider value={servicesRef.current}>
      {children}
    </ServiceContext.Provider>
  );
}
