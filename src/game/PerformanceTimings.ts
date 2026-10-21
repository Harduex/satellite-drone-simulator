import type { DurationSummary, PerformanceSnapshot, PerformanceStage } from '../store/diagnosticsSlice';

const SAMPLE_LIMIT = 600;
const STAGES: readonly PerformanceStage[] = [
  'flight', 'contacts', 'physics', 'surfaceQuery', 'renderSubmission',
  'populationSurfaces',
  'traffic', 'trafficSurface', 'trafficGraph', 'trafficSimulation', 'trafficActors',
  'pedestrians', 'pedestrianSurface', 'pedestrianGraph', 'pedestrianSimulation', 'pedestrianActors',
];

class DurationSamples {
  private readonly values = new Float64Array(SAMPLE_LIMIT);
  private count = 0;
  private cursor = 0;

  clear(): void { this.count = this.cursor = 0; }

  record(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) return;
    this.values[this.cursor] = ms;
    this.cursor = (this.cursor + 1) % SAMPLE_LIMIT;
    this.count = Math.min(SAMPLE_LIMIT, this.count + 1);
  }

  countAbove(ms: number): number {
    let result = 0;
    for (let i = 0; i < this.count; i++) if (this.values[i]! > ms) result++;
    return result;
  }

  summary(): DurationSummary {
    const sorted = this.values.slice(0, this.count).sort();
    const n = sorted.length;
    if (!n) return { count: 0, meanMs: 0, medianMs: 0, p95Ms: 0, p99Ms: 0, maxMs: 0 };
    let total = 0;
    for (const ms of sorted) total += ms;
    return {
      count: n, meanMs: total / n,
      medianMs: (sorted[Math.floor((n - 1) / 2)]! + sorted[Math.floor(n / 2)]!) / 2,
      p95Ms: sorted[Math.ceil(n * 0.95) - 1]!,
      p99Ms: sorted[Math.ceil(n * 0.99) - 1]!, maxMs: sorted[n - 1]!,
    };
  }
}

/** CPU wall times include GPU waits; samples are bounded independently per stage. */
export class PerformanceTimings {
  private enabled = false;
  private readonly frameIntervals = new DurationSamples();
  private readonly stages = Object.fromEntries(
    STAGES.map(stage => [stage, new DurationSamples()]),
  ) as Record<PerformanceStage, DurationSamples>;

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.reset();
  }

  reset(): void {
    this.frameIntervals.clear();
    for (const stage of STAGES) this.stages[stage].clear();
  }

  begin(): number { return this.enabled ? performance.now() : 0; }

  end(stage: PerformanceStage, start: number): void {
    if (this.enabled) this.record(stage, performance.now() - start);
  }

  record(stage: PerformanceStage, ms: number): void {
    if (this.enabled) this.stages[stage].record(ms);
  }

  recordFrame(ms: number): void {
    if (this.enabled && ms > 0) this.frameIntervals.record(ms);
  }

  snapshot(): PerformanceSnapshot {
    return {
      frameIntervals: this.frameIntervals.summary(),
      framesOver33Ms: this.frameIntervals.countAbove(1000 / 30),
      framesOver50Ms: this.frameIntervals.countAbove(50),
      stages: Object.fromEntries(
        STAGES.map(stage => [stage, this.stages[stage].summary()]),
      ) as Record<PerformanceStage, DurationSummary>,
    };
  }
}
