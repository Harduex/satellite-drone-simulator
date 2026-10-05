import { TRAFFIC, ROAD_SPEED } from "./TrafficConfig";
import type { Point3, RoadEdge, RoadGraph, RoadSegment } from "./TrafficTypes";

export function buildRoadGraph(
  segments: readonly RoadSegment[],
  center: Point3,
): RoadGraph {
  const edges = new Map<string, RoadEdge>();
  const nodes = new Map<string, Point3[]>();
  const pointKey = (point: Point3, topology: string): string => {
    const x = Math.floor(point.x),
      y = Math.floor(point.y);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        for (const other of nodes.get(`${x + dx},${y + dy}:${topology}`) ?? [])
          if (Math.hypot(point.x - other.x, point.y - other.y) < 1)
            return `${other.x.toFixed(3)},${other.y.toFixed(3)}`;
      }
    const key = `${x},${y}:${topology}`,
      cell = nodes.get(key) ?? [];
    cell.push(point);
    nodes.set(key, cell);
    return `${point.x.toFixed(3)},${point.y.toFixed(3)}`;
  };
  const candidates: {
    road: RoadSegment;
    a: Point3;
    b: Point3;
    distance: number;
  }[] = [];
  for (const road of segments)
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1]!,
        b = road.points[i]!;
      const distance = Math.hypot(
        (a.x + b.x) / 2 - center.x,
        (a.y + b.y) / 2 - center.y,
      );
      if (distance < TRAFFIC.preload + 100)
        candidates.push({ road, a, b, distance });
    }
  candidates.sort(
    (a, b) =>
      a.distance - b.distance ||
      ROAD_SPEED[b.road.roadClass] - ROAD_SPEED[a.road.roadClass],
  );
  for (const { road, a, b } of candidates) {
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 1) continue;
    for (const direction of road.oneway === 0 ? [1, -1] : [road.oneway]) {
      const from = direction === 1 ? a : b,
        to = direction === 1 ? b : a;
      const topology = `${road.layer}:${road.bridge ? "bridge" : "ground"}`;
      const start = `${pointKey(from, topology)}:${topology}`,
        end = `${pointKey(to, topology)}:${topology}`;
      const id = `${from.x.toFixed(3)},${from.y.toFixed(3)}:${topology}>${to.x.toFixed(3)},${to.y.toFixed(3)}:${topology}`;
      if (edges.has(id) || edges.size >= TRAFFIC.edges) continue;
      const offset = road.oneway === 0 ? 1.6 : 0;
      const ox = ((to.y - from.y) / length) * offset,
        oy = (-(to.x - from.x) / length) * offset;
      edges.set(id, {
        id,
        start,
        end,
        length,
        roadClass: road.roadClass,
        bridge: road.bridge,
        layer: road.layer,
        points: [
          { x: from.x + ox, y: from.y + oy, z: from.z },
          { x: to.x + ox, y: to.y + oy, z: to.z },
        ],
        outgoing: [],
      });
    }
  }
  const starts = new Map<string, RoadEdge[]>();
  for (const edge of edges.values()) {
    const list = starts.get(edge.start) ?? [];
    list.push(edge);
    starts.set(edge.start, list);
  }
  for (const edge of edges.values())
    edge.outgoing = (starts.get(edge.end) ?? [])
      .filter((next) => next.end !== edge.start)
      .map((next) => next.id);
  return { edges };
}
export function poseOnEdge(
  edge: RoadEdge,
  distance: number,
): { position: Point3; heading: number; pitch: number } {
  let remaining = Math.max(0, Math.min(edge.length, distance));
  for (let i = 1; i < edge.points.length; i++) {
    const a = edge.points[i - 1]!,
      b = edge.points[i]!,
      span = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= span || i === edge.points.length - 1) {
      const fraction = span > 0 ? Math.min(1, remaining / span) : 0;
      return {
        position: {
          x: a.x + (b.x - a.x) * fraction,
          y: a.y + (b.y - a.y) * fraction,
          z: a.z + (b.z - a.z) * fraction,
        },
        heading: Math.atan2(b.x - a.x, b.y - a.y),
        pitch: Math.atan2(b.z - a.z, span),
      };
    }
    remaining -= span;
  }
  return { position: { ...edge.points[0]! }, heading: 0, pitch: 0 };
}
