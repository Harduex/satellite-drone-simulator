import type { Point3, RoadEdge, RoadGraph } from "../../traffic/TrafficTypes";
import { TRAFFIC } from "../../traffic/TrafficConfig";

interface SurfaceJob {
  edge: RoadEdge;
  points: Point3[];
  index: number;
  attempts: number;
  readyAt: number;
  probe: number;
  lateral: number[];
}
export class TrafficSurface {
  private queue: SurfaceJob[] = [];
  private validated: RoadGraph = { edges: new Map() };
  version = 0;
  rejectedRoads = 0;
  samples = 0;
  sampleMs = 0;
  constructor(
    private sample: (point: Point3) => number | undefined,
    private now: () => number = () => performance.now(),
  ) {}
  get pending(): number {
    return this.queue.length;
  }
  prepare(graph: RoadGraph): void {
    const old = this.validated.edges;
    this.validated = { edges: new Map() };
    this.queue = [];
    for (const edge of graph.edges.values()) {
      const retained = old.get(edge.id);
      if (retained) {
        this.validated.edges.set(edge.id, {
          ...edge,
          points: retained.points,
        });
        continue;
      }
      const points: Point3[] = [];
      for (let i = 1; i < edge.points.length; i++) {
        const a = edge.points[i - 1]!,
          b = edge.points[i]!;
        const count = Math.max(
          1,
          Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 25),
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
  processFrame(): void {
    const start = this.now();
    this.samples = 0;
    while (
      this.queue.length &&
      this.samples < TRAFFIC.surfaceSamples &&
      this.now() - start < TRAFFIC.surfaceMs
    ) {
      const job = this.queue[0]!;
      if (job.readyAt > this.now()) break;
      const point = job.points[job.index]!;
      const a = job.points[0]!,
        b = job.points.at(-1)!;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const side = job.probe === 1 ? 6 : job.probe === 2 ? -6 : 0;
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
        this.queue.shift();
        job.attempts++;
        if (job.attempts < 3) {
          job.readyAt = this.now() + 1000;
          job.index = 0;
          job.probe = 0;
          job.lateral = [];
          this.queue.push(job);
        } else {
          this.rejectedRoads++;
          this.version++;
        }
        continue;
      }
      if (job.probe === 0) point.z = height;
      else job.lateral.push(height);
      if (!job.edge.bridge && job.probe < 2) {
        job.probe++;
        continue;
      }
      if (job.lateral.length && point.z > Math.min(...job.lateral) + 2) {
        this.queue.shift();
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
        this.queue.shift();
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
        this.queue.shift();
        this.version++;
      }
    }
    this.sampleMs = this.now() - start;
  }
  getValidatedGraph(): RoadGraph {
    const edges = new Map<string, RoadEdge>();
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
    this.validated = { edges: new Map() };
    this.version++;
  }
}
