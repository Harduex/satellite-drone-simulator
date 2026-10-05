import { expect, it, vi } from "vitest";
import * as Cesium from "cesium";
import { TrafficController, advanceTrafficTime } from "../TrafficController";
import { TrafficRenderer } from "../../world/traffic/TrafficRenderer";
import { RoadSource } from "../../traffic/RoadSource";
it("refreshes road coverage around the moving drone beyond the initial area", async () => {
  const load = vi.spyOn(RoadSource.prototype, "loadTiles").mockResolvedValue([]);
  let now = 0;
  const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
  const event = new Cesium.Event();
  const position = { x: 0, y: 0, z: 100 };
  const viewer = {
    scene: { preUpdate: event, sampleHeightSupported: false },
    creditDisplay: { addStaticCredit: vi.fn(), removeStaticCredit: vi.fn() },
  } as unknown as Cesium.Viewer;
  const controller = new TrafficController({
    viewer,
    enuFrame: Cesium.Transforms.eastNorthUpToFixedFrame(
      Cesium.Cartesian3.fromDegrees(2.2945, 48.8584),
    ),
    spawn: { ...position }, longitude: 2.2945,
    readDronePosition: () => position,
    readEnvironmentInstant: () => new Date("2026-10-05T12:00:00Z"),
    readBaseExclusions: () => [], exclusionsChanged: () => {},
    publish: () => {}, diagnosticsEnabled: () => false,
  });
  try {
    controller.setEnabled(true);
    controller.start();
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);
    const initialTiles = load.mock.calls[0]![0];
    position.x = 299;
    now = 1000;
    event.raiseEvent();
    expect(load).toHaveBeenCalledTimes(1);
    position.x = 301;
    now = 1200;
    event.raiseEvent();
    expect(load).toHaveBeenCalledTimes(1);
    position.x = 500;
    now = 1501;
    event.raiseEvent();
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(2);
    await Promise.resolve();
    position.x = 2700;
    now = 2000;
    event.raiseEvent();
    now = 2301;
    event.raiseEvent();
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(3);
    expect(load.mock.calls[2]![0]).not.toEqual(initialTiles);
    expect(load.mock.calls[2]![0].length).toBeLessThanOrEqual(16);
    now = 10000;
    event.raiseEvent();
    expect(load).toHaveBeenCalledTimes(3);
  } finally {
    controller.dispose();
    load.mockRestore();
    clock.mockRestore();
  }
});
it.each([30, 60, 120])(
  "preserves ten-second traffic cadence at %i render Hz",
  (frequency) => {
    let accumulator = 0,
      steps = 0;
    for (let i = 0; i < frequency * 10; i++) {
      const clock = advanceTrafficTime(accumulator, 1 / frequency);
      accumulator = clock.remainder;
      steps += clock.steps;
    }
    expect(steps).toBe(100);
    expect(accumulator).toBeCloseTo(0);
  },
);
it("limits long-stall traffic work and preserves fractional steps", () => {
  expect(advanceTrafficTime(0.03, 0.08)).toEqual({
    steps: 1,
    remainder: expect.closeTo(0.01),
  });
  expect(advanceTrafficTime(0, 10).steps).toBe(2);
  expect(advanceTrafficTime(0, 10).remainder).toBeLessThan(0.1);
  expect(advanceTrafficTime(0, 0)).toEqual({ steps: 0, remainder: 0 });
});
it("pause/off/dispose release requests and callbacks without resurrecting late work", async () => {
  const exposure = vi.spyOn(TrafficRenderer.prototype, "setEnvironmentExposure");
  const event = new Cesium.Event();
  const credits = new Set<Cesium.Credit>();
  const viewer = {
    scene: { preUpdate: event, sampleHeightSupported: false },
    creditDisplay: {
      addStaticCredit: (credit: Cesium.Credit) => credits.add(credit),
      removeStaticCredit: (credit: Cesium.Credit) => credits.delete(credit),
    },
  } as unknown as Cesium.Viewer;
  const pending: {
    signal: AbortSignal | null | undefined;
    resolve: (value: Response) => void;
  }[] = [];
  vi.stubGlobal(
    "fetch",
    (_input: unknown, init?: RequestInit) =>
      new Promise<Response>((resolve) =>
        pending.push({ signal: init?.signal, resolve }),
      ),
  );
  const published: unknown[] = [];
  const controller = new TrafficController({
    viewer,
    enuFrame: Cesium.Transforms.eastNorthUpToFixedFrame(
      Cesium.Cartesian3.fromDegrees(0, 0),
    ),
    spawn: { x: 0, y: 0, z: 0 },
    longitude: 0,
    readDronePosition: () => ({ x: 0, y: 0, z: 0 }),
    readEnvironmentInstant: () => new Date(),
    readBaseExclusions: () => [],
    exclusionsChanged: () => {},
    publish: (value) => published.push(value),
    diagnosticsEnabled: () => true,
  });
  try {
    controller.setEnvironmentExposure(0.025);
    controller.setEnabled(true);
    expect(pending.length).toBe(0);
    controller.start();
    expect(event.numberOfListeners).toBe(1);
    expect(credits.size).toBe(1);
    expect(exposure).toHaveBeenLastCalledWith(0.025);
    controller.reset();
    expect(exposure).toHaveBeenLastCalledWith(0.025);
    await Promise.resolve();
    expect(pending.length).toBe(1);
    controller.pause();
    expect(pending[0]!.signal!.aborted).toBe(true);
    controller.setEnabled(false);
    expect(credits.size).toBe(0);
    controller.setEnvironmentExposure(0.4);
    controller.setEnabled(true);
    expect(credits.size).toBe(0);
    controller.resume();
    expect(exposure).toHaveBeenLastCalledWith(0.4);
    controller.setEnabled(false);
    controller.dispose();
    expect(event.numberOfListeners).toBe(0);
    pending[0]!.resolve(
      new Response(
        JSON.stringify({
          tiles: ["https://tiles.openfreemap.org/v/{z}/{x}/{y}.pbf"],
        }),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    event.raiseEvent();
    expect(pending.length).toBe(1);
    expect(credits.size).toBe(0);
    expect(published.at(-1)).toBeNull();
    controller.dispose();
  } finally {
    controller.dispose();
    vi.unstubAllGlobals();
    exposure.mockRestore();
  }
});
