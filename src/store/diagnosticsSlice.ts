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
  diagnosticsVisible: boolean;
  renderDiagnostics: RenderDiagnosticsSnapshot | null;
  toggleDiagnostics: () => void;
  updateRenderDiagnostics: (snapshot: RenderDiagnosticsSnapshot | null) => void;
}

export const createDiagnosticsSlice: StateCreator<DiagnosticsSlice> = (set) => ({
  diagnosticsVisible: false,
  renderDiagnostics: null,
  toggleDiagnostics: () => set(state => ({ diagnosticsVisible: !state.diagnosticsVisible })),
  updateRenderDiagnostics: renderDiagnostics => set({ renderDiagnostics }),
});
