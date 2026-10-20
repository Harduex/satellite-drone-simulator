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
    this.scene.sphericalHarmonicCoefficients = Array.from({ length: 9 }, (_, i) => new Cesium.Cartesian3(i === 0 ? 1.3 : 0, i === 0 ? 1.3 : 0, i === 0 ? 1.3 : 0));
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
    const model = await Cesium.Model.fromGltfAsync({ url: '/models/drone/racing-drone.glb', shadows: Cesium.ShadowMode.DISABLED });
    if (this.disposed) { model.destroy(); return; }
    this.scene.primitives.add(model);
    model.readyEvent.addEventListener(() => {
      if (this.disposed) return;
      Cesium.Cartesian3.clone(model.boundingSphere.center, this.center);
      this.radius = Math.max(model.boundingSphere.radius, 0.01);
      this.ready = true;
      this.requestFrame();
    });
    this.requestFrame();
  }

  setPointer(x: number, y: number): void {
    if (this.reducedMotion) return;
    this.targetHeading = 0.6 + Math.max(-1, Math.min(1, x)) * 0.65;
    this.targetPitch = -0.5 + Math.max(-1, Math.min(1, y)) * 0.2;
    this.requestFrame();
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
    if (value) { this.targetHeading = this.heading = 0.6; this.targetPitch = this.pitch = -0.5; }
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
    this.widget.render();
    if (!this.ready || Math.abs(this.heading - this.targetHeading) + Math.abs(this.pitch - this.targetPitch) > 0.002) this.requestFrame();
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame); this.frame = 0;
    this.resize.disconnect();
    if (!this.widget.isDestroyed()) this.widget.destroy();
    this.canvas.remove(); this.credits.remove();
  }
}
