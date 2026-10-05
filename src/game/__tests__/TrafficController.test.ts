import { expect, it, vi } from "vitest";
import * as Cesium from "cesium";
import { TrafficController, advanceTrafficTime } from "../TrafficController";
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
    controller.setEnabled(true);
    expect(pending.length).toBe(0);
    controller.start();
    expect(event.numberOfListeners).toBe(1);
    expect(credits.size).toBe(1);
    await Promise.resolve();
    expect(pending.length).toBe(1);
    controller.pause();
    expect(pending[0]!.signal!.aborted).toBe(true);
    controller.setEnabled(false);
    expect(credits.size).toBe(0);
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
  }
});
