import type { Point3, RoadEdge, SurfaceEdge } from "../../traffic/TrafficTypes";
import { TRAFFIC } from "../../traffic/TrafficConfig";

interface SurfaceJob<E> {
  edge: E;
  points: Point3[];
  index: number;
  attempts: number;
  readyAt: number;
  probe: number;
  lateral: number[];
}
export class TrafficSurface<E extends SurfaceEdge = RoadEdge> {
  private queue: SurfaceJob<E>[] = [];
  private cursor = 0;
  private nextReadyAt = 0;
  private priorityCenter: Point3 | null = null;
  private validated: { edges: Map<string, E> } = { edges: new Map() };
  version = 0;
  rejectedRoads = 0;
  samples = 0;
  sampleMs = 0;
  constructor(
    private sample: (point: Point3) => number | undefined,
    private now: () => number = () => performance.now(),
    private limits = { samples: TRAFFIC.surfaceSamples as number, ms: TRAFFIC.surfaceMs as number, spacing: 25, lateral: 6 },
  ) {}
  get pending(): number {
    return this.queue.length;
  }
  prepare(graph: { edges: Map<string, E> }): void {
    const old = this.validated.edges;
    const pending = new Map(this.queue.map((job) => [job.edge.id, job]));
    this.validated = { edges: new Map() };
    this.queue = [];
    this.cursor = 0;
    this.nextReadyAt = 0;
    this.priorityCenter = null;
    for (const edge of graph.edges.values()) {
      const retained = old.get(edge.id);
      if (retained) {
        this.validated.edges.set(edge.id, {
          ...edge,
          points: retained.points,
        });
        continue;
      }
      const unfinished = pending.get(edge.id);
      if (unfinished) {
        unfinished.edge = edge;
        this.queue.push(unfinished);
        continue;
      }
      const points: Point3[] = [];
      for (let i = 1; i < edge.points.length; i++) {
        const a = edge.points[i - 1]!,
          b = edge.points[i]!;
        const count = Math.max(
          1,
          Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / this.limits.spacing),
        );
        if (i === 1) points.push({ ...a });
        for (let j = 1; j <= count; j++)
          points.push({
            x: a.x + ((b.x - a.x) * j) / count,
            y: a.y + ((b.y - a.y) * j) / count,
            z: 0,
          });
      }
      this.queue.push({
        edge,
        points,
        index: 0,
        attempts: 0,
        readyAt: 0,
        probe: 0,
        lateral: [],
      });
    }
    this.version++;
  }
  processFrame(center?: Point3): void {
    const start = this.now();
    this.samples = 0;
    this.sampleMs = 0;
    if (
      center &&
      (!this.priorityCenter ||
        Math.hypot(center.x - this.priorityCenter.x, center.y - this.priorityCenter.y) >= 50)
    ) {
      this.priorityCenter = { ...center };
      const distance = (job: SurfaceJob<E>) => {
        const point = job.points[job.index]!;
        return (point.x - center.x) ** 2 + (point.y - center.y) ** 2;
      };
      this.queue.sort((a, b) => distance(a) - distance(b));
      this.cursor = 0;
    }
    if (start < this.nextReadyAt) return;
    let skipped = 0;
    let earliestRetry = Infinity;
    while (
      this.queue.length &&
      skipped < this.queue.length &&
      this.samples < this.limits.samples &&
      this.now() - start < this.limits.ms
    ) {
      const job = this.queue[this.cursor]!;
      if (job.readyAt > this.now()) {
        earliestRetry = Math.min(earliestRetry, job.readyAt);
        this.cursor = (this.cursor + 1) % this.queue.length;
        skipped++;
        continue;
      }
      skipped = 0;
      const point = job.points[job.index]!;
      const a = job.points[0]!,
        b = job.points.at(-1)!;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const side = this.limits.lateral > 0 ? (job.probe === 1 ? this.limits.lateral : job.probe === 2 ? -this.limits.lateral : 0) : 0;
      const height = this.sample(
        side
          ? {
              x: point.x + ((b.y - a.y) / length) * side,
              y: point.y - ((b.x - a.x) / length) * side,
              z: point.z,
            }
          : point,
      );
      this.samples++;
      if (height === undefined || !Number.isFinite(height)) {
        // Unloaded tiles are temporary; retain completed stations until the view covers them.
        job.attempts = Math.min(job.attempts + 1, 4);
        job.readyAt = this.now() + Math.min(5000, 1000 * 2 ** (job.attempts - 1));
        this.cursor = (this.cursor + 1) % this.queue.length;
        continue;
      }
      job.attempts = 0;
      if (job.probe === 0) point.z = height;
      else job.lateral.push(height);
      if (!job.edge.bridge && this.limits.lateral > 0 && job.probe < 2) {
        job.probe++;
        continue;
      }
      if (job.lateral.length && point.z > Math.min(...job.lateral) + 2) {
        this.removeCurrentJob();
        this.rejectedRoads++;
        this.version++;
        continue;
      }
      const previous = job.index > 0 ? job.points[job.index - 1] : undefined;
      const beforePrevious =
        job.index > 1 ? job.points[job.index - 2] : undefined;
      const grade = previous
        ? (point.z - previous.z) /
          Math.hypot(point.x - previous.x, point.y - previous.y)
        : 0;
      const previousGrade =
        previous && beforePrevious
          ? (previous.z - beforePrevious.z) /
            Math.hypot(
              previous.x - beforePrevious.x,
              previous.y - beforePrevious.y,
            )
          : grade;
      if (
        previous &&
        (Math.abs(grade) > 0.25 || Math.abs(grade - previousGrade) > 0.2)
      ) {
        this.removeCurrentJob();
        this.rejectedRoads++;
        this.version++;
        continue;
      }
      job.index++;
      job.probe = 0;
      job.lateral = [];
      if (job.index === job.points.length) {
        this.validated.edges.set(job.edge.id, {
          ...job.edge,
          points: job.points,
        });
        this.removeCurrentJob();
        this.version++;
      }
    }
    this.nextReadyAt = skipped === this.queue.length ? earliestRetry : 0;
    this.sampleMs = this.now() - start;
  }
  private removeCurrentJob(): void {
    this.queue.splice(this.cursor, 1);
    if (this.cursor >= this.queue.length) this.cursor = 0;
  }
  getValidatedGraph(): { edges: Map<string, E> } {
    const edges = new Map<string, E>();
    const pending = new Set(this.queue.map((job) => job.edge.id));
    for (const edge of this.validated.edges.values())
      edges.set(edge.id, {
        ...edge,
        pendingContinuation: edge.outgoing.some((id) => pending.has(id)),
        outgoing: edge.outgoing.filter((id) => {
          const next = this.validated.edges.get(id);
          return (
            next && Math.abs(next.points[0]!.z - edge.points.at(-1)!.z) <= 1
          );
        }),
      });
    return { edges };
  }
  dispose(): void {
    this.queue = [];
    this.cursor = 0;
    this.nextReadyAt = 0;
    this.priorityCenter = null;
    this.validated = { edges: new Map() };
    this.version++;
  }
}
