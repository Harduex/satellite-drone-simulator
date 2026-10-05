// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { DeveloperOverlay } from "../DeveloperOverlay";
import { useStore } from "../../../store";
import type { SimSession } from "../../../game/SimSession";

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
