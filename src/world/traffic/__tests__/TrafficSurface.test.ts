import { expect, it } from "vitest";
import { TrafficSurface } from "../TrafficSurface";
import { buildRoadGraph } from "../../../traffic/RoadGraph";
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
