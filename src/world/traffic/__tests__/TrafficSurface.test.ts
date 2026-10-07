import { expect, it } from "vitest";
import { TrafficSurface } from "../TrafficSurface";
import { buildRoadGraph } from "../../../traffic/RoadGraph";
it("validates an initially missing surface after its 3D tiles become available", () => {
  const graph = buildRoadGraph([{ id: "late", roadClass: "minor", oneway: 1,
    bridge: false, layer: 0, points: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 50, z: 0 }],
  }], { x: 0, y: 0, z: 0 });
  let now = 0;
  let loaded = false;
  const surface = new TrafficSurface(() => loaded ? 0 : undefined, () => now);
  surface.prepare(graph);
  for (now = 0; now <= 3000; now += 1000) surface.processFrame();
  expect(surface.getValidatedGraph().edges.size).toBe(0);
  loaded = true;
  for (now = 10000; now <= 20000; now += 1000) surface.processFrame();
  expect(surface.getValidatedGraph().edges.size).toBe(1);
  expect(surface.rejectedRoads).toBe(0);
});
it("keeps completed stations while waiting for another part of a path to load", () => {
  const graph = buildRoadGraph([{ id: "partial", roadClass: "minor", oneway: 1,
    bridge: false, layer: 0, points: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 50, z: 0 }],
  }], { x: 0, y: 0, z: 0 });
  let now = 0;
  let firstStationSamples = 0;
  const surface = new TrafficSurface(point => {
    if (point.y === 0) firstStationSamples++;
    return point.y === 0 || now >= 10000 ? 0 : undefined;
  }, () => now, { samples: 8, ms: 2, spacing: 25, lateral: 0 });
  surface.prepare(graph);
  for (now = 0; now <= 20000; now += 1000) surface.processFrame();
  expect(surface.getValidatedGraph().edges.size).toBe(1);
  expect(firstStationSamples).toBe(1);
});
it("sleeps a fully deferred queue until its next retry instead of scanning it each frame", () => {
  const graph = buildRoadGraph([{ id: "waiting", roadClass: "minor", oneway: 1,
    bridge: false, layer: 0, points: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 50, z: 0 }],
  }], { x: 0, y: 0, z: 0 });
  const template = [...graph.edges.values()][0]!;
  const edges = new Map(Array.from({ length: 1000 }, (_, i) => [String(i), { ...template, id: String(i) }]));
  let now = 0, clockReads = 0;
  const surface = new TrafficSurface(() => undefined, () => { clockReads++; return now; },
    { samples: 1000, ms: 2, spacing: 25, lateral: 0 });
  surface.prepare({ edges });
  surface.processFrame();
  surface.processFrame();
  now = 500;
  clockReads = 0;
  surface.processFrame();
  expect(clockReads).toBeLessThan(10);
  expect(surface.samples).toBe(0);
  expect(surface.pending).toBe(1000);
});
it("bounds surface work and refuses missing or discontinuous roads", () => {
  const graph = buildRoadGraph(
    [
      {
        id: "a",
        roadClass: "minor",
        oneway: 1,
        bridge: false,
        layer: 0,
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 200, z: 0 },
        ],
      },
    ],
    { x: 0, y: 0, z: 0 },
  );
  let calls = 0;
  const surface = new TrafficSurface(
    (p) => {
      calls++;
      return p.y > 50 ? 100 : 0;
    },
    () => 0,
  );
  surface.prepare(graph);
  surface.processFrame();
  expect(calls).toBeLessThanOrEqual(8);
  for (let i = 0; i < 5; i++) surface.processFrame();
  expect(surface.getValidatedGraph().edges.size).toBe(0);
  const missing = new TrafficSurface(
    () => undefined,
    () => 0,
  );
  missing.prepare(graph);
  for (let i = 0; i < 5; i++) missing.processFrame();
  expect(missing.getValidatedGraph().edges.size).toBe(0);
});
it("admits a plausible bridge deck with interpolated road stations", () => {
  const graph = buildRoadGraph(
    [
      {
        id: "a",
        roadClass: "primary",
        oneway: 1,
        bridge: true,
        layer: 1,
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 100, z: 0 },
        ],
      },
    ],
    { x: 0, y: 0, z: 0 },
  );
  const surface = new TrafficSurface(
    (p) => 5 + p.y * 0.02,
    () => 0,
  );
  surface.prepare(graph);
  for (let i = 0; i < 4; i++) surface.processFrame();
  const edge = [...surface.getValidatedGraph().edges.values()][0]!;
  expect(edge.points.length).toBe(5);
  expect(edge.points[4]!.z).toBeCloseTo(7);
});
it("rejects a sharp grade reversal even when each slope is below the grade cap", () => {
  const graph = buildRoadGraph(
    [
      {
        id: "a",
        roadClass: "minor",
        oneway: 1,
        bridge: false,
        layer: 0,
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 100, z: 0 },
        ],
      },
    ],
    { x: 0, y: 0, z: 0 },
  );
  const surface = new TrafficSurface(
    (p) => (p.y <= 50 ? p.y * 0.15 : 15 - p.y * 0.15),
    () => 0,
  );
  surface.prepare(graph);
  for (let i = 0; i < 4; i++) surface.processFrame();
  expect(surface.getValidatedGraph().edges.size).toBe(0);
});
it("stops waiting for a continuation once its surface is rejected", () => {
  const graph = buildRoadGraph(
    [
      {
        id: "a",
        roadClass: "minor",
        oneway: 1,
        bridge: false,
        layer: 0,
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 100, z: 0 },
          { x: 0, y: 200, z: 0 },
        ],
      },
    ],
    { x: 0, y: 0, z: 0 },
  );
  const surface = new TrafficSurface(
    (p) => (p.y <= 100 ? 0 : 100),
    () => 0,
  );
  surface.prepare(graph);
  for (let i = 0; i < 8; i++) surface.processFrame();
  const edge = [...surface.getValidatedGraph().edges.values()][0]!;
  expect(edge.outgoing).toEqual([]);
  expect(edge.pendingContinuation).toBe(false);
});
it("rejects a rooftop ridge above the neighboring ordinary-road surface", () => {
  const graph = buildRoadGraph(
    [
      {
        id: "roof",
        roadClass: "minor",
        oneway: 1,
        bridge: false,
        layer: 0,
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 100, z: 0 },
        ],
      },
    ],
    { x: 0, y: 0, z: 0 },
  );
  const surface = new TrafficSurface(
    (p) => (Math.abs(p.x) < 3 ? 30 : 0),
    () => 0,
  );
  surface.prepare(graph);
  for (let i = 0; i < 8; i++) surface.processFrame();
  expect(surface.getValidatedGraph().edges.size).toBe(0);
  expect(surface.rejectedRoads).toBe(1);
});
