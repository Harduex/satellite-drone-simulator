import * as Cesium from "cesium";

export class CesiumManager {
  private viewer: Cesium.Viewer | null = null;

  init(containerId: string): void {

    this.viewer = new Cesium.Viewer(containerId, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      scene3DOnly: true,
      requestRenderMode: false,
    });

    // Disable all default camera controls — we drive the camera from physics
    const controller = this.viewer.scene.screenSpaceCameraController;
    controller.enableRotate = false;
    controller.enableTranslate = false;
    controller.enableZoom = false;
    controller.enableTilt = false;
    controller.enableLook = false;

    // Performance tuning (PRD §7.4)
    // Increase parallel tile requests
    (Cesium.RequestScheduler as unknown as Record<
      string,
      Record<string, number>
    >)
      .requestsByServer = { "tile.googleapis.com:443": 18 };

    // Blue daytime sky: completely remove the star skybox and sky atmosphere
    // so only the solid blue backgroundColor shows as the sky
    this.viewer.scene.skyBox = this.viewer.scene.skyBox && this.viewer.scene.skyBox.destroy() as never;
    if (this.viewer.scene.skyAtmosphere) {
      this.viewer.scene.skyAtmosphere.show = false;
    }
    if (this.viewer.scene.sun) this.viewer.scene.sun.show = false;
    if (this.viewer.scene.moon) this.viewer.scene.moon.show = false;
    this.viewer.scene.backgroundColor = new Cesium.Color(0.53, 0.81, 0.98, 1.0);

    // Set clock to user's current local time so sun position matches reality
    this.viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date());
    this.viewer.clock.shouldAnimate = false;

    // Disable fog (interferes with close-range viewing)
    this.viewer.scene.fog.enabled = false;
  }

  /**
   * Distance-based globe visibility toggle.
   * Hides the Cesium globe within `thresholdMeters` of spawn to prevent
   * visual conflict with Google 3D Tiles (the "second flat map" artifact).
   */
  setupGlobeToggle(spawnPosition: Cesium.Cartesian3, thresholdMeters: number = 2000): void {
    if (!this.viewer) return;
    const globe = this.viewer.scene.globe;

    // Initially hide globe (we start at spawn where 3D tiles are dense)
    globe.show = false;

    this.viewer.scene.preRender.addEventListener(() => {
      const cameraPos = this.viewer!.camera.positionWC;
      const distance = Cesium.Cartesian3.distance(cameraPos, spawnPosition);
      // Hysteresis: hide at threshold, show at threshold + 500m
      const shouldShow = globe.show
        ? distance > thresholdMeters
        : distance > thresholdMeters + 500;
      globe.show = shouldShow;
    });
  }

  getViewer(): Cesium.Viewer {
    if (!this.viewer) throw new Error("CesiumManager not initialized");
    return this.viewer;
  }

  showContainer(): void {
    if (!this.viewer) return;
    const container = this.viewer.container;
    (container as HTMLElement).style.display = "block";
  }

  hideContainer(): void {
    if (!this.viewer) return;
    const container = this.viewer.container;
    (container as HTMLElement).style.display = "none";
  }

  destroy(): void {
    this.viewer?.destroy();
    this.viewer = null;
  }
}
