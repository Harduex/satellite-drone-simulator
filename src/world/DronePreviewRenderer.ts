import * as Cesium from 'cesium';

/** A local, on-demand scene; never shares the flight viewer or its render loop. */
export class DronePreviewRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly credits: HTMLDivElement;
  private readonly scene: Cesium.Scene;
  private readonly widget: Cesium.CesiumWidget;
  private readonly resize: ResizeObserver;
  private frame = 0;
  private disposed = false;
  private ready = false;
  private reducedMotion = false;
  private heading = 0.6;
  private pitch = -0.5;
  private targetHeading = 0.6;
  private targetPitch = -0.5;
  private radius = 1;
  private center = new Cesium.Cartesian3();
  private completeLoad: (() => void) | undefined;

  constructor(container: HTMLElement, private readonly onError: (error: unknown) => void) {
    this.credits = document.createElement('div');
    container.append(this.credits);
    try {
      this.widget = new Cesium.CesiumWidget(container, { globe: false, skyBox: false,
        skyAtmosphere: false, baseLayer: false, useDefaultRenderLoop: false,
        creditContainer: this.credits, requestRenderMode: true,
        contextOptions: { webgl: { alpha: true } } });
    } catch (error) { this.credits.remove(); throw error; }
    this.scene = this.widget.scene;
    this.canvas = this.scene.canvas;
    this.canvas.setAttribute('aria-label', '3D racing drone');
    this.canvas.setAttribute('role', 'img');
    this.scene.backgroundColor = Cesium.Color.TRANSPARENT;
    this.scene.screenSpaceCameraController.enableInputs = false;
    this.scene.highDynamicRange = false;
    this.scene.light = new Cesium.DirectionalLight({ direction: new Cesium.Cartesian3(-1, -0.5, -1), intensity: 2.5 });
    this.scene.renderError.addEventListener((_scene: Cesium.Scene, error: unknown) => {
      if (!this.disposed) { this.destroy(); this.onError(error); }
    });
    this.resize = new ResizeObserver(() => this.requestFrame());
    this.resize.observe(container);
  }

  async load(): Promise<void> {
    // The manual render loop idles at readyEvent, so readiness must include textures.
    const model = await Cesium.Model.fromGltfAsync({ url: '/models/drone/racing-drone.glb', shadows: Cesium.ShadowMode.DISABLED,
      incrementallyLoadTextures: false, environmentMapOptions: { enabled: false } });
    if (this.disposed) { model.destroy(); return; }
    // A studio view has no geographic atmosphere to generate lighting from.
    model.imageBasedLighting.imageBasedLightingFactor = new Cesium.Cartesian2(1, 0);
    model.imageBasedLighting.sphericalHarmonicCoefficients = Array.from({ length: 9 }, (_, i) => new Cesium.Cartesian3(i === 0 ? 3.5 : 0, i === 0 ? 3.5 : 0, i === 0 ? 3.5 : 0));
    const drawn = new Promise<void>(resolve => { this.completeLoad = resolve; });
    this.scene.primitives.add(model);
    model.errorEvent.addEventListener(error => {
      if (!this.disposed) { this.destroy(); this.onError(error); }
    });
    model.readyEvent.addEventListener(() => {
      if (this.disposed) return;
      Cesium.Cartesian3.clone(model.boundingSphere.center, this.center);
      this.radius = Math.max(model.boundingSphere.radius, 0.01);
      this.ready = true;
      this.requestFrame();
    });
    this.requestFrame();
    return drawn;
  }

  rotateBy(heading: number, pitch: number): void {
    this.targetHeading += heading;
    this.targetPitch = Math.max(-1.45, Math.min(1.45, this.targetPitch + pitch));
    if (this.reducedMotion) { this.heading = this.targetHeading; this.pitch = this.targetPitch; }
    this.requestFrame();
  }

  resetView(): void {
    this.targetHeading = 0.6; this.targetPitch = -0.5;
    if (this.reducedMotion) { this.heading = this.targetHeading; this.pitch = this.targetPitch; }
    this.requestFrame();
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
    if (value) { this.heading = this.targetHeading; this.pitch = this.targetPitch; }
    this.requestFrame();
  }

  private requestFrame(): void {
    if (!this.disposed && !this.frame) this.frame = requestAnimationFrame(() => this.render());
  }

  private render(): void {
    this.frame = 0;
    if (this.disposed) return;
    this.widget.resolutionScale = Math.min(devicePixelRatio || 1, 1.5) / (devicePixelRatio || 1);
    this.widget.resize();
    const width = Math.max(1, this.canvas.clientWidth), height = Math.max(1, this.canvas.clientHeight);
    const frustum = this.scene.camera.frustum as Cesium.PerspectiveFrustum;
    frustum.aspectRatio = width / height;
    if (this.ready) {
      this.heading += (this.targetHeading - this.heading) * 0.15;
      this.pitch += (this.targetPitch - this.pitch) * 0.15;
      frustum.near = this.radius / 100;
      frustum.far = this.radius * 100;
      const range = this.radius * 3.1 * Math.max(1, height / width);
      this.scene.camera.lookAtTransform(Cesium.Matrix4.fromTranslation(this.center), new Cesium.HeadingPitchRange(this.heading, this.pitch, range));
    }
    this.scene.requestRender();
    const framed = this.ready;
    this.widget.render();
    if (framed) { this.completeLoad?.(); this.completeLoad = undefined; }
    if (!this.ready || Math.abs(this.heading - this.targetHeading) + Math.abs(this.pitch - this.targetPitch) > 0.002) this.requestFrame();
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame); this.frame = 0;
    this.resize.disconnect();
    if (!this.widget.isDestroyed()) this.widget.destroy();
    this.completeLoad?.(); this.completeLoad = undefined;
    this.canvas.remove(); this.credits.remove();
  }
}
