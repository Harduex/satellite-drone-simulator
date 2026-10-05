import { afterEach, expect, it, vi } from "vitest";
import { SimSession } from "../SimSession";
import { useStore } from "../../store";
import type { CesiumManager } from "../../world/CesiumManager";

const recording = vi.hoisted(() => ({
  stop: vi.fn(async () => {}),
  pause: vi.fn(),
  resume: vi.fn(),
}));
vi.mock("../FlightRecorder", () => ({
  FlightRecorder: class {
    constructor() {
      return recording;
    }
  },
}));
vi.mock("../../world/TileLoader", () => ({
  TileLoader: class {
    setCacheOnlyPractice() {}
  },
}));
afterEach(() => {
  vi.clearAllMocks();
  useStore.setState({ phase: "PICKER" });
});

function fixture() {
  const world = {
    getViewer: vi.fn(() => ({})),
    teardownGlobeToggle: vi.fn(),
    hideContainer: vi.fn(),
    setEnvironmentOptions: vi.fn(),
    setEnvironmentPaused: vi.fn(),
  };
  const session = new SimSession(world as unknown as CesiumManager);
  const loop = { start: vi.fn(), stop: vi.fn(), applyStoreSettings: vi.fn() };
  const traffic = { pause: vi.fn(), resume: vi.fn(), dispose: vi.fn() };
  const pedestrians = { pause: vi.fn(), resume: vi.fn(), dispose: vi.fn() };
  const subscriptionCleanup = vi.fn();
  Object.assign(session, {
    gameLoop: loop,
    traffic,
    pedestrians,
    trafficSettingsCleanup: subscriptionCleanup,
    droneAudio: { dispose: vi.fn() },
  });
  return { session, loop, traffic, pedestrians, subscriptionCleanup };
}

it("freezes traffic before pausing flight and resumes it after restarting the loop", async () => {
  const f = fixture();
  useStore.setState({ phase: "FLYING" });
  f.session.pause();
  expect(f.pedestrians.pause).toHaveBeenCalledOnce();
  expect(f.traffic.pause.mock.invocationCallOrder[0]).toBeLessThan(
    f.loop.stop.mock.invocationCallOrder[0]!,
  );
  expect(useStore.getState().phase).toBe("PAUSED");
  f.session.resume();
  expect(f.pedestrians.resume).toHaveBeenCalledOnce();
  expect(f.loop.start.mock.invocationCallOrder[0]).toBeLessThan(
    f.traffic.resume.mock.invocationCallOrder[0]!,
  );
  expect(useStore.getState().phase).toBe("FLYING");
  await f.session.endSession();
});

it("keeps traffic credits alive until recording finalizes and disposes once", async () => {
  const f = fixture();
  let release!: () => void;
  recording.stop.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const first = f.session.endSession(),
    second = f.session.endSession();
  expect(f.traffic.pause).toHaveBeenCalledOnce();
  expect(f.subscriptionCleanup).toHaveBeenCalledOnce();
  expect(f.traffic.dispose).not.toHaveBeenCalled();
  expect(f.pedestrians.dispose).not.toHaveBeenCalled();
  release();
  await Promise.all([first, second]);
  expect(f.traffic.dispose).toHaveBeenCalledOnce();
  expect(f.pedestrians.dispose).toHaveBeenCalledOnce();
  expect(recording.stop).toHaveBeenCalledOnce();
});
