import { VectorTileLayer } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { clipRoadLine, validateRoadTileGeometry } from '../traffic/RoadSource';
import type { GeoPoint, Point3, TileKey } from '../traffic/TrafficTypes';
import type { WalkingPath } from './PedestrianTypes';
import { PEDESTRIANS } from './PedestrianConfig';
export function normalizePedestrianProperties(p: Record<string, unknown>): Omit<WalkingPath, 'id' | 'points'> | null {
    const allowedFoot = ['yes', 'designated', 'permissive'];
    if (p.class !== 'path' || !['footway', 'pedestrian', 'path'].includes(String(p.subclass)) ||
        (p.subclass === 'path' && !allowedFoot.includes(String(p.foot))) ||
        (p.foot !== undefined && !allowedFoot.includes(String(p.foot))) ||
        (p.access !== undefined && !['yes', 'permissive', 'designated'].includes(String(p.access))) ||
        p.brunnel !== undefined || (p.indoor !== undefined && p.indoor !== 0 && p.indoor !== '0') ||
        (p.layer !== undefined && p.layer !== 0 && p.layer !== '0') ||
        (p.level !== undefined && p.level !== 0 && p.level !== '0'))
        return null;
    return { pathClass: p.subclass as WalkingPath['pathClass'] };
}
function pointDistanceSq(p: Point3, a: Point3, b: Point3): number {
    const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
    return (p.x - a.x - dx * t) ** 2 + (p.y - a.y - dy * t) ** 2;
}
function segmentDistanceSq(a: Point3, b: Point3, c: Point3, d: Point3): number {
    const cross = (p: Point3, q: Point3, r: Point3) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0)
        return 0;
    return Math.min(pointDistanceSq(a, c, d), pointDistanceSq(b, c, d), pointDistanceSq(c, a, b), pointDistanceSq(d, a, b));
}
export function safePathSpans(points: readonly Point3[], blockers: readonly (readonly Point3[])[]): Point3[][] {
    const spans: Point3[][] = [];
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1]!, b = points[i]!;
        if (!blockers.some(line => line.some((d, j) => j > 0 && segmentDistanceSq(a, b, line[j - 1]!, d) <= PEDESTRIANS.roadClearance ** 2)))
            spans.push([a, b]);
    }
    return spans;
}
export function decodePedestrianTile(data: Uint8Array, key: TileKey, project: (p: GeoPoint) => Point3): WalkingPath[] {
    const bytes = validateRoadTileGeometry(data);
    if (!bytes)
        return [];
    const layer = new VectorTileLayer(new PbfReader(bytes));
    const paths: WalkingPath[] = [], blockers: Point3[][] = [];
    for (let i = 0; i < layer.length; i++) {
        const feature = layer.feature(i), p = feature.properties;
        if (feature.type !== 2)
            continue;
        const walking = normalizePedestrianProperties(p);
        const blocking = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service', 'track', 'rail', 'transit', 'busway', 'bus_guideway', 'raceway'].includes(String(p.class)) && p.brunnel !== 'tunnel';
        if (!walking && !blocking)
            continue;
        const buffer = blocking ? Math.round(feature.extent / 128) : 0;
        const lines = feature.loadGeometry().flatMap(line => {
            if (!buffer)
                return clipRoadLine(line, feature.extent);
            // Keep blockers slightly beyond the tile so seam clearance sees neighbour roads.
            const shifted = line.map(pt => ({ ...pt, x: pt.x + buffer, y: pt.y + buffer }));
            return clipRoadLine(shifted, feature.extent + 2 * buffer).map(l => l.map(pt => ({ ...pt, x: pt.x - buffer, y: pt.y - buffer })));
        });
        for (let j = 0; j < lines.length; j++) {
            const points = lines[j]!.map(p => {
                const n = 2 ** key.z;
                return project({ longitude: (key.x + p.x / feature.extent) / n * 360 - 180, latitude: Math.atan(Math.sinh(Math.PI * (1 - 2 * (key.y + p.y / feature.extent) / n))) * 180 / Math.PI });
            });
            if (points.length < 2 || points.some(p => ![p.x, p.y, p.z].every(Number.isFinite)))
                continue;
            if (blocking)
                blockers.push(points);
            if (walking)
                paths.push({ ...walking, id: `${key.z}/${key.x}/${key.y}:${i}:${j}`, points });
        }
    }
    // Use a spatial grid so dense tiles cannot force an all-path/all-road comparison.
    const grid = new Map<string, Point3[][]>(), cellSize = 64;
    let cellWork = 0;
    for (const line of blockers)
        for (let i = 1; i < line.length; i++) {
            const a = line[i - 1]!, b = line[i]!;
            const x0 = Math.floor((Math.min(a.x, b.x) - 4) / cellSize), x1 = Math.floor((Math.max(a.x, b.x) + 4) / cellSize);
            const y0 = Math.floor((Math.min(a.y, b.y) - 4) / cellSize), y1 = Math.floor((Math.max(a.y, b.y) + 4) / cellSize);
            if ((x1 - x0 + 1) * (y1 - y0 + 1) > 4096)
                return [];
            cellWork += (x1 - x0 + 1) * (y1 - y0 + 1);
            if (cellWork > 100000)
                return [];
            for (let x = x0; x <= x1; x++)
                for (let y = y0; y <= y1; y++) {
                    const id = `${x},${y}`, cell = grid.get(id) ?? [];
                    cell.push([a, b]);
                    grid.set(id, cell);
                }
        }
    const result: WalkingPath[] = [];
    let checks = 0;
    for (const path of paths)
        for (let i = 1; i < path.points.length; i++) {
            if (result.length >= PEDESTRIANS.candidateSpans)
                return result;
            const a = path.points[i - 1]!, b = path.points[i]!;
            const candidates = new Set<Point3[]>();
            const x0 = Math.floor(Math.min(a.x, b.x) / cellSize), x1 = Math.floor(Math.max(a.x, b.x) / cellSize), y0 = Math.floor(Math.min(a.y, b.y) / cellSize), y1 = Math.floor(Math.max(a.y, b.y) / cellSize);
            if ((x1 - x0 + 1) * (y1 - y0 + 1) > 4096)
                continue;
            for (let x = x0; x <= x1; x++)
                for (let y = y0; y <= y1; y++)
                    for (const line of grid.get(`${x},${y}`) ?? [])
                        candidates.add(line);
            checks += candidates.size;
            if (checks > 200000)
                return [];
            if (safePathSpans([a, b], [...candidates]).length)
                result.push({ ...path, id: `${path.id}:${i}`, points: [a, b] });
        }
    return result;
}
