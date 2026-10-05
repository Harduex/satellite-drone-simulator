import * as Cesium from "cesium";
import type { VehicleFrame, VehiclePose } from "../../traffic/TrafficTypes";
import { TRAFFIC_MODELS } from "../../traffic/TrafficConfig";

const PALETTE = [
  "#b93832",
  "#235991",
  "#d4d7d9",
  "#393d42",
  "#e4d9bd",
  "#397158",
];
export function interpolatePose(
  a: VehiclePose,
  b: VehiclePose,
  alpha: number,
): VehiclePose {
  alpha = Math.max(0, Math.min(1, alpha));
  const delta = Math.atan2(
    Math.sin(b.heading - a.heading),
    Math.cos(b.heading - a.heading),
  );
  return {
    position: {
      x: a.position.x + (b.position.x - a.position.x) * alpha,
      y: a.position.y + (b.position.y - a.position.y) * alpha,
      z: a.position.z + (b.position.z - a.position.z) * alpha,
    },
    heading: a.heading + delta * alpha,
    pitch: a.pitch + (b.pitch - a.pitch) * alpha,
  };
}
interface RenderCar {
  model: Cesium.Model;
  modelIndex: number;
  shader: Cesium.CustomShader;
}
export class TrafficRenderer {
  private cars = new Map<number, RenderCar>();
  private pending = new Set<number>();
  private desired = new Set<number>();
  private disposed = false;
  private paused = false;
  private environmentExposure = 1;
  private failedModels = new Set<number>();
  private credit = new Cesium.Credit(
    '<a href="https://openfreemap.org/">OpenFreeMap</a> · <a href="https://openmaptiles.org/">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a> · Cars: Kenney + originals (CC0)',
    true,
  );
  private scratchRotation = new Cesium.Matrix3();
  private scratchLocal = new Cesium.Matrix4();
  private scratchMatrix = new Cesium.Matrix4();
  private scene: Cesium.Scene;
  constructor(
    private viewer: Cesium.Viewer,
    private frame: Cesium.Matrix4,
    private exclusionsChanged: () => void,
  ) {
    this.scene = viewer.scene;
    viewer.creditDisplay.addStaticCredit(this.credit);
  }
  getExclusions(): readonly object[] {
    return [...this.cars.values()].map((c) => c.model);
  }
  setPaused(paused: boolean): void {
    this.paused = paused;
  }
  setEnvironmentExposure(exposure: number): void {
    if (!Number.isFinite(exposure)) return;
    const normalized = Math.max(0.01, Math.min(1, exposure));
    if (normalized === this.environmentExposure) return;
    this.environmentExposure = normalized;
    for (const car of this.cars.values())
      car.shader.setUniform("u_environmentExposure", this.environmentExposure);
  }
  update(frames: readonly VehicleFrame[], alpha: number): void {
    if (this.disposed) return;
    this.desired = new Set(frames.map((f) => f.id));
    let changed = false;
    for (const [id, car] of this.cars)
      if (!this.desired.has(id)) {
        this.scene.primitives.remove(car.model);
        car.shader.destroy();
        this.cars.delete(id);
        changed = true;
      }
    if (changed) this.exclusionsChanged();
    for (const frame of frames) {
      const car = this.cars.get(frame.id);
      if (!car) {
        if (
          !this.failedModels.has(frame.modelIndex) &&
          !this.pending.has(frame.id) &&
          this.pending.size < 4
        )
          this.load(frame);
        continue;
      }
      const pose = interpolatePose(frame.previous, frame.current, alpha);
      // The normalized asset uses X forward; ENU heading is clockwise from north.
      const rotation = Cesium.Matrix3.fromHeadingPitchRoll(
        new Cesium.HeadingPitchRoll(pose.heading - Math.PI / 2, pose.pitch, 0),
        this.scratchRotation,
      );
      Cesium.Matrix4.fromRotationTranslation(
        rotation,
        new Cesium.Cartesian3(
          pose.position.x,
          pose.position.y,
          pose.position.z + 0.12,
        ),
        this.scratchLocal,
      );
      Cesium.Matrix4.multiply(
        this.frame,
        this.scratchLocal,
        this.scratchMatrix,
      );
      Cesium.Matrix4.clone(this.scratchMatrix, car.model.modelMatrix);
    }
  }
  private load(frame: VehicleFrame): void {
    this.pending.add(frame.id);
    const color = Cesium.Color.fromCssColorString(
      PALETTE[frame.colorIndex] ?? PALETTE[0]!,
    );
    const shader = new Cesium.CustomShader({
      uniforms: {
        u_environmentExposure: {
          type: Cesium.UniformType.FLOAT,
          value: this.environmentExposure,
        },
        u_bodyColor: {
          type: Cesium.UniformType.VEC3,
          value: new Cesium.Cartesian3(color.red, color.green, color.blue),
        },
      },
      fragmentShaderText:
        "void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) { if (material.diffuse.r > 0.95 && material.diffuse.b > 0.95 && material.diffuse.g < 0.01) { material.diffuse = u_bodyColor; } material.diffuse *= u_environmentExposure; material.emissive *= u_environmentExposure; }",
    });
    const matrix = Cesium.Matrix4.clone(this.frame);
    void Cesium.Model.fromGltfAsync({
      url: `${import.meta.env.BASE_URL}models/traffic/${(TRAFFIC_MODELS[frame.modelIndex] ?? TRAFFIC_MODELS[0]).name}.glb`,
      modelMatrix: matrix,
      upAxis: Cesium.Axis.Z,
      forwardAxis: Cesium.Axis.X,
      shadows: Cesium.ShadowMode.DISABLED,
      customShader: shader,
      incrementallyLoadTextures: false,
      environmentMapOptions: { enabled: false },
    })
      .then((model) => {
        if (this.disposed || this.paused || !this.desired.has(frame.id)) {
          model.destroy();
          shader.destroy();
          return;
        }
        shader.setUniform("u_environmentExposure", this.environmentExposure);
        this.scene.primitives.add(model);
        this.cars.set(frame.id, {
          model,
          modelIndex: frame.modelIndex,
          shader,
        });
        this.exclusionsChanged();
      })
      .catch((error) => {
        shader.destroy();
        this.failedModels.add(frame.modelIndex);
        if (!this.disposed)
          console.warn(
            "Traffic model unavailable",
            error instanceof Error ? error.message : "asset failure",
          );
      })
      .finally(() => this.pending.delete(frame.id));
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.desired.clear();
    for (const car of this.cars.values()) {
      this.scene.primitives.remove(car.model);
      car.shader.destroy();
    }
    this.cars.clear();
    this.exclusionsChanged();
    this.viewer.creditDisplay.removeStaticCredit(this.credit);
  }
}
