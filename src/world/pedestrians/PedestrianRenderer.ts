import * as Cesium from 'cesium';
import { interpolatePose } from '../traffic/TrafficRenderer';
import { PEDESTRIAN_MODELS } from '../../pedestrians/PedestrianConfig';
import type { PedestrianFrame } from '../../pedestrians/PedestrianTypes';
const PALETTE = ['#ab5143', '#34678c', '#d3b769', '#4a7765', '#79628f', '#d1d1cb'];
interface RenderPerson {
    model: Cesium.Model;
    shader: Cesium.CustomShader;
    walked: number;
    animated: boolean;
}
export class PedestrianRenderer {
    private people = new Map<number, RenderPerson>();
    private pending = new Set<number>();
    private desired = new Set<number>();
    private failed = new Set<number>();
    private disposed = false;
    private paused = false;
    private generation = 0;
    private exposure = 1;
    private credit = new Cesium.Credit('<a href="https://openfreemap.org/">OpenFreeMap</a> · <a href="https://openmaptiles.org/">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a> · People: <a href="https://kenney.nl/assets/mini-characters">Kenney (CC0)</a>', true);
    private rotation = new Cesium.Matrix3();
    private local = new Cesium.Matrix4();
    private matrix = new Cesium.Matrix4();
    private translation = new Cesium.Cartesian3();
    constructor(private viewer: Cesium.Viewer, private enuFrame: Cesium.Matrix4, private exclusionsChanged: () => void) { viewer.creditDisplay.addStaticCredit(this.credit); }
    getExclusions(): readonly object[] { return [...this.people.values()].map(p => p.model); }
    setPaused(paused: boolean): void { this.paused = paused; if (paused)
        this.generation++; }
    setEnvironmentExposure(exposure: number): void { if (!Number.isFinite(exposure))
        return; this.exposure = Math.max(.01, Math.min(1, exposure)); for (const p of this.people.values())
        p.shader.setUniform('u_environmentExposure', this.exposure); }
    update(frames: readonly PedestrianFrame[], alpha: number): void {
        if (this.disposed || this.paused)
            return;
        this.desired = new Set(frames.map(f => f.id));
        let changed = false;
        for (const [id, p] of this.people)
            if (!this.desired.has(id)) {
                this.viewer.scene.primitives.remove(p.model);
                p.shader.destroy();
                this.people.delete(id);
                changed = true;
            }
        if (changed)
            this.exclusionsChanged();
        let loads = 0;
        for (const f of frames) {
            const p = this.people.get(f.id);
            if (!p) {
                if (loads < 2 && this.pending.size < 4 && !this.pending.has(f.id) && !this.failed.has(f.modelIndex)) {
                    this.load(f);
                    loads++;
                }
                continue;
            }
            p.walked = f.previousWalked + (f.walked - f.previousWalked) * Math.max(0, Math.min(1, alpha));
            if (p.model.ready && !p.animated) {
                // Walking follows distance even when the environment clock stays at noon.
                p.model.activeAnimations.animateWhilePaused = true;
                p.model.activeAnimations.add({ name: 'walk', loop: Cesium.ModelAnimationLoop.REPEAT, animationTime: () => ((p.walked / 1.2 + f.id * .137) % 1) });
                p.animated = true;
            }
            const pose = interpolatePose(f.previous, f.current, alpha);
            Cesium.Matrix3.fromHeadingPitchRoll(new Cesium.HeadingPitchRoll(pose.heading - Math.PI / 2, 0, 0), this.rotation);
            Cesium.Cartesian3.fromElements(pose.position.x, pose.position.y, pose.position.z + .03, this.translation);
            Cesium.Matrix4.fromRotationTranslation(this.rotation, this.translation, this.local);
            Cesium.Matrix4.multiply(this.enuFrame, this.local, this.matrix);
            Cesium.Matrix4.clone(this.matrix, p.model.modelMatrix);
        }
    }
    private load(frame: PedestrianFrame): void {
        this.pending.add(frame.id);
        const generation = this.generation, asset = PEDESTRIAN_MODELS[frame.modelIndex] ?? PEDESTRIAN_MODELS[0];
        const color = Cesium.Color.fromCssColorString(PALETTE[frame.colorIndex] ?? PALETTE[0]!);
        const shader = new Cesium.CustomShader({ uniforms: {
                u_environmentExposure: { type: Cesium.UniformType.FLOAT, value: this.exposure },
                u_shirtU: { type: Cesium.UniformType.FLOAT, value: asset.shirtU },
                u_shirtColor: { type: Cesium.UniformType.VEC3, value: new Cesium.Cartesian3(color.red, color.green, color.blue) },
            }, fragmentShaderText: 'void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) { vec2 uv = fsInput.attributes.texCoord_0; if (abs(uv.x-u_shirtU)<0.01 && uv.y>0.50 && uv.y<0.75) material.diffuse = u_shirtColor; material.diffuse *= u_environmentExposure; material.emissive *= u_environmentExposure; }' });
        const pose = frame.current;
        const local = Cesium.Matrix4.fromRotationTranslation(Cesium.Matrix3.fromHeadingPitchRoll(new Cesium.HeadingPitchRoll(pose.heading - Math.PI / 2, 0, 0)), new Cesium.Cartesian3(pose.position.x, pose.position.y, pose.position.z + .03));
        void Cesium.Model.fromGltfAsync({ url: `${import.meta.env.BASE_URL}models/pedestrians/${asset.name}.glb`, modelMatrix: Cesium.Matrix4.multiply(this.enuFrame, local, new Cesium.Matrix4()), scale: asset.height / asset.nativeHeight, upAxis: Cesium.Axis.Y, forwardAxis: Cesium.Axis.Z, shadows: Cesium.ShadowMode.DISABLED, customShader: shader, incrementallyLoadTextures: false, environmentMapOptions: { enabled: false } }).then(model => {
            if (this.disposed || this.paused || generation !== this.generation || !this.desired.has(frame.id)) {
                model.destroy();
                shader.destroy();
                return;
            }
            shader.setUniform('u_environmentExposure', this.exposure);
            this.viewer.scene.primitives.add(model);
            this.people.set(frame.id, { model, shader, walked: frame.walked, animated: false });
            this.exclusionsChanged();
        }).catch(error => { shader.destroy(); this.failed.add(frame.modelIndex); if (!this.disposed)
            console.warn('Pedestrian model unavailable', error instanceof Error ? error.message : 'asset failure'); }).finally(() => this.pending.delete(frame.id));
    }
    dispose(): void {
        if (this.disposed)
            return;
        this.disposed = true;
        this.generation++;
        this.desired.clear();
        for (const p of this.people.values()) {
            this.viewer.scene.primitives.remove(p.model);
            p.shader.destroy();
        }
        this.people.clear();
        this.exclusionsChanged();
        this.viewer.creditDisplay.removeStaticCredit(this.credit);
    }
}
