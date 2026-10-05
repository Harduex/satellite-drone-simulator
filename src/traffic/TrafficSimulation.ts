import { TRAFFIC, ROAD_DENSITY, ROAD_SPEED } from "./TrafficConfig";
import { poseOnEdge } from "./RoadGraph";
import type { Point3, RoadEdge, RoadGraph, VehicleFrame } from "./TrafficTypes";

const HOURS: readonly (readonly [number, number])[] = [
  [0, 0.35],
  [5, 0.35],
  [6, 0.75],
  [8, 1.25],
  [12, 1],
  [17, 1.25],
  [20, 0.85],
  [24, 0.35],
];
export function demandMultiplier(hour: number): number {
  if (!Number.isFinite(hour)) return 1;
  hour = ((hour % 24) + 24) % 24;
  for (let i = 1; i < HOURS.length; i++)
    if (hour <= HOURS[i]![0]) {
      const a = HOURS[i - 1]!,
        b = HOURS[i]!;
      return a[1] + ((b[1] - a[1]) * (hour - a[0])) / (b[0] - a[0]);
    }
  return 1;
}
interface Car extends VehicleFrame {
  speedFactor: number;
  next: string | null;
  entry: string | null;
  waiting: number;
}
export class TrafficSimulation {
  private graph: RoadGraph = { edges: new Map() };
  private cars: Car[] = [];
  private center: Point3 = { x: 0, y: 0, z: 0 };
  private demand = 1;
  private randomState: number;
  private nextId = 0;
  private populationAccumulator = 0;
  private spawnAttempts = 0;
  private reservations = new Map<string, number>();
  private clearing = new Map<string, number>();
  private edgeList: RoadEdge[] = [];
  private contestedNodes = new Set<string>();
  private populationTarget = 0;
  private targetCenter: Point3 = { x: Infinity, y: Infinity, z: 0 };
  constructor(
    private seed = 42,
    private lengths: readonly number[] = [4.3, 4.1, 4.6],
  ) {
    this.randomState = seed;
  }
  private random(): number {
    this.randomState =
      (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }
  setCenter(center: Point3): void {
    this.center = { ...center };
    if (
      Math.hypot(
        center.x - this.targetCenter.x,
        center.y - this.targetCenter.y,
      ) > 20
    )
      this.refreshTarget();
  }
  setDemand(hour: number): void {
    const demand = demandMultiplier(hour);
    if (Math.abs(demand - this.demand) > 0.01) {
      this.demand = demand;
      this.refreshTarget();
    }
  }
  setGraph(graph: RoadGraph): void {
    this.graph = graph;
    this.edgeList = [...graph.edges.values()];
    this.cars = this.cars.filter((car) => graph.edges.has(car.edgeId));
    for (const car of this.cars)
      if (car.next && !graph.edges.has(car.next)) car.next = null;
    const incoming = new Map<string, number>();
    const neighbors = new Map<string, Set<string>>();
    for (const edge of this.edgeList) {
      incoming.set(edge.end, (incoming.get(edge.end) ?? 0) + 1);
      for (const [node, neighbor] of [
        [edge.start, edge.end],
        [edge.end, edge.start],
      ] as const) {
        const connected = neighbors.get(node) ?? new Set<string>();
        connected.add(neighbor);
        neighbors.set(node, connected);
      }
    }
    this.contestedNodes = new Set(
      [...incoming]
        .filter(
          ([node, count]) => count > 1 && (neighbors.get(node)?.size ?? 0) > 2,
        )
        .map(([node]) => node),
    );
    for (const [node, id] of this.reservations)
      if (
        !this.contestedNodes.has(node) ||
        !this.cars.some((car) => car.id === id)
      )
        this.release(node);
    this.refreshTarget();
  }
  reset(center: Point3): void {
    this.center = { ...center };
    this.cars = [];
    this.reservations.clear();
    this.clearing.clear();
    this.randomState = this.seed;
    this.nextId = 0;
    this.populationAccumulator = 0;
    this.spawnAttempts = 0;
    this.refreshTarget();
    const target = this.target();
    for (let i = 0; i < target * 5 && this.cars.length < target; i++)
      this.spawn(false);
  }
  getFrames(): readonly VehicleFrame[] {
    return this.cars;
  }
  private refreshTarget(): void {
    let value = 0;
    for (const edge of this.edgeList) {
      const mid = poseOnEdge(edge, edge.length / 2).position;
      if (
        Math.hypot(mid.x - this.center.x, mid.y - this.center.y) <
        TRAFFIC.radius
      )
        value += (edge.length / 1000) * ROAD_DENSITY[edge.roadClass];
    }
    this.populationTarget = Math.min(
      TRAFFIC.cars,
      Math.round(value * this.demand),
    );
    this.targetCenter = { ...this.center };
  }
  private target(): number {
    return this.populationTarget;
  }
  private spawn(peripheral: boolean): void {
    const edges = this.edgeList;
    if (!edges.length) return;
    const edge = edges[Math.floor(this.random() * edges.length)]!;
    const distance = this.random() * edge.length,
      pose = poseOnEdge(edge, distance);
    const radius = Math.hypot(
      pose.position.x - this.center.x,
      pose.position.y - this.center.y,
    );
    this.spawnAttempts++;
    // Partial surface coverage can be entirely central; periodically admit a safe central gap.
    if (
      radius > TRAFFIC.radius ||
      (peripheral &&
        radius < TRAFFIC.radius * 0.65 &&
        this.spawnAttempts % 5 !== 0)
    )
      return;
    const length =
      this.lengths[Math.floor(this.random() * this.lengths.length)]!;
    const gap = 4 + ROAD_SPEED[edge.roadClass] * 1.5 + length;
    if (
      this.cars.some(
        (car) =>
          car.edgeId === edge.id && Math.abs(car.distance - distance) < gap,
      )
    )
      return;
    if (
      this.cars.some((car) => {
        const dx = car.current.position.x - pose.position.x,
          dy = car.current.position.y - pose.position.y;
        if (Math.hypot(dx, dy) > length + car.length + 4) return false;
        // Rectangle separation keeps connected segments clear without suppressing the opposite lane.
        return [pose.heading, car.current.heading].every((heading) => {
          const along = Math.abs(
            dx * Math.sin(heading) + dy * Math.cos(heading),
          );
          const across = Math.abs(
            dx * Math.cos(heading) - dy * Math.sin(heading),
          );
          const a = pose.heading - heading,
            b = car.current.heading - heading;
          return (
            along <
              (length * Math.abs(Math.cos(a)) +
                car.length * Math.abs(Math.cos(b))) /
                2 +
                0.95 * (Math.abs(Math.sin(a)) + Math.abs(Math.sin(b))) +
                2 &&
            across <
              (length * Math.abs(Math.sin(a)) +
                car.length * Math.abs(Math.sin(b))) /
                2 +
                0.95 * (Math.abs(Math.cos(a)) + Math.abs(Math.cos(b)))
          );
        });
      })
    )
      return;
    const modelIndex = this.lengths.indexOf(length);
    this.cars.push({
      id: this.nextId++,
      modelIndex,
      colorIndex: Math.floor(this.random() * 6),
      length,
      edgeId: edge.id,
      distance,
      speed: 0,
      speedFactor: 0.9 + 0.2 * this.random(),
      next: null,
      entry: null,
      waiting: 0,
      previous: {
        position: { ...pose.position },
        heading: pose.heading,
        pitch: pose.pitch,
      },
      current: pose,
    });
  }
  private chooseNext(edge: RoadEdge): string | null {
    const options = edge.outgoing
      .map((id) => this.graph.edges.get(id)!)
      .filter(Boolean);
    if (!options.length) return null;
    const heading = poseOnEdge(edge, edge.length).heading;
    const weighted = options.map((next) => ({
      next,
      weight:
        (2 + Math.cos(poseOnEdge(next, 0).heading - heading) * 1.8) *
        ROAD_SPEED[next.roadClass],
    }));
    let value =
      this.random() * weighted.reduce((sum, item) => sum + item.weight, 0);
    for (const item of weighted) {
      value -= item.weight;
      if (value <= 0) return item.next.id;
    }
    return options[0]!.id;
  }
  private leaderGap(car: Car, edge: RoadEdge): number {
    let gap = Infinity;
    for (const leader of this.cars)
      if (
        leader.id !== car.id &&
        leader.edgeId === edge.id &&
        leader.distance > car.distance
      ) {
        gap = Math.min(
          gap,
          leader.distance - car.distance - (leader.length + car.length) / 2,
        );
      }
    let traversed = edge.length - car.distance,
      next = car.next;
    const visited = new Set<string>();
    while (next && traversed < 150 && !visited.has(next)) {
      visited.add(next);
      const following = this.graph.edges.get(next);
      if (!following) break;
      for (const leader of this.cars)
        if (leader.id !== car.id && leader.edgeId === next)
          gap = Math.min(
            gap,
            traversed + leader.distance - (leader.length + car.length) / 2,
          );
      traversed += following.length;
      next = following.outgoing.length === 1 ? following.outgoing[0]! : null;
    }
    return gap;
  }
  private release(node: string): void {
    this.reservations.delete(node);
    this.clearing.delete(node);
  }
  private bend(before: RoadEdge, after: RoadEdge): boolean {
    const delta =
      poseOnEdge(after, 0).heading - poseOnEdge(before, before.length).heading;
    return Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta))) > 0.3;
  }
  step(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    this.populationAccumulator += dt;
    if (this.populationAccumulator >= 0.2) {
      this.populationAccumulator -= 0.2;
      if (this.cars.length < this.target()) this.spawn(true);
      else if (this.cars.length > this.target()) {
        const index = this.cars.findIndex(
          (car) =>
            Math.hypot(
              car.current.position.x - this.center.x,
              car.current.position.y - this.center.y,
            ) >
            TRAFFIC.radius * 0.65,
        );
        if (index >= 0) {
          const id = this.cars[index]!.id;
          this.cars.splice(index, 1);
          for (const [node, owner] of this.reservations)
            if (owner === id) this.release(node);
        }
      }
    }
    const retired = new Set<number>();
    const ordered = [...this.cars].sort(
      (a, b) => b.waiting - a.waiting || a.id - b.id,
    );
    for (const car of ordered) {
      const edge = this.graph.edges.get(car.edgeId);
      if (!edge) {
        retired.add(car.id);
        continue;
      }
      car.previous = {
        position: { ...car.current.position },
        heading: car.current.heading,
        pitch: car.current.pitch,
      };
      car.next ??= this.chooseNext(edge);
      let available = this.leaderGap(car, edge);
      const remaining = edge.length - car.distance;
      if (edge.pendingContinuation && !car.next)
        available = Math.min(
          available,
          Math.max(0, remaining - car.length / 2),
        );
      let target = ROAD_SPEED[edge.roadClass] * car.speedFactor;
      const next = car.next ? this.graph.edges.get(car.next) : undefined;
      const entry = car.entry ? this.graph.edges.get(car.entry) : undefined;
      if (
        entry &&
        car.distance < Math.min(8, entry.length / 2, edge.length / 2) &&
        this.bend(entry, edge)
      )
        target = Math.min(target, 5);
      let approach = edge,
        following = next,
        ahead = remaining;
      const visited = new Set<string>();
      while (following && ahead < 150 && !visited.has(following.id)) {
        visited.add(following.id);
        const turning = this.bend(approach, following);
        const limit = Math.min(
          ROAD_SPEED[following.roadClass] * car.speedFactor,
          turning ? 5 : Infinity,
        );
        const span = turning
          ? Math.min(8, approach.length / 2, following.length / 2)
          : 0;
        // A braking envelope reaches the next limit before the curve, including one discrete step of margin.
        target = Math.min(
          target,
          Math.sqrt(limit * limit + 10 * Math.max(0, ahead - span - 2)),
        );
        ahead += following.length;
        approach = following;
        following =
          approach.outgoing.length === 1
            ? this.graph.edges.get(approach.outgoing[0]!)
            : undefined;
      }
      const owner = this.reservations.get(edge.end);
      const contested = this.contestedNodes.has(edge.end);
      const stopMargin = car.length / 2 + 3;
      if (
        next &&
        remaining < Math.max(20, (car.speed * car.speed) / 10 + stopMargin + 4)
      ) {
        const exitBlocked =
          contested && available - remaining < 8 + car.length / 2 + 4;
        const priorityWaiting = this.cars.some(
          (other) =>
            other.id !== car.id &&
            this.graph.edges.get(other.edgeId)?.end === edge.end &&
            ROAD_SPEED[this.graph.edges.get(other.edgeId)!.roadClass] >
              ROAD_SPEED[edge.roadClass] &&
            other.waiting > 0 &&
            car.waiting < 5,
        );
        if (
          exitBlocked ||
          (contested && owner !== undefined && owner !== car.id) ||
          priorityWaiting
        )
          available = Math.min(available, Math.max(0, remaining - stopMargin));
        else if (contested && remaining < 20)
          this.reservations.set(edge.end, car.id);
        // A car already inside the stop line owns the conflict until its rear clears it.
        if (contested && owner === undefined && remaining < stopMargin)
          this.reservations.set(edge.end, car.id);
      }
      const desiredGap = 4 + car.speed * 1.5;
      if (available < desiredGap)
        target = Math.min(target, Math.max(0, (available - 4) / 1.5));
      car.speed += Math.max(-5 * dt, Math.min(2 * dt, target - car.speed));
      const advance = Math.max(0, Math.min(car.speed * dt, available - 1));
      for (const [node, clearance] of this.clearing)
        if (this.reservations.get(node) === car.id) {
          const left = clearance - advance;
          if (left <= 0) this.release(node);
          else this.clearing.set(node, left);
        }
      car.waiting = advance < 0.01 ? car.waiting + dt : 0;
      car.distance += advance;
      let traversedEdge = edge;
      for (
        let transitions = 0;
        car.distance >= traversedEdge.length && transitions < 8;
        transitions++
      ) {
        if (this.reservations.get(traversedEdge.end) === car.id)
          this.clearing.set(
            traversedEdge.end,
            8 + car.length / 2 - (car.distance - traversedEdge.length),
          );
        const continuation = car.next
          ? this.graph.edges.get(car.next)
          : undefined;
        if (!continuation) {
          retired.add(car.id);
          break;
        }
        car.distance -= traversedEdge.length;
        car.entry = traversedEdge.id;
        car.edgeId = continuation.id;
        traversedEdge = continuation;
        car.next = this.chooseNext(continuation);
        if (this.contestedNodes.has(continuation.end)) {
          car.distance = Math.min(
            car.distance,
            Math.max(0, continuation.length - 0.01),
          );
          break;
        }
      }
      if (retired.has(car.id)) continue;
      const currentEdge = this.graph.edges.get(car.edgeId)!;
      car.current = this.pose(car, currentEdge);
      if (
        Math.hypot(
          car.current.position.x - this.center.x,
          car.current.position.y - this.center.y,
        ) > TRAFFIC.radius
      )
        retired.add(car.id);
    }
    for (const [node, id] of this.reservations)
      if (retired.has(id) || !this.cars.some((car) => car.id === id))
        this.release(node);
    this.cars = this.cars.filter((car) => !retired.has(car.id));
  }
  private pose(car: Car, edge: RoadEdge): VehicleFrame["current"] {
    const entry = car.entry ? this.graph.edges.get(car.entry) : undefined;
    const next = car.next ? this.graph.edges.get(car.next) : undefined;
    const before =
      entry && car.distance < Math.min(8, entry.length / 2, edge.length / 2)
        ? entry
        : edge;
    const after = before === entry ? edge : next;
    if (!after) return poseOnEdge(edge, car.distance);
    const span = Math.min(8, before.length / 2, after.length / 2);
    if (before === edge && car.distance < edge.length - span)
      return poseOnEdge(edge, car.distance);
    const t =
      before === entry
        ? 0.5 + car.distance / (2 * span)
        : (car.distance - edge.length + span) / (2 * span);
    const a = poseOnEdge(before, before.length - span).position,
      b = poseOnEdge(before, before.length).position;
    const c = poseOnEdge(after, 0).position,
      d = poseOnEdge(after, span).position,
      u = 1 - t;
    const coordinate = (key: keyof Point3) =>
      u * u * u * a[key] +
      3 * u * u * t * b[key] +
      3 * u * t * t * c[key] +
      t * t * t * d[key];
    const tangent = (key: keyof Point3) =>
      3 * u * u * (b[key] - a[key]) +
      6 * u * t * (c[key] - b[key]) +
      3 * t * t * (d[key] - c[key]);
    const dx = tangent("x"),
      dy = tangent("y");
    return {
      position: { x: coordinate("x"), y: coordinate("y"), z: coordinate("z") },
      heading: Math.atan2(dx, dy),
      pitch: Math.atan2(tangent("z"), Math.hypot(dx, dy)),
    };
  }
}
