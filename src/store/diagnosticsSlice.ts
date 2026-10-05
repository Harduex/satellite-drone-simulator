import type { StateCreator } from 'zustand';

export interface RenderDiagnosticsSnapshot {
  fps: number;
  frameTimeMs: number;
  sampleSeconds: number;
  observationSeconds: number;
  tilesetLoaded: boolean;
  visibleTiles: number;
  residentVisibleTiles: number;
  newlyLoadedVisibleTiles: number;
  cachedTiles: number;
  pendingRequests: number;
  processingTiles: number;
  memoryBytes: number;
  cacheBytes: number;
  overflowBytes: number;
  loadedTiles: number;
  evictedTiles: number;
  failedTiles: number;
  skipLevelOfDetail: boolean;
  maximumScreenSpaceError: number;
  memoryAdjustedScreenSpaceError: number;
  globeVisible: boolean;
  requestTimingAvailable: boolean;
  tileFetchesLast5Seconds: number;
  totalTileFetches: number;
  networkTileFetches: number;
  browserCacheTileFetches: number;
  unknownTileFetches: number;
}

export interface DiagnosticsSlice {
  pedestrianDiagnostics: PedestrianDiagnosticsSnapshot | null;
  updatePedestrianDiagnostics: (snapshot: PedestrianDiagnosticsSnapshot | null) => void;
  trafficDiagnostics: TrafficDiagnosticsSnapshot | null;
  updateTrafficDiagnostics: (snapshot: TrafficDiagnosticsSnapshot | null) => void;
  diagnosticsVisible: boolean;
  renderDiagnostics: RenderDiagnosticsSnapshot | null;
  toggleDiagnostics: () => void;
  updateRenderDiagnostics: (snapshot: RenderDiagnosticsSnapshot | null) => void;
}

export const createDiagnosticsSlice: StateCreator<DiagnosticsSlice> = (set) => ({
  pedestrianDiagnostics: null,
  updatePedestrianDiagnostics: pedestrianDiagnostics => set({ pedestrianDiagnostics }),
  trafficDiagnostics: null,
  updateTrafficDiagnostics: trafficDiagnostics => set({ trafficDiagnostics }),
  diagnosticsVisible: false,
  renderDiagnostics: null,
  toggleDiagnostics: () => set(state => ({ diagnosticsVisible: !state.diagnosticsVisible })),
  updateRenderDiagnostics: renderDiagnostics => set({ renderDiagnostics }),
});

export interface PedestrianDiagnosticsSnapshot {
  people: number; renderedPeople: number; paths: number; cachedTiles: number; cachedBytes: number;
  pendingRequests: number; requestFailures: number; refreshes: number; updateMs: number;
  surfaceSamples: number; surfaceMs: number; pendingPaths: number; rejectedPaths: number;
}

export interface TrafficDiagnosticsSnapshot {
  cars: number; edges: number; cachedTiles: number; cachedBytes: number; pendingRequests: number;
  requestFailures: number; refreshes: number; updateMs: number; surfaceSamples: number;
  surfaceMs: number; pendingSurfaceRoads: number; rejectedRoads: number;
}
