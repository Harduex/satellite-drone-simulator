import * as Cesium from 'cesium';
import type { BirdFrame, BirdSpecies } from '../../birds/BirdTypes';
import { SPECIES_CONFIGS } from '../../birds/BirdConfig';

const BIRD_CREDIT = 'Birds (adapted): <a href="https://sketchfab.com/3d-models/animated-bird-pigeon-797d27b68af3453e865149435df6aa30">dudecon</a>, '
  + '<a href="https://sketchfab.com/3d-models/low-poly-seagull-with-animation-rigged-985024328902444c8270c0f09acc897e">simonaskLDE</a>, '
  + '<a href="https://sketchfab.com/3d-models/low-poly-eagle-60578c2b11064a2da915ea899614b0b8">Nikola1998</a> '
  + '(<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>)';

export function makeBirdRotation(
  heading: number,
  pitch: number,
  roll: number,
  result = new Cesium.Matrix3(),
): Cesium.Matrix3 {
  const rotZ = Cesium.Matrix3.fromRotationZ(-heading, scratchRotZ);
  const rotX = Cesium.Matrix3.fromRotationX(pitch, scratchRotX);
  const rotY = Cesium.Matrix3.fromRotationY(roll, scratchRotY);
  Cesium.Matrix3.multiply(rotZ, rotX, scratchM1);
  return Cesium.Matrix3.multiply(scratchM1, rotY, result);
}

const scratchRotZ = new Cesium.Matrix3();
const scratchRotX = new Cesium.Matrix3();
const scratchRotY = new Cesium.Matrix3();
const scratchM1 = new Cesium.Matrix3();

const PIGEON_TINTS = [
  new Cesium.Cartesian3(1.0, 1.0, 1.0),     // 0: Classic slate/grey (original texture)
  new Cesium.Cartesian3(0.9, 0.6, 0.45),    // 1: Brown / chestnut
  new Cesium.Cartesian3(0.28, 0.28, 0.32),  // 2: Black / dark charcoal
  new Cesium.Cartesian3(1.5, 1.5, 1.55),    // 3: White
];

interface RenderBird {
  model: Cesium.Model;
  shader: Cesium.CustomShader | null;
  animated: boolean;
  species: BirdSpecies;
  flapping: boolean;
  phase: number;
  animationElapsed: number;
}

function interpolateAngle(a: number, b: number, t: number): number {
  let diff = (b - a) % (2 * Math.PI);
  if (diff > Math.PI) diff -= 2 * Math.PI;
  if (diff < -Math.PI) diff += 2 * Math.PI;
  return a + diff * t;
}

export class BirdRenderer {
  private birds = new Map<number, RenderBird>();
  private pending = new Set<number>();
  private desired = new Set<number>();
  private failed = new Set<string>();
  private disposed = false;
  private paused = false;
  private generation = 0;
  private exposure = 1;
  private elapsedSeconds = 0;

  private rotation = new Cesium.Matrix3();
  private local = new Cesium.Matrix4();
  private matrix = new Cesium.Matrix4();
  private translation = new Cesium.Cartesian3();

  constructor(
    private viewer: Cesium.Viewer,
    private enuFrame: Cesium.Matrix4,
    private exclusionsChanged: () => void,
  ) {}

  getExclusions(): readonly object[] {
    return [...this.birds.values()].map(b => b.model);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.generation++;
    }
  }

  setEnvironmentExposure(exposure: number): void {
    if (!Number.isFinite(exposure)) return;
    this.exposure = Math.max(0.01, Math.min(1, exposure));
    for (const b of this.birds.values()) {
      b.shader?.setUniform('u_environmentExposure', this.exposure);
    }
  }

  update(frames: readonly BirdFrame[], alpha: number, elapsedSeconds: number): void {
    if (this.disposed || this.paused) return;
    this.elapsedSeconds = elapsedSeconds;

    this.desired = new Set(frames.map(f => f.id));
    let changed = false;

    // Remove despawned birds
    for (const [id, bird] of this.birds) {
      if (!this.desired.has(id)) {
        this.viewer.scene.primitives.remove(bird.model);
        bird.shader?.destroy();
        this.birds.delete(id);
        changed = true;
      }
    }

    if (changed) this.exclusionsChanged();

    const t = Math.max(0, Math.min(1, alpha));
    let loads = 0;

    for (const frame of frames) {
      const bird = this.birds.get(frame.id);
      if (!bird) {
        if (loads < 2 && this.pending.size < 4 && !this.pending.has(frame.id) && !this.failed.has(frame.species)) {
          this.load(frame);
          loads++;
        }
        continue;
      }

      // Start animation once ready
      bird.flapping = frame.flapping;
      if (bird.model.ready && !bird.animated) {
        bird.model.activeAnimations.animateWhilePaused = true;
        // Daylight can hold Cesium's clock fixed; flight time also stops on pause.
        const animationTime = (duration: number) => {
          const dt = Math.max(0, this.elapsedSeconds - bird.animationElapsed);
          bird.animationElapsed = this.elapsedSeconds;
          if (bird.flapping && duration > 0) {
            bird.phase = (bird.phase + dt / duration) % 1;
          } else {
            const toGlide = bird.phase > .5 ? 1 - bird.phase : -bird.phase;
            bird.phase = (bird.phase + toGlide * Math.min(1, dt * 8) + 1) % 1;
          }
          return bird.phase;
        };
        try {
          bird.model.activeAnimations.add({
            name: 'fly',
            loop: Cesium.ModelAnimationLoop.REPEAT,
            animationTime,
          });
        } catch {
          bird.model.activeAnimations.addAll({
            loop: Cesium.ModelAnimationLoop.REPEAT,
            multiplier: 1.0,
            animationTime,
          });
        }
        bird.animated = true;
      }

      // Interpolate pose
      const prev = frame.previous;
      const curr = frame.current;
      const px = prev.position.x + (curr.position.x - prev.position.x) * t;
      const py = prev.position.y + (curr.position.y - prev.position.y) * t;
      const pz = prev.position.z + (curr.position.z - prev.position.z) * t;
      const heading = interpolateAngle(prev.heading, curr.heading, t);
      const pitch = interpolateAngle(prev.pitch, curr.pitch, t);
      const roll = interpolateAngle(prev.roll, curr.roll, t);

      makeBirdRotation(heading, pitch, roll, this.rotation);
      Cesium.Cartesian3.fromElements(px, py, pz, this.translation);
      Cesium.Matrix4.fromRotationTranslation(this.rotation, this.translation, this.local);
      Cesium.Matrix4.multiply(this.enuFrame, this.local, this.matrix);
      Cesium.Matrix4.clone(this.matrix, bird.model.modelMatrix);
    }
  }

  private load(frame: BirdFrame): void {
    this.pending.add(frame.id);
    const generation = this.generation;
    const cfg = SPECIES_CONFIGS[frame.species];

    const tint = frame.species === 'pigeon'
      ? PIGEON_TINTS[frame.colorIndex] ?? PIGEON_TINTS[0]!
      : PIGEON_TINTS[0]!;
    const shader = new Cesium.CustomShader({
      uniforms: {
        u_environmentExposure: { type: Cesium.UniformType.FLOAT, value: this.exposure },
        u_birdTint: { type: Cesium.UniformType.VEC3, value: tint },
      },
      fragmentShaderText: `
        void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
          material.diffuse *= u_birdTint;
          material.diffuse *= u_environmentExposure;
          material.emissive *= u_environmentExposure;
        }
      `,
    });

    const pose = frame.current;
    makeBirdRotation(pose.heading, pose.pitch, pose.roll, this.rotation);
    Cesium.Cartesian3.fromElements(pose.position.x, pose.position.y, pose.position.z, this.translation);
    const local = Cesium.Matrix4.fromRotationTranslation(this.rotation, this.translation, new Cesium.Matrix4());
    const modelMatrix = Cesium.Matrix4.multiply(this.enuFrame, local, new Cesium.Matrix4());

    const upAxis = cfg.upAxis === 'Y' ? Cesium.Axis.Y : Cesium.Axis.Z;
    const forwardAxis = cfg.forwardAxis === 'Z' ? Cesium.Axis.Z : Cesium.Axis.Y;

    void Cesium.Model.fromGltfAsync({
      url: `${import.meta.env.BASE_URL}models/birds/${cfg.modelName}.glb`,
      modelMatrix,
      scale: cfg.scale,
      minimumPixelSize: 18,
      credit: BIRD_CREDIT,
      showCreditsOnScreen: true,
      upAxis,
      forwardAxis,
      shadows: Cesium.ShadowMode.DISABLED,
      customShader: shader ?? undefined,
      incrementallyLoadTextures: false,
      environmentMapOptions: { enabled: false },
    })
      .then(model => {
        if (this.disposed || this.paused || generation !== this.generation || !this.desired.has(frame.id)) {
          model.destroy();
          shader?.destroy();
          return;
        }
        shader?.setUniform('u_environmentExposure', this.exposure);
        this.viewer.scene.primitives.add(model);
        this.birds.set(frame.id, {
          model,
          shader,
          animated: false,
          species: frame.species,
          flapping: frame.flapping,
          phase: frame.flapping ? (frame.id * .137) % 1 : 0,
          animationElapsed: this.elapsedSeconds,
        });
        this.exclusionsChanged();
      })
      .catch(error => {
        shader?.destroy();
        this.failed.add(frame.species);
        if (!this.disposed) {
          console.warn('Bird model unavailable:', error instanceof Error ? error.message : 'asset failure');
        }
      })
      .finally(() => {
        this.pending.delete(frame.id);
      });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation++;
    for (const bird of this.birds.values()) {
      this.viewer.scene.primitives.remove(bird.model);
      bird.shader?.destroy();
    }
    this.birds.clear();
    this.exclusionsChanged();
  }
}
