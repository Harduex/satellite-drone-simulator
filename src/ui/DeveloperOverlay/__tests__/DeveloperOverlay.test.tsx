// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { DeveloperOverlay } from "../DeveloperOverlay";
import { useStore } from "../../../store";
import type { SimSession } from "../../../game/SimSession";
import { PerformanceTimings } from '../../../game/PerformanceTimings';

it("shows separate traffic counters without requiring Google tile diagnostics", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div"),
    root = createRoot(container);
  const session = { setDiagnosticsEnabled: vi.fn() } as unknown as SimSession;
  useStore.setState({
    diagnosticsVisible: true,
    renderDiagnostics: null,
    trafficDiagnostics: {
      cars: 12,
      edges: 40,
      cachedTiles: 3,
      cachedBytes: 1024 * 1024,
      pendingRequests: 1,
      requestFailures: 2,
      refreshes: 3,
      updateMs: 0.2,
      surfaceSamples: 2,
      surfaceMs: 1,
      pendingSurfaceRoads: 15,
      rejectedRoads: 4,
    },
  });
  try {
    act(() => root.render(<DeveloperOverlay session={session} />));
    const traffic = container.querySelector(
      '[aria-label="Traffic diagnostics"]',
    );
    expect(traffic?.textContent).toContain("12 / 40");
    expect(traffic?.textContent).toContain("15 / 4");
    expect(traffic?.textContent).toContain("0.20 / 1.00");
  } finally {
    act(() => root.unmount());
    useStore.setState({ diagnosticsVisible: false, trafficDiagnostics: null });
    vi.unstubAllGlobals();
  }
});

it('shows frame tails and CPU phase costs with the GPU measurement limit', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div'), root = createRoot(container);
  const timings = new PerformanceTimings();
  timings.setEnabled(true);
  for (const ms of [10, 10, 20, 40, 80]) timings.recordFrame(ms);
  timings.record('contacts', 12);
  useStore.setState({ diagnosticsVisible: true, renderDiagnostics: {
    performance: timings.snapshot(), fps: 30, frameTimeMs: 33.3, sampleSeconds: 0.5,
    observationSeconds: 1, tilesetLoaded: false, visibleTiles: 0, residentVisibleTiles: 0,
    newlyLoadedVisibleTiles: 0, cachedTiles: 0, pendingRequests: 0, processingTiles: 0,
    memoryBytes: 0, cacheBytes: 0, overflowBytes: 0, loadedTiles: 0, evictedTiles: 0,
    failedTiles: 0, skipLevelOfDetail: false, maximumScreenSpaceError: 8,
    memoryAdjustedScreenSpaceError: 8, globeVisible: true, requestTimingAvailable: false,
    tileFetchesLast5Seconds: 0, totalTileFetches: 0, networkTileFetches: 0,
    browserCacheTileFetches: 0, unknownTileFetches: 0,
  } });
  try {
    act(() => root.render(<DeveloperOverlay session={{ setDiagnosticsEnabled: () => {} } as unknown as SimSession} />));
    const pacing = container.querySelector('[aria-label="Frame pacing"]');
    expect(pacing?.textContent).toContain('20.0 / 80.0 / 80.0 ms');
    expect(pacing?.textContent).toContain('Contact preparation (1)12.00 / 12.00 / 12.00');
    expect(pacing?.textContent).toContain('GPU timing, browser layout and asynchronous tile/model loading are not measured.');
  } finally {
    act(() => root.unmount());
    useStore.setState({ diagnosticsVisible: false, renderDiagnostics: null });
    vi.unstubAllGlobals();
  }
});
