import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { TRAFFIC } from './TrafficConfig';
import type { GeoPoint, Point3, RoadClass, RoadSegment, TileKey } from './TrafficTypes';

const METADATA = 'https://tiles.openfreemap.org/planet';
const CLASSES = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor']);
export function normalizeRoadProperties(p: Record<string, unknown>): Omit<RoadSegment, 'id' | 'points'> | null {
  if (!CLASSES.has(String(p.class)) || p.brunnel === 'tunnel' || p.service ||
    p.access === false || p.access === 'no' || p.access === 'private' || p.access === 'false') return null;
  const oneway = p.oneway === undefined ? 0 : Number(p.oneway);
  if (oneway !== 0 && oneway !== 1 && oneway !== -1) return null;
  return { roadClass: p.class as RoadClass, oneway, bridge: p.brunnel === 'bridge',
    layer: typeof p.layer === 'number' && Number.isFinite(p.layer) ? p.layer : 0 };
}
export function validateTileTemplate(template: string): string {
  const url = new URL(template);
  if (url.protocol !== 'https:' || url.hostname !== 'tiles.openfreemap.org' || url.username || url.password ||
    !['{z}', '{x}', '{y}'].every(token => template.includes(token))) throw new Error('Unsupported road tile template');
  return template;
}
export function selectCoverageTiles(center: GeoPoint): TileKey[] {
  if (!Number.isFinite(center.latitude) || !Number.isFinite(center.longitude) || Math.abs(center.latitude) > 85.05112878) return [];
  const n = 2 ** TRAFFIC.zoom;
  const latitude = center.latitude * Math.PI / 180;
  const x = (center.longitude + 180) / 360 * n;
  const y = (1 - Math.asinh(Math.tan(latitude)) / Math.PI) / 2 * n;
  const metersPerTile = 40075016.686 * Math.cos(latitude) / n;
  const radius = Math.ceil(TRAFFIC.preload / metersPerTile) + 1;
  const candidates: { key: TileKey; distance: number }[] = [];
  for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) {
    const tx = Math.floor(x) + dx, ty = Math.floor(y) + dy;
    if (ty < 0 || ty >= n) continue;
    const distance = Math.hypot(tx + 0.5 - x, ty + 0.5 - y);
    candidates.push({ key: { z: TRAFFIC.zoom, x: (tx % n + n) % n, y: ty }, distance });
  }
  return candidates.sort((a, b) => a.distance - b.distance).slice(0, TRAFFIC.tilesPerRefresh).map(c => c.key);
}
export async function readBoundedResponse(response: Response, limit: number): Promise<Uint8Array> {
  if (!response.ok) throw new Error(`Road source HTTP ${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) { await reader.cancel(); throw new Error('Road response exceeds byte limit'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

export class RoadSource {
  private template: string | null = null;
  private cache = new Map<string, { roads: RoadSegment[]; bytes: number }>();
  cachedBytes = 0;
  pendingRequests = 0;
  requestFailures = 0;
  constructor(private project: (point: GeoPoint) => Point3, private fetcher: typeof fetch = (input, init) => fetch(input, init)) {}
  get cachedTiles(): number { return this.cache.size; }
  async loadTiles(keys: readonly TileKey[], signal: AbortSignal): Promise<readonly RoadSegment[]> {
    if (!this.template) {
      const response = await this.fetcher(METADATA, { signal });
      const bytes = await readBoundedResponse(response, 256 * 1024);
      const metadata = JSON.parse(new TextDecoder().decode(bytes)) as { tiles?: string[] };
      this.template = validateTileTemplate(metadata.tiles?.[0] ?? '');
    }
    const result: RoadSegment[] = [];
    let cursor = 0;
    const worker = async () => {
      while (cursor < Math.min(keys.length, TRAFFIC.tilesPerRefresh) && !signal.aborted) {
        const key = keys[cursor++]!;
        const id = `${key.z}/${key.x}/${key.y}`;
        const cached = this.cache.get(id);
        if (cached) { this.cache.delete(id); this.cache.set(id, cached); result.push(...cached.roads); continue; }
        this.pendingRequests++;
        try {
          let roads: RoadSegment[] | undefined;
          let bytes = 0;
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              const response = await this.fetcher(this.template!.replace('{z}', String(key.z)).replace('{x}', String(key.x)).replace('{y}', String(key.y)),
                { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) });
              const data = await readBoundedResponse(response, TRAFFIC.tileBytes);
              roads = this.decode(data, key); bytes = data.length + roads.reduce((sum, r) => sum + r.points.length * 32 + 256, 0);
              break;
            } catch (error) { if (signal.aborted || attempt === 1) throw error; }
          }
          if (signal.aborted || !roads) continue;
          this.cache.set(id, { roads, bytes }); this.cachedBytes += bytes;
          while (this.cache.size > TRAFFIC.cacheTiles || this.cachedBytes > TRAFFIC.cacheBytes) {
            const oldest = this.cache.keys().next().value!;
            this.cachedBytes -= this.cache.get(oldest)!.bytes; this.cache.delete(oldest);
          }
          result.push(...roads);
        } catch (error) {
          if (!signal.aborted) { this.requestFailures++; console.warn('Road tile unavailable', id, error instanceof Error ? error.message : 'source failure'); }
        } finally { this.pendingRequests--; }
      }
    };
    await Promise.all(Array.from({ length: TRAFFIC.concurrentRequests }, worker));
    return result;
  }
  private decode(data: Uint8Array, key: TileKey): RoadSegment[] {
    const tile = new VectorTile(new PbfReader(data));
    const layer = tile.layers.transportation;
    if (!layer) return [];
    if (layer.length > TRAFFIC.tileFeatures) throw new Error('Road feature limit exceeded');
    const roads: RoadSegment[] = [];
    let vertices = 0;
    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i);
      const properties = normalizeRoadProperties(feature.properties);
      if (feature.type !== 2 || !properties) continue;
      const lines = feature.loadGeometry();
      for (let j = 0; j < lines.length; j++) {
        const line = lines[j]!; vertices += line.length;
        if (vertices > TRAFFIC.tileVertices) throw new Error('Road vertex limit exceeded');
        const points = line.map(p => {
          const n = 2 ** key.z;
          const longitude = (key.x + p.x / feature.extent) / n * 360 - 180;
          const mercatorY = Math.PI * (1 - 2 * (key.y + p.y / feature.extent) / n);
          return this.project({ longitude, latitude: Math.atan(Math.sinh(mercatorY)) * 180 / Math.PI });
        });
        if (points.length < 2 || points.some(p => ![p.x,p.y,p.z].every(Number.isFinite))) continue;
        roads.push({ ...properties, id: `${key.z}/${key.x}/${key.y}:${i}:${j}`, points });
      }
    }
    return roads;
  }
  clear(): void { this.cache.clear(); this.cachedBytes = 0; }
}
