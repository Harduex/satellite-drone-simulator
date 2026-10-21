import type * as Cesium from 'cesium';
import type { PerformanceTimings } from './PerformanceTimings';

type PrepareSurfaces = (allowQuery: () => boolean) => void;
const OPTIONAL_SLICE_MS = 2;
const UPDATE_DEADLINE_MS = 6;
const MAX_QUERIES = 2;

/** Admission limits cannot interrupt a synchronous scene query already in progress. */
export class PopulationSurfaceScheduler {
  private removePreUpdate: Cesium.Event.RemoveCallback | null = null;
  private removePostUpdate: Cesium.Event.RemoveCallback | null = null;
  private frameStart: number | null = null;
  private deadline = 0;
  private queries = 0;
  private roadsFirst = true;
  private paused = false;
  private readonly allowQuery = () => {
    if (this.queries >= MAX_QUERIES || performance.now() >= this.deadline) return false;
    this.queries++;
    return true;
  };

  constructor(
    private scene: Pick<Cesium.Scene, 'preUpdate' | 'postUpdate'>,
    private roads: PrepareSurfaces,
    private paths: PrepareSurfaces,
    private timings?: PerformanceTimings,
  ) {}

  /** Register before flight listeners so the deadline includes the flight update. */
  start(): void {
    if (this.removePreUpdate) return;
    this.removePreUpdate = this.scene.preUpdate.addEventListener(() => {
      this.frameStart = this.paused ? null : performance.now();
    });
    this.removePostUpdate = this.scene.postUpdate.addEventListener(() => {
      const start = this.timings?.begin() ?? 0;
      this.prepare();
      this.timings?.end('populationSurfaces', start);
    });
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.frameStart = null;
  }

  private prepare(): void {
    if (this.paused || this.frameStart === null) return;
    const now = performance.now();
    this.deadline = Math.min(this.frameStart + UPDATE_DEADLINE_MS, now + OPTIONAL_SLICE_MS);
    this.frameStart = null;
    if (now >= this.deadline) return;
    this.queries = 0;
    const first = this.roadsFirst ? this.roads : this.paths;
    const second = this.roadsFirst ? this.paths : this.roads;
    this.roadsFirst = !this.roadsFirst;
    first(this.allowQuery);
    if (this.queries < MAX_QUERIES && performance.now() < this.deadline) second(this.allowQuery);
  }

  dispose(): void {
    this.removePreUpdate?.(); this.removePreUpdate = null;
    this.removePostUpdate?.(); this.removePostUpdate = null;
    this.frameStart = null;
  }
}
