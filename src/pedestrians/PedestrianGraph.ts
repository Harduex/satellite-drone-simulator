import type { Point3 } from '../traffic/TrafficTypes';
import type { WalkingGraph, WalkingPath } from './PedestrianTypes';
import { PEDESTRIANS } from './PedestrianConfig';
export function buildPedestrianGraph(paths: readonly WalkingPath[], center: Point3): WalkingGraph {
    const edges: WalkingGraph['edges'] = new Map();
    const candidates: {
        path: WalkingPath;
        a: Point3;
        b: Point3;
        distance: number;
    }[] = [];
    for (const path of paths)
        for (let i = 1; i < path.points.length; i++) {
            if (candidates.length >= PEDESTRIANS.candidateSpans)
                break;
            const a = path.points[i - 1]!, b = path.points[i]!, distance = Math.hypot((a.x + b.x) / 2 - center.x, (a.y + b.y) / 2 - center.y);
            if (distance < PEDESTRIANS.preload)
                candidates.push({ path, a, b, distance });
        }
    candidates.sort((a, b) => a.distance - b.distance);
    const pointKey = (p: Point3) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    for (const { path, a, b } of candidates) {
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        if (length < 1)
            continue;
        for (const [from, to] of [[a, b], [b, a]]) {
            const start = pointKey(from!), end = pointKey(to!), id = `${start}>${end}`;
            if (edges.has(id) || edges.size >= PEDESTRIANS.edges)
                continue;
            edges.set(id, { id, start, end, length, points: [{ ...from! }, { ...to! }], bridge: false, layer: 0, outgoing: [], pathClass: path.pathClass });
        }
    }
    const starts = new Map<string, string[]>();
    for (const edge of edges.values()) {
        const list = starts.get(edge.start) ?? [];
        list.push(edge.id);
        starts.set(edge.start, list);
    }
    for (const edge of edges.values())
        edge.outgoing = (starts.get(edge.end) ?? []).filter(id => edges.get(id)!.end !== edge.start);
    return { edges };
}
