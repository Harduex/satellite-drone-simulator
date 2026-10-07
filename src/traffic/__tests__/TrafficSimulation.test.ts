import { expect, it } from "vitest";
import { TrafficSimulation, demandMultiplier } from "../TrafficSimulation";
import { buildRoadGraph, poseOnEdge } from "../RoadGraph";
import type { RoadEdge, VehicleFrame } from "../TrafficTypes";

function road(
  id: string,
  start: string,
  end: string,
  x: number,
  y: number,
  dx: number,
  dy: number,
  outgoing: string[],
  roadClass: RoadEdge["roadClass"] = "primary",
): RoadEdge {
  return {
    id,
    start,
    end,
    roadClass,
    bridge: false,
    layer: 0,
    points: [
      { x, y, z: 0 },
      { x: x + dx, y: y + dy, z: 0 },
    ],
    length: Math.hypot(dx, dy),
    outgoing,
  };
}
it("retires the old fleet and populates roads around a new flying area", () => {
  const simulation = new TrafficSimulation();
  const initial = road("initial", "a", "b", 0, -450, 0, 900, []);
  const destination = road("destination", "c", "d", 2500, -450, 0, 900, []);
  simulation.setGraph({ edges: new Map([[initial.id, initial]]) });
  simulation.reset({ x: 0, y: 0, z: 100 });
  const oldIds = simulation.getFrames().map(car => car.id);
  expect(oldIds.length).toBeGreaterThan(0);
  simulation.setCenter({ x: 2500, y: 0, z: 100 });
  simulation.step(0.1);
  expect(simulation.getFrames()).toHaveLength(0);
  simulation.setGraph({ edges: new Map([[destination.id, destination]]) });
  for (let i = 0; i < 200; i++) simulation.step(0.1);
  expect(simulation.getFrames().length).toBeGreaterThan(0);
  for (const car of simulation.getFrames()) {
    expect(oldIds).not.toContain(car.id);
    expect(car.edgeId).toBe("destination");
    expect(Math.hypot(car.current.position.x - 2500, car.current.position.y)).toBeLessThanOrEqual(1000);
  }
});
it("populates newly validated central streets within five seconds", () => {
  const simulation = new TrafficSimulation();
  simulation.setGraph({ edges: new Map() });
  simulation.reset({ x: 0, y: 0, z: 30 });
  const streets = Array.from({ length: 50 }, (_, i) => ({
    ...road(String(i), "a" + i, "b" + i, (i % 10) * 40 - 200,
      Math.floor(i / 10) * 40 - 100, 20, 0, [], "primary"),
    pendingContinuation: true,
  }));
  simulation.setGraph({ edges: new Map(streets.map(edge => [edge.id, edge])) });
  for (let i = 0; i < 50; i++) simulation.step(0.1);
  expect(simulation.getFrames().length).toBeGreaterThanOrEqual(18);
  expect(simulation.getFrames().length).toBeLessThanOrEqual(20);
});
it("allocates cars by road length and class rather than segment count", () => {
  const boulevard = road("boulevard", "a", "b", -500, -100, 1000, 0, [], "primary");
  const streets = Array.from({ length: 50 }, (_, i) =>
    road(String(i), "a" + i, "b" + i, (i % 10) * 40 - 200,
      Math.floor(i / 10) * 40 + 100, 20, 0, [], "minor"),
  );
  const simulation = new TrafficSimulation();
  simulation.setGraph({ edges: new Map([boulevard, ...streets].map(edge => [edge.id, edge])) });
  simulation.reset({ x: 0, y: 0, z: 30 });
  expect(simulation.getFrames()).toHaveLength(28);
  expect(simulation.getFrames().filter(car => car.edgeId === "boulevard").length)
    .toBeGreaterThanOrEqual(15);
});
function fleet(
  edges: RoadEdge[],
  placements: {
    edgeId: string;
    distance: number;
    speed: number;
    next: string | null;
  }[],
) {
  const simulation = new TrafficSimulation(42, [4.3]);
  const graph = { edges: new Map(edges.map((edge) => [edge.id, edge])) };
  simulation.setGraph(graph);
  simulation.reset({ x: 0, y: 0, z: 0 });
  const frames = simulation.getFrames() as VehicleFrame[];
  expect(frames.length).toBeGreaterThanOrEqual(placements.length);
  frames.splice(placements.length);
  // Fix demand so the regression describes these drivers, without random replacement traffic.
  Object.assign(simulation, { populationTarget: placements.length });
  placements.forEach((placement, i) =>
    Object.assign(frames[i]!, placement, {
      speedFactor: 1,
      entry: null,
      waiting: 0,
      current: poseOnEdge(
        graph.edges.get(placement.edgeId)!,
        placement.distance,
      ),
    }),
  );
  return { simulation, frames };
}
it.each([
  ["motorway", 28], ["trunk", 24], ["primary", 20],
  ["secondary", 16], ["tertiary", 12], ["minor", 8],
] as const)("populates a kilometre of %s at the denser target", (roadClass, count) => {
  const edges = Array.from({ length: 100 }, (_, i) =>
    road(String(i), "a" + i, "b" + i, (i % 10) * 40 - 200, Math.floor(i / 10) * 40 - 200, 10, 0, [], roadClass),
  );
  const simulation = new TrafficSimulation();
  simulation.setGraph({ edges: new Map(edges.map(edge => [edge.id, edge])) });
  simulation.reset({ x: 0, y: 0, z: 0 });
  expect(simulation.getFrames()).toHaveLength(count);
});
it("adopts the slower road speed before leaving a motorway", () => {
  const { simulation, frames } = fleet(
    [
      road("fast", "west", "join", -900, 0, 900, 0, ["slow"], "motorway"),
      road("slow", "join", "east", 0, 0, 900, 0, [], "minor"),
    ],
    [{ edgeId: "fast", distance: 750, speed: 26, next: "slow" }],
  );
  for (let i = 0; i < 200; i++) simulation.step(0.1);
  expect(frames[0]!.edgeId).toBe("slow");
  expect(frames[0]!.speed).toBeLessThanOrEqual(7.01);
});
it("brakes before the turn curve and stays slow through its exit", () => {
  const { simulation, frames } = fleet(
    [
      road("fast", "west", "join", -900, 0, 900, 0, ["turn"], "motorway"),
      road("turn", "join", "north", 0, 0, 0, 900, [], "motorway"),
    ],
    [{ edgeId: "fast", distance: 800, speed: 26, next: "turn" }],
  );
  let observed = 0;
  for (let i = 0; i < 150; i++) {
    simulation.step(0.1);
    const car = frames[0]!;
    if (
      (car.edgeId === "fast" && car.distance >= 892) ||
      (car.edgeId === "turn" && car.distance <= 8)
    ) {
      observed++;
      expect(car.speed).toBeLessThanOrEqual(5.01);
    }
  }
  expect(observed).toBeGreaterThan(10);
});
it("looks ahead through short segments before a motorway turn", () => {
  const edges = Array.from({ length: 90 }, (_, i) =>
    road(
      "s" + i,
      "n" + i,
      "n" + (i + 1),
      -900 + i * 10,
      0,
      10,
      0,
      [i === 89 ? "turn" : "s" + (i + 1)],
      "motorway",
    ),
  );
  edges.push(road("turn", "n90", "north", 0, 0, 0, 900, [], "motorway"));
  const { simulation, frames } = fleet(edges, [
    { edgeId: "s80", distance: 0, speed: 26, next: "s81" },
  ]);
  let observed = 0;
  for (let i = 0; i < 150; i++) {
    simulation.step(0.1);
    const car = frames[0]!;
    if (
      (car.edgeId === "s89" && car.distance >= 5) ||
      (car.edgeId === "turn" && car.distance <= 5)
    ) {
      observed++;
      expect(car.speed).toBeLessThanOrEqual(5.01);
    }
  }
  expect(observed).toBeGreaterThan(5);
});
it("keeps a blocked exit from admitting overlapping cross traffic", () => {
  const exit = road("east", "join", "end", 0, 0, 14, 0, []);
  exit.pendingContinuation = true;
  const { simulation, frames } = fleet(
    [
      road("west", "westEnd", "join", -900, 0, 900, 0, ["east"]),
      exit,
      road("south", "southEnd", "join", 0, -900, 0, 900, ["north"]),
      road("north", "join", "northEnd", 0, 0, 0, 900, []),
    ],
    [
      { edgeId: "west", distance: 899.9, speed: 1, next: "east" },
      { edgeId: "east", distance: 11, speed: 0, next: null },
      { edgeId: "south", distance: 890, speed: 0, next: "north" },
    ],
  );
  for (let i = 0; i < 100; i++) {
    simulation.step(0.1);
    const a = frames[0]!.current.position,
      b = frames[2]!.current.position;
    expect(Math.abs(a.x - b.x) >= 3.1 || Math.abs(a.y - b.y) >= 3.1).toBe(true);
  }
});
it("releases a junction only after clearing, so both crossing approaches progress", () => {
  const { simulation, frames } = fleet(
    [
      road("west", "westEnd", "join", -900, 0, 900, 0, ["east"]),
      road("east", "join", "eastEnd", 0, 0, 900, 0, []),
      road("south", "southEnd", "join", 0, -900, 0, 900, ["north"]),
      road("north", "join", "northEnd", 0, 0, 0, 900, []),
    ],
    [
      { edgeId: "west", distance: 850, speed: 16, next: "east" },
      { edgeId: "south", distance: 850, speed: 16, next: "north" },
    ],
  );
  for (let i = 0; i < 200; i++) {
    simulation.step(0.1);
    const a = frames[0]!.current.position,
      b = frames[1]!.current.position;
    expect(Math.abs(a.x - b.x) >= 3.1 || Math.abs(a.y - b.y) >= 3.1).toBe(true);
  }
  expect(frames[0]!.edgeId).toBe("east");
  expect(frames[1]!.edgeId).toBe("north");
});
it("demand follows noon and quiet nighttime without invalid multipliers", () => {
  expect(demandMultiplier(12)).toBe(1);
  expect(demandMultiplier(2)).toBe(0.35);
  expect(demandMultiplier(NaN)).toBe(1);
});
it("fills but never exceeds the 300-car ceiling on abundant roads", () => {
  const roads = Array.from({ length: 28 }, (_, row) => ({
    id: "row" + row,
    roadClass: "motorway" as const,
    oneway: 1 as const,
    bridge: false,
    layer: 0,
    points: [
      { x: -900, y: row * 20 - 270, z: 0 },
      { x: 900, y: row * 20 - 270, z: 0 },
    ],
  }));
  const simulation = new TrafficSimulation(42);
  simulation.setGraph(buildRoadGraph(roads, { x: 0, y: 0, z: 0 }));
  simulation.reset({ x: 0, y: 0, z: 0 });
  expect(simulation.getFrames()).toHaveLength(300);
  expect(new Set(simulation.getFrames().map(car => car.modelIndex))).toEqual(new Set([0, 1, 2, 3, 4]));
  for (let i = 0; i < 100; i++) {
    simulation.step(0.1);
    expect(simulation.getFrames().length).toBeLessThanOrEqual(300);
  }
});
it("brakes for a leader immediately across an edge boundary", () => {
  const graph = buildRoadGraph(
    [
      {
        id: "a",
        roadClass: "motorway",
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
  const simulation = new TrafficSimulation(42);
  simulation.setGraph(graph);
  simulation.reset({ x: 0, y: 0, z: 0 });
  const frames = simulation.getFrames() as VehicleFrame[];
  expect(frames.length).toBeGreaterThanOrEqual(2);
  const edges = [...graph.edges.values()];
  frames[0]!.edgeId = edges[0]!.id;
  frames[0]!.distance = 94;
  frames[0]!.speed = 10;
  frames[1]!.edgeId = edges[1]!.id;
  frames[1]!.distance = 2;
  frames[1]!.speed = 0;
  for (const car of frames.slice(2)) {
    car.edgeId = edges[1]!.id;
    car.distance = 90;
  }
  simulation.step(0.1);
  expect(frames[0]!.speed).toBeLessThan(10);
  expect(frames[0]!.distance).toBeLessThan(100);
});
it("preserves seeded cars across graph refresh and respects the population cap", () => {
  const graph = buildRoadGraph(
    [
      {
        id: "a",
        roadClass: "motorway",
        oneway: 1,
        bridge: false,
        layer: 0,
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 900, z: 0 },
        ],
      },
    ],
    { x: 0, y: 0, z: 0 },
  );
  const a = new TrafficSimulation(42, [4.3, 4, 4.6]),
    b = new TrafficSimulation(42, [4.3, 4, 4.6]);
  for (const simulation of [a, b]) {
    simulation.setGraph(graph);
    simulation.reset({ x: 0, y: 0, z: 0 });
  }
  expect(a.getFrames()).toEqual(b.getFrames());
  const ids = a.getFrames().map((f) => f.id);
  a.setGraph(graph);
  expect(a.getFrames().map((f) => f.id)).toEqual(ids);
  for (let i = 0; i < 100; i++) a.step(0.1);
  expect(a.getFrames().length).toBeLessThanOrEqual(300);
});
it("traverses multiple short continuation edges without exceeding their length", () => {
  const points = Array.from({ length: 101 }, (_, i) => ({ x: 0, y: i, z: 0 }));
  const graph = buildRoadGraph(
    [
      {
        id: "a",
        roadClass: "motorway",
        oneway: 1,
        bridge: false,
        layer: 0,
        points,
      },
    ],
    { x: 0, y: 0, z: 0 },
  );
  const simulation = new TrafficSimulation();
  simulation.setGraph(graph);
  simulation.reset({ x: 0, y: 0, z: 0 });
  const car = simulation.getFrames()[0]!;
  expect(car).toBeDefined();
  car.speed = 20;
  simulation.step(0.1);
  expect(car.distance).toBeLessThanOrEqual(graph.edges.get(car.edgeId)!.length);
});
it("keeps turn positions and headings continuous across offset lanes", () => {
  const graph = buildRoadGraph(
    [
      {
        id: "turn",
        roadClass: "minor",
        oneway: 0,
        bridge: false,
        layer: 0,
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 100, z: 0 },
          { x: 100, y: 100, z: 0 },
        ],
      },
    ],
    { x: 0, y: 0, z: 0 },
  );
  const simulation = new TrafficSimulation();
  simulation.setGraph(graph);
  simulation.reset({ x: 0, y: 0, z: 0 });
  const frames = simulation.getFrames() as VehicleFrame[],
    car = frames[0]!;
  frames.splice(1);
  const edge = [...graph.edges.values()].find(
    (edge) => edge.points[0]!.y === 0,
  )!;
  car.edgeId = edge.id;
  car.distance = 80;
  car.speed = 5;
  car.current = poseOnEdge(edge, 80);
  for (let i = 0; i < 60; i++) {
    const before = car.current;
    simulation.step(0.1);
    expect(
      Math.hypot(
        car.current.position.x - before.position.x,
        car.current.position.y - before.position.y,
      ),
    ).toBeLessThan(1.1);
    const delta = Math.atan2(
      Math.sin(car.current.heading - before.heading),
      Math.cos(car.current.heading - before.heading),
    );
    expect(Math.abs(delta)).toBeLessThan(0.25);
  }
});
it("does not spawn overlapping bodies on connected straight segments", () => {
  const graph = buildRoadGraph(
    [
      {
        id: "a",
        roadClass: "motorway",
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
  for (let seed = 0; seed < 100; seed++) {
    const simulation = new TrafficSimulation(seed);
    simulation.setGraph(graph);
    simulation.reset({ x: 0, y: 0, z: 0 });
    const frames = simulation.getFrames();
    for (let i = 0; i < frames.length; i++)
      for (let j = i + 1; j < frames.length; j++) {
        const a = frames[i]!,
          b = frames[j]!;
        expect(
          Math.abs(a.current.position.y - b.current.position.y),
        ).toBeGreaterThanOrEqual((a.length + b.length) / 2 + 2);
      }
  }
});
it("does not make opposing lanes yield at ordinary continuation vertices", () => {
  const graph = buildRoadGraph(
    [
      {
        id: "a",
        roadClass: "motorway",
        oneway: 0,
        bridge: false,
        layer: 0,
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 100, z: 0 },
          { x: 0, y: 200, z: 0 },
        ],
      },
    ],
    { x: 0, y: 100, z: 0 },
  );
  const simulation = new TrafficSimulation();
  simulation.setGraph(graph);
  simulation.reset({ x: 0, y: 100, z: 0 });
  const frames = simulation.getFrames() as VehicleFrame[];
  frames.splice(2);
  const incoming = [...graph.edges.values()].filter(
    (edge) => edge.points.at(-1)!.y === 100,
  );
  expect(frames.length).toBe(2);
  for (let i = 0; i < 2; i++) {
    const car = frames[i]!,
      edge = incoming[i]!;
    car.edgeId = edge.id;
    car.distance = 80;
    car.speed = 5;
    car.current = poseOnEdge(edge, 80);
  }
  for (let i = 0; i < 20; i++) simulation.step(0.1);
  expect(frames[0]!.speed).toBeCloseTo(frames[1]!.speed);
});
