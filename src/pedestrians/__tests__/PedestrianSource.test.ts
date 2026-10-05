import { expect, it } from 'vitest';
import { normalizePedestrianProperties, safePathSpans } from '../PedestrianSource';
import { buildPedestrianGraph } from '../PedestrianGraph';
it('admits only outdoor pedestrian lines with conservative access', () => {
    for (const subclass of ['footway', 'pedestrian'])
        expect(normalizePedestrianProperties({ class: 'path', subclass })).toMatchObject({ pathClass: subclass });
    expect(normalizePedestrianProperties({ class: 'path', subclass: 'path', foot: 'yes' })).not.toBeNull();
    for (const extra of [{ foot: 'private' }, { foot: false }, { access: 'no' }, { access: 'customers' }, { indoor: 1 }, { layer: 1 }, { level: -1 }, { level: 'unknown' }, { brunnel: 'bridge' }, { brunnel: 'tunnel' }])
        expect(normalizePedestrianProperties({ class: 'path', subclass: 'footway', ...extra })).toBeNull();
    for (const subclass of ['path', 'cycleway', 'steps', 'corridor', 'platform', 'unknown'])
        expect(normalizePedestrianProperties({ class: 'path', subclass })).toBeNull();
});
it('removes crossing and road-adjacent spans without inventing sidewalks', () => {
    const path = [{ x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }, { x: 40, y: 0, z: 0 }];
    const blockers = [[{ x: 10, y: -10, z: 0 }, { x: 10, y: 10, z: 0 }]];
    expect(safePathSpans(path, blockers)).toEqual([[path[1], path[2]]]);
    expect(safePathSpans(path, [[{ x: 0, y: 3, z: 0 }, { x: 40, y: 3, z: 0 }]])).toEqual([]);
    expect(safePathSpans(path, [[{ x: 0, y: 8, z: 0 }, { x: 40, y: 8, z: 0 }]])).toHaveLength(2);
});
it('caps and deduplicates centerline edges without car lane offsets', () => {
    const path = { id: 'p', pathClass: 'footway' as const, points: [{ x: 0, y: 0, z: 0 }, { x: 30, y: 0, z: 0 }] };
    const graph = buildPedestrianGraph([path, path], { x: 0, y: 0, z: 0 });
    expect(graph.edges.size).toBe(2);
    expect([...graph.edges.values()][0]!.points).toEqual(path.points);
    const far = buildPedestrianGraph([path], { x: 2000, y: 0, z: 0 });
    expect(far.edges.size).toBe(0);
});
