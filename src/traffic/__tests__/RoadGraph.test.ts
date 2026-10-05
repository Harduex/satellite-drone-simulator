import { expect, it } from "vitest";
import { buildRoadGraph } from "../RoadGraph";
import type { RoadSegment } from "../TrafficTypes";
const road = (id: string, layer = 0): RoadSegment => ({
  id,
  roadClass: "minor",
  oneway: 0,
  bridge: layer !== 0,
  layer,
  points: [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 100, z: 0 },
  ],
});
it("caps a dense admitted network at 2500 directed edges", () => {
  const roads = Array.from({ length: 26 }, (_, row) => ({
    ...road("row" + row),
    oneway: 1 as const,
    points: Array.from({ length: 101 }, (_, x) => ({ x, y: row * 2, z: 0 })),
  }));
  const graph = buildRoadGraph(roads, { x: 50, y: 25, z: 0 });
  expect(graph.edges.size).toBe(2500);
  const ids = new Set(graph.edges.keys());
  expect(
    [...graph.edges.values()].every((edge) =>
      edge.outgoing.every((id) => ids.has(id)),
    ),
  ).toBe(true);
});
it("deduplicates buffered roads and separates opposing traffic", () => {
  const graph = buildRoadGraph([road("a"), road("b")], { x: 0, y: 0, z: 0 });
  expect(graph.edges.size).toBe(2);
  const lanes = [...graph.edges.values()];
  expect(lanes[0]!.points[0]!.x).toBeCloseTo(1.6);
  expect(lanes[1]!.points[0]!.x).toBeCloseTo(-1.6);
});
it("does not connect a grade separated crossing", () => {
  const bridge = road("bridge", 1);
  bridge.points = [
    { x: 0, y: 100, z: 0 },
    { x: 100, y: 100, z: 0 },
  ];
  const graph = buildRoadGraph([road("a"), bridge], { x: 0, y: 0, z: 0 });
  expect([...graph.edges.values()].every((e) => e.outgoing.length === 0)).toBe(
    true,
  );
});
it("snaps compatible endpoints across rounding-cell boundaries", () => {
  const first = {
    ...road("a"),
    oneway: 1 as const,
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 0.49, y: 100, z: 0 },
    ],
  };
  const second = {
    ...road("b"),
    oneway: 1 as const,
    points: [
      { x: 0.51, y: 100, z: 0 },
      { x: 0, y: 200, z: 0 },
    ],
  };
  const graph = buildRoadGraph([first, second], { x: 0, y: 0, z: 0 });
  expect(
    [...graph.edges.values()].find((edge) => edge.outgoing.length === 1),
  ).toBeDefined();
});
it("preserves road identities when coverage priorities change", () => {
  const roads = [
    {
      ...road("a"),
      oneway: 1 as const,
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 0.49, y: 100, z: 0 },
      ],
    },
    {
      ...road("b"),
      oneway: 1 as const,
      points: [
        { x: 0.51, y: 100, z: 0 },
        { x: 0, y: 200, z: 0 },
      ],
    },
  ];
  const before = buildRoadGraph(roads, { x: 0, y: 0, z: 0 }),
    after = buildRoadGraph(roads, { x: 0, y: 200, z: 0 });
  expect([...after.edges.keys()].sort()).toEqual(
    [...before.edges.keys()].sort(),
  );
});
