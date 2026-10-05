import * as Cesium from "cesium";
import { enuToEcef, ecefToEnu } from "../world/CoordUtils";
import { RoadSource, selectCoverageTiles } from "../traffic/RoadSource";
import { buildRoadGraph } from "../traffic/RoadGraph";
import { TrafficSimulation } from "../traffic/TrafficSimulation";
import { TRAFFIC } from "../traffic/TrafficConfig";
import { TrafficSurface } from "../world/traffic/TrafficSurface";
import { TrafficRenderer } from "../world/traffic/TrafficRenderer";
import type { Point3, TrafficCounters } from "../traffic/TrafficTypes";

export function advanceTrafficTime(
  accumulator: number,
  delta: number,
): { steps: number; remainder: number } {
  const total =
    accumulator +
    Math.min(0.2, Math.max(0, Number.isFinite(delta) ? delta : 0));
  const steps = Math.min(2, Math.floor((total + 1e-9) / TRAFFIC.step));
  return {
    steps,
    remainder: Math.max(0, total - steps * TRAFFIC.step) % TRAFFIC.step,
  };
}
interface TrafficOptions {
  viewer: Cesium.Viewer;
  enuFrame: Cesium.Matrix4;
  spawn: Point3;
  longitude: number;
  readDronePosition: () => Point3;
  readEnvironmentInstant: () => Date;
  exclusionsChanged: (objects: readonly object[]) => void;
  readBaseExclusions: () => readonly object[];
  publish: (counters: TrafficCounters | null) => void;
  diagnosticsEnabled: () => boolean;
}
export class TrafficController {
  private source: RoadSource;
  private surface: TrafficSurface;
  private renderer: TrafficRenderer | null = null;
  private simulation = new TrafficSimulation();
  private inverse: Cesium.Matrix4;
  private enabled = false;
  private paused = true;
  private disposed = false;
  private removeFrame: Cesium.Event.RemoveCallback | null = null;
  private abort: AbortController | null = null;
  private loading: Promise<void> | null = null;
  private generation = 0;
  private center: Point3 | null = null;
  private coverageTriggeredAt: number | null = null;
  private lastFrame = 0;
  private accumulator = 0;
  private surfaceVersion = -1;
  private lastGraphUpdate = 0;
  private seeded = false;
  private refreshes = 0;
  private updateMs = 0;
  private lastPublish = 0;
  constructor(private options: TrafficOptions) {
    this.inverse = Cesium.Matrix4.inverseTransformation(
      options.enuFrame,
      new Cesium.Matrix4(),
    );
    const origin = Cesium.Cartographic.fromCartesian(
      Cesium.Matrix4.getTranslation(options.enuFrame, new Cesium.Cartesian3()),
    );
    this.source = new RoadSource((point) =>
      ecefToEnu(
        Cesium.Cartesian3.fromDegrees(
          point.longitude,
          point.latitude,
          origin.height,
        ),
        this.inverse,
      ),
    );
    this.surface = new TrafficSurface((point) => this.sample(point));
  }
  private sample(point: Point3): number | undefined {
    const scene = this.options.viewer.scene;
    if (!scene.sampleHeightSupported) return undefined;
    const cartographic = Cesium.Cartographic.fromCartesian(
      enuToEcef(point, this.options.enuFrame),
    );
    const height = scene.sampleHeight(cartographic, [
      ...this.options.readBaseExclusions(),
      ...(this.renderer?.getExclusions() ?? []),
    ]);
    if (height === undefined || !Number.isFinite(height)) return undefined;
    const result = ecefToEnu(
      Cesium.Cartesian3.fromRadians(
        cartographic.longitude,
        cartographic.latitude,
        height,
      ),
      this.inverse,
    );
    return Math.abs(result.z) <= 10000 ? result.z : undefined;
  }
  start(): void {
    if (this.disposed) return;
    this.paused = false;
    this.lastFrame = performance.now();
    this.removeFrame ??= this.options.viewer.scene.preUpdate.addEventListener(
      () => this.tick(),
    );
    if (this.enabled) this.activate();
  }
  setEnabled(enabled: boolean): void {
    if (this.disposed || enabled === this.enabled) return;
    this.enabled = enabled;
    if (enabled) {
      if (!this.paused) this.activate();
    } else {
      this.cancel();
      this.renderer?.dispose();
      this.renderer = null;
      this.surface.dispose();
      this.simulation.setGraph({ edges: new Map() });
      this.simulation.reset(this.options.readDronePosition());
      this.center = null;
      this.seeded = false;
      this.options.publish(null);
    }
  }
  private activate(): void {
    this.renderer ??= new TrafficRenderer(
      this.options.viewer,
      this.options.enuFrame,
      () =>
        this.options.exclusionsChanged(this.renderer?.getExclusions() ?? []),
    );
    void this.refresh(this.options.readDronePosition());
  }
  private cancel(): void {
    this.generation++;
    this.abort?.abort();
    this.abort = null;
    this.coverageTriggeredAt = null;
  }
  pause(): void {
    this.paused = true;
    this.renderer?.setPaused(true);
    this.cancel();
    this.accumulator = 0;
  }
  resume(): void {
    if (this.disposed) return;
    this.paused = false;
    this.renderer?.setPaused(false);
    this.lastFrame = performance.now();
    if (this.enabled) this.activate();
  }
  reset(): void {
    if (this.disposed) return;
    this.cancel();
    this.center = null;
    this.seeded = false;
    this.accumulator = 0;
    this.simulation.setGraph({ edges: new Map() });
    this.simulation.reset(this.options.spawn);
    this.renderer?.dispose();
    this.renderer = null;
    this.surface.dispose();
    if (this.enabled && !this.paused)
      this.renderer = new TrafficRenderer(
        this.options.viewer,
        this.options.enuFrame,
        () =>
          this.options.exclusionsChanged(this.renderer?.getExclusions() ?? []),
      );
    if (this.enabled && !this.paused) void this.refresh(this.options.spawn);
  }
  private async refresh(center: Point3): Promise<void> {
    center = { ...center };
    this.cancel();
    const generation = this.generation;
    const controller = new AbortController();
    this.abort = controller;
    this.center = { ...center };
    this.refreshes++;
    const previous = this.loading;
    const task = async () => {
      if (previous) await previous;
      if (controller.signal.aborted || this.disposed) return;
      const carto = Cesium.Cartographic.fromCartesian(
        enuToEcef(center, this.options.enuFrame),
      );
      try {
        const segments = await this.source.loadTiles(
          selectCoverageTiles({
            longitude: Cesium.Math.toDegrees(carto.longitude),
            latitude: Cesium.Math.toDegrees(carto.latitude),
          }),
          controller.signal,
        );
        if (
          this.disposed ||
          this.paused ||
          !this.enabled ||
          generation !== this.generation
        )
          return;
        this.surface.prepare(buildRoadGraph(segments, center));
      } catch (error) {
        if (!controller.signal.aborted)
          console.warn(
            "Traffic roads unavailable",
            error instanceof Error ? error.message : "source failure",
          );
      }
    };
    this.loading = task();
    await this.loading;
  }
  private tick(): void {
    if (this.disposed || this.paused || !this.enabled) return;
    const now = performance.now(),
      position = this.options.readDronePosition();
    if (
      this.center &&
      Math.hypot(position.x - this.center.x, position.y - this.center.y) >=
        TRAFFIC.refreshDistance
    ) {
      this.coverageTriggeredAt ??= now;
      if (now - this.coverageTriggeredAt >= TRAFFIC.debounceMs)
        void this.refresh(position);
    }
    this.surface.processFrame();
    if (
      this.surface.version !== this.surfaceVersion &&
      now - this.lastGraphUpdate >= 500
    ) {
      this.simulation.setGraph(this.surface.getValidatedGraph());
      this.surfaceVersion = this.surface.version;
      this.lastGraphUpdate = now;
      if (!this.seeded && this.surface.getValidatedGraph().edges.size >= 10) {
        this.simulation.reset(position);
        this.seeded = true;
      }
    }
    this.simulation.setCenter(position);
    const instant = this.options.readEnvironmentInstant();
    this.simulation.setDemand(
      instant.getUTCHours() +
        instant.getUTCMinutes() / 60 +
        this.options.longitude / 15,
    );
    const clock = advanceTrafficTime(
      this.accumulator,
      (now - this.lastFrame) / 1000,
    );
    this.lastFrame = now;
    this.accumulator = clock.remainder;
    const start = performance.now();
    for (let i = 0; i < clock.steps; i++) this.simulation.step(TRAFFIC.step);
    this.updateMs = performance.now() - start;
    this.renderer?.update(
      this.simulation.getFrames(),
      this.accumulator / TRAFFIC.step,
    );
    if (now - this.lastPublish >= 1000 && this.options.diagnosticsEnabled()) {
      this.lastPublish = now;
      this.options.publish({
        cars: this.simulation.getFrames().length,
        edges: this.surface.getValidatedGraph().edges.size,
        cachedTiles: this.source.cachedTiles,
        cachedBytes: this.source.cachedBytes,
        pendingRequests: this.source.pendingRequests,
        requestFailures: this.source.requestFailures,
        refreshes: this.refreshes,
        updateMs: this.updateMs,
        surfaceSamples: this.surface.samples,
        surfaceMs: this.surface.sampleMs,
        pendingSurfaceRoads: this.surface.pending,
        rejectedRoads: this.surface.rejectedRoads,
      });
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancel();
    this.removeFrame?.();
    this.removeFrame = null;
    this.renderer?.dispose();
    this.renderer = null;
    this.surface.dispose();
    this.source.clear();
    this.options.publish(null);
  }
}
