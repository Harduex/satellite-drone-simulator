import type { DroneState, Vector3 } from '../core/physics/types';
import { quatRotateVectorInto } from '../core/physics/types';
import { createContactPlane, type ContactPlane } from '../core/physics/SurfaceContact';
import type { TerrainSampler, SurfaceObservation } from './TerrainSampler';

const CELL_METERS = 0.25;
const CACHE_SECONDS = 0.2;
const QUERY_BUDGET = 2;
const QUERY_BUDGET_MS = 3;
const AIRBORNE_REFRESH_SECONDS = 0.1;
const SUPPORT_REFRESH_SECONDS = 0.05;
const WALL_CACHE_SECONDS = 0.4;
const MAX_SUPPORT_RISE_METERS = 0.8;
const FOOTPRINT_OFFSETS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const;
interface CachedSurface extends SurfaceObservation { sampledAt: number; x: number; y: number }

/** Public height queries prepare finite surfaces; unknown coverage never blocks flight. */
export class ContactSampler {
  readonly planes: ContactPlane[] = [];
  private readonly pool = Array.from({ length: 8 }, () => createContactPlane());
  private readonly cache = new Map<string, CachedSurface>();
  private readonly queryPosition = { x: 0, y: 0, z: 0 };
  private readonly observation: SurfaceObservation = { height: NaN, source: 'unknown' };
  private queries = 0;
  private startedAt = 0;
  private now = 0;
  private nextQueryAt = 0;
  private queriesAllowed = true;
  private readonly restingPlane = createContactPlane();
  private restingSource: SurfaceObservation['source'] | null = null;
  private restingSeenAt = -Infinity;
  private readonly restingNormalBody = { x: 0, y: 0, z: 0 };
  private readonly restingConjugate = { w: 1, x: 0, y: 0, z: 0 };
  private preferWallQueries = false;
  private latestClear: CachedSurface | null = null;
  private centerClear: CachedSurface | null = null;
  private wallLane = 0;
  private wallClear: CachedSurface | null = null;
  private wallSolid: CachedSurface | null = null;
  private readonly wallPlane = createContactPlane();
  private support: { x: number; y: number; height: number; seenAt: number; source: SurfaceObservation['source'] } | null = null;
  groundHeight: number | null = null;
  overlap = false;

  constructor(private readonly terrain: TerrainSampler) {}

  reset(): void {
    this.cache.clear(); this.support = null; this.planes.length = 0; this.groundHeight = null;
    this.nextQueryAt = 0; this.preferWallQueries = false;
    this.latestClear = this.centerClear = this.wallClear = this.wallSolid = null;
    this.wallLane = 0;
    this.restingSource = null;
  }

  private sample(x: number, y: number, z: number): CachedSurface | null {
    const ix = Math.round(x / CELL_METERS), iy = Math.round(y / CELL_METERS);
    const key = `${ix},${iy}`;
    const cached = this.cache.get(key);
    if (cached && this.now - cached.sampledAt < CACHE_SECONDS) return cached;
    if (!this.queriesAllowed || this.queries >= QUERY_BUDGET || performance.now() - this.startedAt >= QUERY_BUDGET_MS) return null;
    this.queries++;
    this.queryPosition.x = ix * CELL_METERS; this.queryPosition.y = iy * CELL_METERS; this.queryPosition.z = z;
    this.terrain.sampleSurfaceInto(this.queryPosition, this.observation);
    if (this.cache.size >= 512) this.cache.clear();
    const entry = { height: this.observation.height, source: this.observation.source, sampledAt: this.now,
      x: this.queryPosition.x, y: this.queryPosition.y };
    this.cache.set(key, entry);
    return entry;
  }

  private floor(x: number, y: number, height: number, radius: number): void {
    if (this.planes.length >= this.pool.length) return;
    const plane = this.pool[this.planes.length]!;
    plane.point.x = x; plane.point.y = y; plane.point.z = height;
    plane.normal.x = 0; plane.normal.y = 0; plane.normal.z = 1;
    plane.radius = radius;
    plane.minZ = plane.maxZ = undefined;
    this.planes.push(plane);
  }

  private prepareWall(state: DroneState, radius: number, horizon: number): void {
    const p = state.position;
    const speed = Math.hypot(state.velocity.x, state.velocity.y);
    const n = this.wallPlane.normal;
    const dxWall = p.x - this.wallPlane.point.x, dyWall = p.y - this.wallPlane.point.y;
    const normalDist = dxWall * n.x + dyWall * n.y;
    const normalSpeed = state.velocity.x * n.x + state.velocity.y * n.y;
    if (this.wallSolid && (Math.abs(dxWall * n.y - dyWall * n.x) > this.wallPlane.radius + radius
      || normalDist > radius + CELL_METERS * 3
      || (normalDist > radius + CELL_METERS && speed > 0.5 && normalSpeed > -0.5 * speed))) {
      this.wallClear = this.wallSolid = null;
    }
    if (this.wallClear && this.wallSolid) {
      const dx = this.wallSolid.x - this.wallClear.x, dy = this.wallSolid.y - this.wallClear.y;
      if (Math.hypot(dx, dy) > CELL_METERS * 1.5
        && this.now - Math.min(this.wallClear.sampledAt, this.wallSolid.sampledAt) < CACHE_SECONDS) {
        const middle = this.sample((this.wallClear.x + this.wallSolid.x) / 2,
          (this.wallClear.y + this.wallSolid.y) / 2, p.z);
        if (middle?.source === 'tiles') {
          if (this.isClear(middle, p.z, radius)) this.wallClear = middle;
          else this.wallSolid = middle;
          this.placeWallAtClearSide(p);
        }
      }
      // Refresh both sides even when contact has stopped horizontal motion.
      const refreshClear = this.wallClear.sampledAt <= this.wallSolid.sampledAt;
      const old = refreshClear ? this.wallClear : this.wallSolid;
      const fresh = this.sample(old.x, old.y, p.z);
      if (fresh) {
        const clear = this.isClear(fresh, p.z, radius);
        if (fresh.source !== 'tiles' || clear !== refreshClear) {
          this.wallClear = this.wallSolid = null;
          return;
        }
        if (refreshClear) this.wallClear = fresh;
        else this.wallSolid = fresh;
      }
      if (this.now - Math.min(this.wallClear.sampledAt, this.wallSolid.sampledAt) >= WALL_CACHE_SECONDS
        || p.z - radius > this.wallSolid.height) this.wallClear = this.wallSolid = null;
      return;
    }
    if (speed < 0.1) return;
    const ux = state.velocity.x / speed, uy = state.velocity.y / speed;
    const reach = speed * (2 * SUPPORT_REFRESH_SECONDS + horizon) + radius + CELL_METERS;
    const offset = this.wallLane === 0 ? 0 : this.wallLane === 1 ? radius : -radius;
    const solid = this.sample(p.x + ux * reach - uy * offset, p.y + uy * reach + ux * offset, p.z);
    if (!solid || solid.source !== 'tiles') return;
    if (this.queriesAllowed) this.wallLane = (this.wallLane + 1) % 3;
    if (this.isClear(solid, p.z, radius)) {
      this.latestClear = solid;
      return;
    }
    let clear = this.latestClear;
    if (clear && (solid.x - clear.x) * ux + (solid.y - clear.y) * uy <= 0) clear = this.centerClear;
    if (!clear || this.now - clear.sampledAt >= WALL_CACHE_SECONDS || !this.isClear(clear, p.z, radius)) return;
    const dx = solid.x - clear.x, dy = solid.y - clear.y;
    if (dx * ux + dy * uy <= 0 || Math.abs(dx * uy - dy * ux) > radius + CELL_METERS) return;
    const plane = this.wallPlane;
    // The unknown bracket may contain the facade; its midpoint is not certified clear.
    plane.normal.x = -ux; plane.normal.y = -uy; plane.normal.z = 0;
    plane.radius = Math.max(2, solid.height - p.z + 1);
    this.wallClear = clear; this.wallSolid = solid;
    this.placeWallAtClearSide(p);
  }

  private placeWallAtClearSide(position: Vector3): void {
    const clear = this.wallClear!;
    const plane = this.wallPlane, n = plane.normal;
    // Late observations cannot certify a rewind through the unobserved bracket.
    const advance = Math.min(0, (position.x - clear.x) * n.x + (position.y - clear.y) * n.y);
    plane.point.x = clear.x + n.x * advance; plane.point.y = clear.y + n.y * advance;
    plane.point.z = position.z;
  }

  private isClear(sample: CachedSurface, z: number, radius: number): boolean {
    return sample.source === 'tiles' && sample.height <= z + 0.3
      && (sample.height < z - radius || (this.support !== null && sample.height - this.support.height < MAX_SUPPORT_RISE_METERS));
  }

  private stabilizeRestingSupport(state: DroneState, radius: number, stationary: boolean, center: CachedSurface | null): void {
    if (!stationary) { this.restingSource = null; return; }
    const p = state.position;
    const rest = this.restingPlane;
    if (center && center.source !== 'unknown' && center.height <= p.z + 0.3) {
      if (!this.restingSource && this.planes.length > 0 && Math.abs(p.z - center.height) < radius + 0.15) {
        const plane = this.planes[0]!;
        const q = state.quaternion;
        this.restingConjugate.w = q.w; this.restingConjugate.x = -q.x;
        this.restingConjugate.y = -q.y; this.restingConjugate.z = -q.z;
        quatRotateVectorInto(this.restingConjugate, plane.normal, this.restingNormalBody);
        const normal = this.restingNormalBody;
        const extent = radius * (Math.abs(normal.x) + Math.abs(normal.y)) + 0.05 * Math.abs(normal.z);
        const distance = (p.x - plane.point.x) * plane.normal.x + (p.y - plane.point.y) * plane.normal.y
          + (p.z - plane.point.z) * plane.normal.z;
        if (distance > extent + 0.01) return;
        Object.assign(rest.point, plane.point); Object.assign(rest.normal, plane.normal); rest.radius = plane.radius;
        this.restingSource = center.source; this.restingSeenAt = center.sampledAt;
      }
      if (this.restingSource === center.source) {
        const height = rest.point.z - ((center.x - rest.point.x) * rest.normal.x
          + (center.y - rest.point.y) * rest.normal.y) / rest.normal.z;
        if (Math.abs(center.height - height) >= 0.35) { this.restingSource = null; return; }
        this.restingSeenAt = center.sampledAt;
      }
    }
    if (!this.restingSource || this.now - this.restingSeenAt >= 0.5
      || Math.hypot(p.x - rest.point.x, p.y - rest.point.y) >= radius
      || Math.abs(p.z - rest.point.z) >= radius + 0.15) { this.restingSource = null; return; }
    // Partial footprint refreshes must not replace a resting slope with inconsistent flat patches.
    this.planes.length = 0;
    const plane = this.pool[0]!;
    Object.assign(plane.point, rest.point); Object.assign(plane.normal, rest.normal); plane.radius = rest.radius;
    plane.minZ = plane.maxZ = undefined;
    this.planes.push(plane);
  }

  prepare(state: DroneState, radius: number, horizon: number, now: number): readonly ContactPlane[] {
    this.now = now; this.startedAt = performance.now(); this.queries = 0;
    const p = state.position;
    const speed = Math.hypot(state.velocity.x, state.velocity.y);
    const acceptedSupport = this.support;
    const imminentTouchdown = acceptedSupport !== null
      && state.velocity.z < -1
      && p.z - acceptedSupport.height + state.velocity.z * Math.max(horizon, SUPPORT_REFRESH_SECONDS) <= radius + 0.5;
    this.queriesAllowed = now >= this.nextQueryAt || imminentTouchdown;
    this.planes.length = 0; this.groundHeight = null; this.overlap = false;
    const hadWall = this.wallSolid !== null;
    const wallFirst = this.preferWallQueries && (speed >= 0.1 || hadWall) && !imminentTouchdown;
    if (wallFirst) this.prepareWall(state, radius, horizon);
    const stationary = speed < 0.5 && Math.abs(state.velocity.z) < 0.2;
    const retainSupport = stationary && acceptedSupport?.source === 'tiles' && now - acceptedSupport.seenAt < 0.5
      && Math.hypot(p.x - acceptedSupport.x, p.y - acceptedSupport.y) < radius
      && Math.abs(p.z - acceptedSupport.height - 0.05) < 0.15;
    let centerHasTiles = false;
    let supportBias = 0;
    const centerSample = this.sample(p.x, p.y, p.z);
    if (centerSample && centerSample.source !== 'unknown') {
      this.groundHeight = centerSample.height;
      centerHasTiles = centerSample.source === 'tiles';
      if (!retainSupport || centerHasTiles) {
        if (centerSample.height > p.z + 0.3) {
          this.overlap = true;
          const fallbackClear = this.centerClear ?? this.latestClear;
          const fallbackHeight = acceptedSupport?.height ?? fallbackClear?.height ?? null;
          if (fallbackHeight !== null && fallbackHeight <= p.z + 0.3) {
            this.groundHeight = fallbackHeight;
            this.floor(p.x, p.y, fallbackHeight, Math.max(2, speed * horizon + radius + CELL_METERS));
          }
          if (!this.wallSolid && centerHasTiles && fallbackClear && now - fallbackClear.sampledAt < WALL_CACHE_SECONDS) {
            const dx = centerSample.x - fallbackClear.x, dy = centerSample.y - fallbackClear.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0) {
              this.wallPlane.normal.x = -dx / dist; this.wallPlane.normal.y = -dy / dist; this.wallPlane.normal.z = 0;
              this.wallPlane.radius = Math.max(2, centerSample.height - p.z + 1);
              this.wallClear = fallbackClear; this.wallSolid = centerSample;
              this.placeWallAtClearSide(p);
            }
          }
        } else {
          let height = centerSample.height;
          const previous = this.support;
          if (stationary && previous && Math.hypot(p.x - previous.x, p.y - previous.y) < radius
            && Math.abs(p.z - previous.height - 0.05) < 0.12 && Math.abs(height - previous.height) < 0.35) {
            height = previous.height + Math.max(-0.005, Math.min(0.005, height - previous.height));
          }
          this.support = { x: p.x, y: p.y, height, seenAt: centerSample.sampledAt, source: centerSample.source };
          supportBias = height - centerSample.height;
          this.floor(centerSample.x, centerSample.y, height, radius + CELL_METERS);
        }
      }
    }
    // Reuse only the finite patch already observed, without extending it along the flight path.
    if (!centerSample && acceptedSupport && now - acceptedSupport.seenAt < CACHE_SECONDS
      && Math.hypot(p.x - acceptedSupport.x, p.y - acceptedSupport.y) < radius + CELL_METERS) {
      this.groundHeight = acceptedSupport.height;
      this.floor(acceptedSupport.x, acceptedSupport.y, acceptedSupport.height, radius + CELL_METERS);
    }
    if (centerSample && this.isClear(centerSample, p.z, radius)) {
      this.centerClear = centerSample;
      if (!this.latestClear || this.now - this.latestClear.sampledAt >= WALL_CACHE_SECONDS
        || (this.latestClear.x - p.x) * state.velocity.x + (this.latestClear.y - p.y) * state.velocity.y < 0
        || Math.abs((this.latestClear.x - p.x) * state.velocity.y - (this.latestClear.y - p.y) * state.velocity.x) > speed * (radius + CELL_METERS)) {
        this.latestClear = centerSample;
      }
    }
    const nearSupport = this.groundHeight === null || p.z - this.groundHeight <= 1.5
      || state.velocity.z * Math.max(horizon, SUPPORT_REFRESH_SECONDS) < -(p.z - this.groundHeight - 0.5);
    if (nearSupport) {
      // Endpoint support does not imply solid ground in the unobserved gap.
      const travel = speed * horizon;
      if (travel > radius + CELL_METERS) {
        const x = p.x + state.velocity.x * horizon, y = p.y + state.velocity.y * horizon;
        const sample = this.sample(x, y, p.z);
        if (sample && sample.source !== 'unknown' && sample.height <= p.z + 0.3) {
          this.floor(x, y, sample.height, radius + CELL_METERS);
        }
      }
      const centerPlanes = this.planes.length;
      for (let i = 1; i < FOOTPRINT_OFFSETS.length; i++) {
        const [ox, oy] = FOOTPRINT_OFFSETS[i]!;
        const x = p.x + ox * radius, y = p.y + oy * radius;
        const sample = this.sample(x, y, p.z);
        if (!sample || sample.source === 'unknown' || sample.height > p.z + 0.3) continue;
        let height = sample.height;
        if (this.groundHeight !== null && Math.abs(sample.height - this.groundHeight) < 0.35) {
          height += supportBias;
        }
        this.floor(sample.x, sample.y, height, radius + CELL_METERS);
      }
      if (centerPlanes === 1 && this.planes.length === 5) {
        const [center, right, left, forward, back] = this.planes as [ContactPlane, ContactPlane, ContactPlane, ContactPlane, ContactPlane];
        const spanX = right.point.x - left.point.x, spanY = forward.point.y - back.point.y;
        const riseX = right.point.z - left.point.z, riseY = forward.point.z - back.point.z;
        if (spanX > 0 && spanY > 0 && Math.abs(riseX) < MAX_SUPPORT_RISE_METERS && Math.abs(riseY) < MAX_SUPPORT_RISE_METERS) {
          const gx = riseX / spanX, gy = riseY / spanY;
          const length = Math.hypot(gx, gy, 1);
          center.normal.x = -gx / length; center.normal.y = -gy / length; center.normal.z = 1 / length;
          this.planes.length = 1;
        }
      }
    }
    // Keep a recently accepted stationary support through brief query dropouts only.
    if (retainSupport && !centerHasTiles && acceptedSupport) {
      this.floor(acceptedSupport.x, acceptedSupport.y, acceptedSupport.height, radius + CELL_METERS);
    }
    this.stabilizeRestingSupport(state, radius, stationary, centerSample);
    if (!wallFirst) this.prepareWall(state, radius, horizon);
    if (this.wallSolid && this.wallClear && this.planes.length < this.pool.length) {
      const wall = this.pool[this.planes.length]!;
      Object.assign(wall.point, this.wallPlane.point);
      Object.assign(wall.normal, this.wallPlane.normal);
      wall.radius = this.wallPlane.radius;
      // Height-field sides span the clear surface to the roof, independently of the impact altitude.
      wall.minZ = this.wallClear.height;
      wall.maxZ = this.wallSolid.height;
      this.planes.push(wall);
    }
    if (this.queriesAllowed) {
      this.nextQueryAt = now + (nearSupport || speed >= 0.1 || this.wallSolid ? SUPPORT_REFRESH_SECONDS : AIRBORNE_REFRESH_SECONDS);
      this.preferWallQueries = !this.preferWallQueries;
    }
    return this.planes;
  }

  findClearPosition(candidate: Vector3, radius: number, out: Vector3): boolean {
    let highest = -Infinity;
    for (const [ox, oy] of FOOTPRINT_OFFSETS) {
      this.queryPosition.x = candidate.x + ox * radius;
      this.queryPosition.y = candidate.y + oy * radius;
      this.queryPosition.z = candidate.z;
      this.terrain.sampleSurfaceInto(this.queryPosition, this.observation);
      if (this.observation.source !== 'tiles') return false;
      highest = Math.max(highest, this.observation.height);
    }
    out.x = candidate.x; out.y = candidate.y; out.z = Math.max(candidate.z, highest + 5);
    return true;
  }
}
