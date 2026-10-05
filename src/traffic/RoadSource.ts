import { VectorTileLayer } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { TRAFFIC } from "./TrafficConfig";
import type {
  GeoPoint,
  Point3,
  RoadClass,
  RoadSegment,
  TileKey,
} from "./TrafficTypes";

const METADATA = "https://tiles.openfreemap.org/planet";
const CLASSES = new Set([
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "minor",
]);
interface TilePoint {
  x: number;
  y: number;
}
export function clipRoadLine(
  points: readonly TilePoint[],
  extent: number,
): TilePoint[][] {
  if (!Number.isFinite(extent) || extent <= 0) return [];
  const lines: TilePoint[][] = [];
  let current: TilePoint[] | null = null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!,
      b = points[i]!,
      dx = b.x - a.x,
      dy = b.y - a.y;
    let start = 0,
      end = 1,
      admitted = true;
    for (const [direction, distance] of [
      [-dx, a.x],
      [dx, extent - a.x],
      [-dy, a.y],
      [dy, extent - a.y],
    ]) {
      if (direction === 0) {
        if (distance! < 0) admitted = false;
        continue;
      }
      const fraction = distance! / direction!;
      if (direction! < 0) start = Math.max(start, fraction);
      else end = Math.min(end, fraction);
    }
    if (!admitted || start >= end) {
      current = null;
      continue;
    }
    const from = { x: a.x + dx * start, y: a.y + dy * start },
      to = { x: a.x + dx * end, y: a.y + dy * end };
    const last = current?.at(-1);
    if (!last || Math.hypot(last.x - from.x, last.y - from.y) > 1e-6) {
      current = [from];
      lines.push(current);
    }
    current!.push(to);
  }
  return lines;
}
export function validateRoadTileGeometry(data: Uint8Array): Uint8Array | null {
  let vertices = 0;
  let transportation: Uint8Array | null = null;
  new PbfReader(data).readFields((tag, _value, tile) => {
    if (tag !== 3) return;
    const layerBytes = tile.readBytes();
    let name = "";
    new PbfReader(layerBytes).readFields((field, _unused, reader) => {
      if (field === 1) name = reader.readString();
    }, undefined);
    if (name !== "transportation") return;
    if (transportation) throw new Error("Duplicate transportation layer");
    transportation = layerBytes;
    let features = 0;
    new PbfReader(layerBytes).readFields((field, _unused, reader) => {
      if (field !== 2) return;
      if (++features > TRAFFIC.tileFeatures)
        throw new Error("Road feature limit exceeded");
      reader.readMessage((field, _result, reader) => {
        if (field !== 4) return;
        const geometry = new PbfReader(reader.readBytes());
        while (geometry.pos < geometry.length) {
          const command = geometry.readVarint(),
            kind = command & 7,
            count = Math.floor(command / 8);
          if (!count || ![1, 2, 7].includes(kind))
            throw new Error("Invalid road geometry command");
          vertices += count;
          if (vertices > TRAFFIC.tileVertices)
            throw new Error("Road vertex limit exceeded");
          if (kind !== 7)
            for (let i = 0; i < count; i++) {
              if (geometry.pos >= geometry.length)
                throw new Error("Truncated road geometry");
              geometry.readVarint();
              if (geometry.pos >= geometry.length)
                throw new Error("Truncated road geometry");
              geometry.readVarint();
            }
        }
      }, undefined);
    }, undefined);
  }, undefined);
  return transportation;
}
export function normalizeRoadProperties(
  p: Record<string, unknown>,
): Omit<RoadSegment, "id" | "points"> | null {
  if (
    !CLASSES.has(String(p.class)) ||
    p.brunnel === "tunnel" ||
    p.service ||
    p.access === false ||
    p.access === "no" ||
    p.access === "private" ||
    p.access === "false"
  )
    return null;
  if (
    p.oneway !== undefined &&
    typeof p.oneway !== "number" &&
    typeof p.oneway !== "string"
  )
    return null;
  if (typeof p.oneway === "string" && !["0", "1", "-1"].includes(p.oneway))
    return null;
  const oneway = p.oneway === undefined ? 0 : Number(p.oneway);
  if (oneway !== 0 && oneway !== 1 && oneway !== -1) return null;
  return {
    roadClass: p.class as RoadClass,
    oneway,
    bridge: p.brunnel === "bridge",
    layer:
      typeof p.layer === "number" && Number.isFinite(p.layer) ? p.layer : 0,
  };
}
export function validateTileTemplate(template: string): string {
  const url = new URL(template);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "tiles.openfreemap.org" ||
    url.username ||
    url.password ||
    !["{z}", "{x}", "{y}"].every((token) => template.includes(token))
  )
    throw new Error("Unsupported road tile template");
  return template;
}
export function selectCoverageTiles(center: GeoPoint, limits: { zoom: number; preload: number; tilesPerRefresh: number } = TRAFFIC): TileKey[] {
  if (
    !Number.isFinite(center.latitude) ||
    !Number.isFinite(center.longitude) ||
    Math.abs(center.latitude) > 85.05112878
  )
    return [];
  const n = 2 ** limits.zoom;
  const latitude = (center.latitude * Math.PI) / 180;
  const x = ((center.longitude + 180) / 360) * n;
  const y = ((1 - Math.asinh(Math.tan(latitude)) / Math.PI) / 2) * n;
  const metersPerTile = (40075016.686 * Math.cos(latitude)) / n;
  const radius = Math.ceil(limits.preload / metersPerTile) + 1;
  const candidates: { key: TileKey; distance: number }[] = [];
  for (let dx = -radius; dx <= radius; dx++)
    for (let dy = -radius; dy <= radius; dy++) {
      const tx = Math.floor(x) + dx,
        ty = Math.floor(y) + dy;
      if (ty < 0 || ty >= n) continue;
      const distance = Math.hypot(tx + 0.5 - x, ty + 0.5 - y);
      candidates.push({
        key: { z: limits.zoom, x: ((tx % n) + n) % n, y: ty },
        distance,
      });
    }
  return candidates
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limits.tilesPerRefresh)
    .map((c) => c.key);
}
export async function readBoundedResponse(
  response: Response,
  limit: number,
): Promise<Uint8Array> {
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
      if (length > limit) {
        await reader.cancel();
        throw new Error("Road response exceeds byte limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

type SourceLine = { id: string; points: Point3[] };
export class RoadSource<T extends SourceLine = RoadSegment> {
  private template: string | null = null;
  private cache = new Map<string, { roads: T[]; bytes: number }>();
  cachedBytes = 0;
  pendingRequests = 0;
  requestFailures = 0;
  constructor(
    private project: (point: GeoPoint) => Point3,
    private fetcher: typeof fetch = (input, init) => fetch(input, init),
    private options: {
      decode?: (data: Uint8Array, key: TileKey, project: (point: GeoPoint) => Point3) => T[];
      tilesPerRefresh: number; concurrentRequests: number; cacheTiles: number; cacheBytes: number;
    } = TRAFFIC,
  ) {}
  get cachedTiles(): number {
    return this.cache.size;
  }
  async loadTiles(
    keys: readonly TileKey[],
    signal: AbortSignal,
  ): Promise<readonly T[]> {
    if (!this.template) {
      const response = await this.fetcher(METADATA, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
        redirect: "error",
      });
      const bytes = await readBoundedResponse(response, 256 * 1024);
      const metadata = JSON.parse(new TextDecoder().decode(bytes)) as {
        tiles?: string[];
      };
      this.template = validateTileTemplate(metadata.tiles?.[0] ?? "");
    }
    const result: T[] = [];
    let cursor = 0;
    const worker = async () => {
      while (
        cursor < Math.min(keys.length, this.options.tilesPerRefresh) &&
        !signal.aborted
      ) {
        const key = keys[cursor++]!;
        const id = `${key.z}/${key.x}/${key.y}`;
        const cached = this.cache.get(id);
        if (cached) {
          this.cache.delete(id);
          this.cache.set(id, cached);
          result.push(...cached.roads);
          continue;
        }
        this.pendingRequests++;
        try {
          let roads: T[] | undefined;
          let bytes = 0;
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              const response = await this.fetcher(
                this.template!.replace("{z}", String(key.z))
                  .replace("{x}", String(key.x))
                  .replace("{y}", String(key.y)),
                {
                  signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
                  redirect: "error",
                },
              );
              const data = await readBoundedResponse(
                response,
                TRAFFIC.tileBytes,
              );
              roads = this.options.decode ? this.options.decode(data, key, this.project) : this.decode(data, key) as unknown as T[];
              bytes =
                data.length +
                roads.reduce((sum, r) => sum + r.points.length * 64 + 512, 0);
              break;
            } catch (error) {
              if (signal.aborted || attempt === 1) throw error;
            }
          }
          if (signal.aborted || !roads) continue;
          this.cache.set(id, { roads, bytes });
          this.cachedBytes += bytes;
          while (
            this.cache.size > this.options.cacheTiles ||
            this.cachedBytes > this.options.cacheBytes
          ) {
            const oldest = this.cache.keys().next().value!;
            this.cachedBytes -= this.cache.get(oldest)!.bytes;
            this.cache.delete(oldest);
          }
          result.push(...roads);
        } catch (error) {
          if (!signal.aborted) {
            this.requestFailures++;
            console.warn(
              "Road tile unavailable",
              id,
              error instanceof Error ? error.message : "source failure",
            );
          }
        } finally {
          this.pendingRequests--;
        }
      }
    };
    await Promise.all(
      Array.from({ length: this.options.concurrentRequests }, worker),
    );
    return result;
  }
  private decode(data: Uint8Array, key: TileKey): RoadSegment[] {
    const layerData = validateRoadTileGeometry(data);
    if (!layerData) return [];
    const layer = new VectorTileLayer(new PbfReader(layerData));
    if (layer.length > TRAFFIC.tileFeatures)
      throw new Error("Road feature limit exceeded");
    const roads: RoadSegment[] = [];
    let vertices = 0;
    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i);
      const properties = normalizeRoadProperties(feature.properties);
      if (feature.type !== 2 || !properties) continue;
      const lines = feature
        .loadGeometry()
        .flatMap((line) => clipRoadLine(line, feature.extent));
      for (let j = 0; j < lines.length; j++) {
        const line = lines[j]!;
        vertices += line.length;
        if (vertices > TRAFFIC.tileVertices)
          throw new Error("Road vertex limit exceeded");
        const points = line.map((p) => {
          const n = 2 ** key.z;
          const longitude = ((key.x + p.x / feature.extent) / n) * 360 - 180;
          const mercatorY =
            Math.PI * (1 - (2 * (key.y + p.y / feature.extent)) / n);
          return this.project({
            longitude,
            latitude: (Math.atan(Math.sinh(mercatorY)) * 180) / Math.PI,
          });
        });
        if (
          points.length < 2 ||
          points.some((p) => ![p.x, p.y, p.z].every(Number.isFinite))
        )
          continue;
        roads.push({
          ...properties,
          id: `${key.z}/${key.x}/${key.y}:${i}:${j}`,
          points,
        });
      }
    }
    return roads;
  }
  clear(): void {
    this.cache.clear();
    this.cachedBytes = 0;
  }
}
