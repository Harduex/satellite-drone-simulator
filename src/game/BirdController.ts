import * as Cesium from 'cesium';
import { enuToEcef } from '../world/CoordUtils';
import { BirdSimulation } from '../birds/BirdSimulation';
import { BirdRenderer } from '../world/birds/BirdRenderer';
import { BIRDS_CONFIG } from '../birds/BirdConfig';
import type { Point3, BirdFrame } from '../birds/BirdTypes';
import type { PerformanceTimings } from './PerformanceTimings';

export interface BirdControllerOptions {
  viewer: Cesium.Viewer;
  enuFrame: Cesium.Matrix4;
  spawn: Point3;
  readDronePosition: () => Point3;
  exclusionsChanged: (objects: readonly object[]) => void;
  timings?: PerformanceTimings;
}

export class BirdController {
  private simulation = new BirdSimulation();
  private renderer: BirdRenderer | null = null;
  private enabled = false;
  private paused = true;
  private disposed = false;
  private exposure = 1;

  private removeFrame: Cesium.Event.RemoveCallback | null = null;
  private lastFrame = 0;
  private accumulator = 0;
  private elapsedSeconds = 0;
  private lastFrames: BirdFrame[] = [];
  private visibilityVolume: Cesium.CullingVolume | null = null;
  private visibilitySphere = new Cesium.BoundingSphere(new Cesium.Cartesian3(), 25);
  private isVisible = (point: Point3): boolean => {
    const camera = this.options.viewer.scene.camera;
    this.visibilityVolume ??= camera.frustum.computeCullingVolume(camera.positionWC, camera.directionWC, camera.upWC);
    const world = enuToEcef(point, this.options.enuFrame);
    Cesium.Cartesian3.clone(world, this.visibilitySphere.center);
    return this.visibilityVolume.computeVisibility(this.visibilitySphere) !== Cesium.Intersect.OUTSIDE;
  };

  constructor(private options: BirdControllerOptions) {}

  start(): void {
    if (this.disposed) return;
    this.paused = false;
    this.lastFrame = performance.now();
    this.removeFrame ??= this.options.viewer.scene.preUpdate.addEventListener(() => this.tick());
    if (this.enabled) {
      this.activate();
    }
  }

  setEnabled(enabled: boolean): void {
    if (this.disposed || this.enabled === enabled) return;
    this.enabled = enabled;
    if (enabled) {
      if (!this.paused) {
        this.activate();
      }
    } else {
      this.clearActors();
    }
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.renderer?.setPaused(true);
  }

  resume(): void {
    if (!this.paused || this.disposed) return;
    this.paused = false;
    this.lastFrame = performance.now();
    this.renderer?.setPaused(false);
    if (this.enabled && !this.renderer) {
      this.activate();
    }
  }

  reset(): void {
    this.clearActors();
    if (this.enabled && !this.paused) {
      this.activate();
    }
  }

  setEnvironmentExposure(exposure: number): void {
    this.exposure = exposure;
    this.renderer?.setEnvironmentExposure(exposure);
  }

  private activate(): void {
    if (this.disposed || this.renderer) return;

    this.renderer = new BirdRenderer(
      this.options.viewer,
      this.options.enuFrame,
      () => this.options.exclusionsChanged(this.renderer?.getExclusions() ?? []),
    );
    this.renderer.setEnvironmentExposure(this.exposure);

    const initialPos = this.options.readDronePosition();
    this.simulation.spawnFlocks(initialPos);
    this.accumulator = 0;
    this.elapsedSeconds = 0;
    this.lastFrames = this.simulation.step(BIRDS_CONFIG.updateDt);
  }

  private clearActors(): void {
    this.renderer?.dispose();
    this.renderer = null;
    this.options.exclusionsChanged([]);
    this.lastFrames = [];
    this.visibilityVolume = null;
  }

  private tick(): void {
    if (this.disposed || this.paused || !this.enabled || !this.renderer) return;

    const tickStart = this.options.timings?.begin() ?? 0;
    const now = performance.now();
    const dt = Math.min(0.2, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;

    this.accumulator += dt;
    this.elapsedSeconds += dt;
    const dronePos = this.options.readDronePosition();

    this.visibilityVolume = null;

    const stepDt = BIRDS_CONFIG.updateDt;
    while (this.accumulator >= stepDt) {
      this.simulation.maintainPopulation(dronePos, this.isVisible);
      this.lastFrames = this.simulation.step(stepDt, dronePos);
      this.accumulator -= stepDt;
    }

    const alpha = Math.max(0, Math.min(1, this.accumulator / stepDt));
    const actorsStart = this.options.timings?.begin() ?? 0;
    this.renderer.update(this.lastFrames, alpha, this.elapsedSeconds);

    this.options.timings?.end('birdActors', actorsStart);
    this.options.timings?.end('birds', tickStart);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.removeFrame?.();
    this.removeFrame = null;
    this.clearActors();
  }
}
