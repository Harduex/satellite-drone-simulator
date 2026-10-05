import { expect, it } from 'vitest';
import { buildRoadGraph } from '../RoadGraph';
import type { RoadSegment } from '../TrafficTypes';
const road = (id: string, layer = 0): RoadSegment => ({ id, roadClass: 'minor', oneway: 0, bridge: layer !== 0, layer,
  points: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 100, z: 0 }] });
it('deduplicates buffered roads and separates opposing traffic', () => {
  const graph = buildRoadGraph([road('a'), road('b')], { x: 0, y: 0, z: 0 });
  expect(graph.edges.size).toBe(2);
  const lanes = [...graph.edges.values()];
  expect(lanes[0]!.points[0]!.x).toBeCloseTo(1.6);
  expect(lanes[1]!.points[0]!.x).toBeCloseTo(-1.6);
});
it('does not connect a grade separated crossing', () => {
  const bridge = road('bridge', 1); bridge.points = [{ x: 0, y: 100, z: 0 }, { x: 100, y: 100, z: 0 }];
  const graph = buildRoadGraph([road('a'), bridge], { x: 0, y: 0, z: 0 });
  expect([...graph.edges.values()].every(e => e.outgoing.length === 0)).toBe(true);
});
