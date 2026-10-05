import * as Cesium from 'cesium';
import { ecefToEnu, enuToEcef } from '../world/CoordUtils';
import { RoadSource, selectCoverageTiles } from '../traffic/RoadSource';
import { advanceTrafficTime } from './TrafficController';
import { TrafficSurface } from '../world/traffic/TrafficSurface';
import { decodePedestrianTile } from '../pedestrians/PedestrianSource';
import { buildPedestrianGraph } from '../pedestrians/PedestrianGraph';
import { PedestrianSimulation } from '../pedestrians/PedestrianSimulation';
import { PedestrianRenderer } from '../world/pedestrians/PedestrianRenderer';
import { PEDESTRIANS } from '../pedestrians/PedestrianConfig';
import type { WalkingPath, WalkingEdge } from '../pedestrians/PedestrianTypes';
import type { Point3 } from '../traffic/TrafficTypes';
import type { PedestrianDiagnosticsSnapshot } from '../store/diagnosticsSlice';
interface PedestrianOptions {
    viewer: Cesium.Viewer;
    enuFrame: Cesium.Matrix4;
    spawn: Point3;
    readDronePosition: () => Point3;
    readBaseExclusions: () => readonly object[];
    exclusionsChanged: (objects: readonly object[]) => void;
    publish: (counters: PedestrianDiagnosticsSnapshot | null) => void;
    diagnosticsEnabled: () => boolean;
}
export class PedestrianController {
    private source: RoadSource<WalkingPath>;
    private surface: TrafficSurface<WalkingEdge>;
    private renderer: PedestrianRenderer | null = null;
    private simulation = new PedestrianSimulation();
    private inverse: Cesium.Matrix4;
    private enabled = false;
    private paused = true;
    private disposed = false;
    private exposure = 1;
    private removeFrame: Cesium.Event.RemoveCallback | null = null;
    private abort: AbortController | null = null;
    private loading: Promise<void> | null = null;
    private generation = 0;
    private center: Point3 | null = null;
    private triggeredAt: number | null = null;
    private lastFrame = 0;
    private accumulator = 0;
    private surfaceVersion = -1;
    private lastGraphUpdate = 0;
    private lastPublish = 0;
    private refreshes = 0;
    constructor(private options: PedestrianOptions) {
        this.inverse = Cesium.Matrix4.inverseTransformation(options.enuFrame, new Cesium.Matrix4());
        const origin = Cesium.Cartographic.fromCartesian(Cesium.Matrix4.getTranslation(options.enuFrame, new Cesium.Cartesian3()));
        this.source = new RoadSource<WalkingPath>(point => ecefToEnu(Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, origin.height), this.inverse), undefined, { ...PEDESTRIANS, decode: decodePedestrianTile });
        this.surface = new TrafficSurface<WalkingEdge>(point => this.sample(point), undefined, { samples: PEDESTRIANS.surfaceSamples, ms: PEDESTRIANS.surfaceMs, spacing: 12, lateral: 0 });
    }
    private sample(point: Point3): number | undefined {
        const scene = this.options.viewer.scene;
        if (!scene.sampleHeightSupported)
            return undefined;
        const carto = Cesium.Cartographic.fromCartesian(enuToEcef(point, this.options.enuFrame));
        const height = scene.sampleHeight(carto, [...this.options.readBaseExclusions(), ...(this.renderer?.getExclusions() ?? [])]);
        if (height === undefined || !Number.isFinite(height))
            return undefined;
        const position = ecefToEnu(Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, height), this.inverse);
        return Math.abs(position.z) <= 10000 ? position.z : undefined;
    }
    start(): void { if (this.disposed)
        return; this.paused = false; this.lastFrame = performance.now(); this.removeFrame ??= this.options.viewer.scene.preUpdate.addEventListener(() => this.tick()); if (this.enabled)
        this.activate(); }
    setEnabled(enabled: boolean): void {
        if (this.disposed || this.enabled === enabled)
            return;
        this.enabled = enabled;
        if (enabled) {
            if (!this.paused)
                this.activate();
        }
        else {
            this.cancel();
            this.clearActors();
            this.options.publish(null);
        }
    }
    setEnvironmentExposure(exposure: number): void { if (!Number.isFinite(exposure))
        return; this.exposure = Math.max(.01, Math.min(1, exposure)); this.renderer?.setEnvironmentExposure(this.exposure); }
    private activate(): void {
        this.renderer ??= new PedestrianRenderer(this.options.viewer, this.options.enuFrame, () => this.options.exclusionsChanged(this.renderer?.getExclusions() ?? []));
        this.renderer.setEnvironmentExposure(this.exposure);
        void this.refresh(this.options.readDronePosition());
    }
    private cancel(): void { this.generation++; this.abort?.abort(); this.abort = null; this.triggeredAt = null; }
    pause(): void { this.paused = true; this.renderer?.setPaused(true); this.cancel(); this.accumulator = 0; }
    resume(): void { if (this.disposed)
        return; this.paused = false; this.renderer?.setPaused(false); this.lastFrame = performance.now(); if (this.enabled)
        this.activate(); }
    private clearActors(): void { this.renderer?.dispose(); this.renderer = null; this.surface.dispose(); this.simulation.setGraph({ edges: new Map() }); this.simulation.reset(this.options.readDronePosition()); this.center = null; this.surfaceVersion = -1; this.accumulator = 0; }
    reset(): void { if (this.disposed)
        return; this.cancel(); this.clearActors(); if (this.enabled && !this.paused)
        this.activate(); }
    private async refresh(position: Point3): Promise<void> {
        const center = { ...position };
        this.cancel();
        const generation = this.generation, abort = new AbortController();
        this.abort = abort;
        this.center = center;
        this.refreshes++;
        const previous = this.loading;
        const task = async () => {
            if (previous)
                await previous;
            if (abort.signal.aborted || this.disposed)
                return;
            const carto = Cesium.Cartographic.fromCartesian(enuToEcef(center, this.options.enuFrame));
            try {
                const paths = await this.source.loadTiles(selectCoverageTiles({ longitude: Cesium.Math.toDegrees(carto.longitude), latitude: Cesium.Math.toDegrees(carto.latitude) }, PEDESTRIANS), abort.signal);
                if (this.disposed || this.paused || !this.enabled || generation !== this.generation)
                    return;
                this.surface.prepare(buildPedestrianGraph(paths, center));
            }
            catch (error) {
                if (!abort.signal.aborted)
                    console.warn('Pedestrian paths unavailable', error instanceof Error ? error.message : 'source failure');
            }
        };
        this.loading = task();
        await this.loading;
    }
    private tick(): void {
        if (this.disposed || this.paused || !this.enabled)
            return;
        const now = performance.now(), position = this.options.readDronePosition();
        if (this.center && Math.hypot(position.x - this.center.x, position.y - this.center.y) >= PEDESTRIANS.refreshDistance) {
            this.triggeredAt ??= now;
            if (now - this.triggeredAt >= PEDESTRIANS.debounceMs)
                void this.refresh(position);
        }
        this.surface.processFrame();
        if (this.surfaceVersion !== this.surface.version && now - this.lastGraphUpdate >= 500) {
            this.simulation.setGraph(this.surface.getValidatedGraph());
            this.surfaceVersion = this.surface.version;
            this.lastGraphUpdate = now;
        }
        this.simulation.setCenter(position);
        const clock = advanceTrafficTime(this.accumulator, (now - this.lastFrame) / 1000);
        this.lastFrame = now;
        this.accumulator = clock.remainder;
        const start = performance.now();
        for (let i = 0; i < clock.steps; i++)
            this.simulation.step(PEDESTRIANS.step);
        const updateMs = performance.now() - start;
        this.renderer?.update(this.simulation.getFrames(), this.accumulator / PEDESTRIANS.step);
        if (this.options.diagnosticsEnabled() && now - this.lastPublish >= 1000) {
            this.lastPublish = now;
            this.options.publish({ people: this.simulation.getFrames().length, renderedPeople: this.renderer?.getExclusions().length ?? 0, paths: this.surface.getValidatedGraph().edges.size, cachedTiles: this.source.cachedTiles, cachedBytes: this.source.cachedBytes, pendingRequests: this.source.pendingRequests, requestFailures: this.source.requestFailures, refreshes: this.refreshes, updateMs, surfaceSamples: this.surface.samples, surfaceMs: this.surface.sampleMs, pendingPaths: this.surface.pending, rejectedPaths: this.surface.rejectedRoads });
        }
    }
    dispose(): void { if (this.disposed)
        return; this.disposed = true; this.cancel(); this.removeFrame?.(); this.removeFrame = null; this.clearActors(); this.source.clear(); this.options.publish(null); }
}
