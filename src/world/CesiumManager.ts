import * as Cesium from "cesium";

export class CesiumManager {
  private viewer: Cesium.Viewer | null = null;

  init(containerId: string, ionToken?: string): void {
    if (ionToken) {
      Cesium.Ion.defaultAccessToken = ionToken;
    }

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

    // Disable atmosphere/fog for close-range flying
    if (this.viewer.scene.skyAtmosphere) {
      this.viewer.scene.skyAtmosphere.show = false;
    }
    this.viewer.scene.fog.enabled = false;

    // Near/far clip for drone-scale (0.1m to 5000m)
    this.viewer.camera.frustum.near = 0.1;
    (this.viewer.camera.frustum as Cesium.PerspectiveFrustum).far = 5000;
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
