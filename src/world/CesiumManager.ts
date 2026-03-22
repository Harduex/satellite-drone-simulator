import * as Cesium from "cesium";

const CLOUD_LAYOUT = [
  { east: -3600, north: 3400, up: 900, width: 2400, height: 860, depth: 520, brightness: 0.97, slice: 0.5 },
  { east: -1200, north: 4700, up: 1180, width: 3200, height: 1100, depth: 680, brightness: 0.95, slice: 0.45 },
  { east: 1800, north: 3900, up: 980, width: 2600, height: 920, depth: 560, brightness: 0.94, slice: 0.52 },
  { east: 4200, north: 5200, up: 1320, width: 3400, height: 1180, depth: 740, brightness: 0.9, slice: 0.44 },
  { east: 5200, north: 1800, up: 1080, width: 2100, height: 760, depth: 460, brightness: 0.92, slice: 0.48 },
  { east: -5200, north: 1700, up: 1040, width: 2300, height: 800, depth: 500, brightness: 0.93, slice: 0.46 },
  { east: -800, north: 2600, up: 760, width: 1700, height: 620, depth: 360, brightness: 0.98, slice: 0.56 },
  { east: 2900, north: 2500, up: 820, width: 1900, height: 660, depth: 380, brightness: 0.96, slice: 0.54 },
] as const;

export class CesiumManager {
  private viewer: Cesium.Viewer | null = null;
  private globeToggleCleanup: Cesium.Event.RemoveCallback | null = null;
  private cloudCollection: Cesium.CloudCollection | null = null;
  private cloudDriftStart = performance.now();

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
      skyBox: false, // disable space/stars — drone sims always fly in daylight
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

    // Daytime sky tuning for FPV: vivid blue, natural gradient toward horizon.
    // skyAtmosphere handles all sky colour — skyBox provides the deep-space
    // background visible only at very high altitude or at night.
    if (this.viewer.scene.skyAtmosphere) {
      this.viewer.scene.skyAtmosphere.show = true;
      this.viewer.scene.skyAtmosphere.perFragmentAtmosphere = true;
      this.viewer.scene.skyAtmosphere.hueShift = 0.0;
      this.viewer.scene.skyAtmosphere.saturationShift = 0.15;
      this.viewer.scene.skyAtmosphere.brightnessShift = 0.10;
    }
    // Show sun so skyAtmosphere renders a directional gradient and the ground
    // receives natural lighting → realistic horizon colour at dawn/dusk.
    if (this.viewer.scene.sun) this.viewer.scene.sun.show = true;
    if (this.viewer.scene.moon) this.viewer.scene.moon.show = false;
    // Black background — the skyBox + skyAtmosphere cover the full sky dome at
    // FPV altitude, so the background colour is never visible in normal flight.
    this.viewer.scene.backgroundColor = new Cesium.Color(0.53, 0.81, 0.98, 1.0);
    this.viewer.scene.globe.showGroundAtmosphere = true;
    // Dynamic lighting from the sun makes the ground-atmosphere haze shift with
    // the sun angle, producing natural dawn/mid-day/dusk horizon tones.
    this.viewer.scene.globe.dynamicAtmosphereLighting = true;
    this.viewer.scene.globe.dynamicAtmosphereLightingFromSun = true;
    this.viewer.scene.globe.atmosphereHueShift = 0.0;
    this.viewer.scene.globe.atmosphereSaturationShift = 0.1;
    this.viewer.scene.globe.atmosphereBrightnessShift = 0.05;
    this.viewer.scene.globe.baseColor = new Cesium.Color(0.74, 0.86, 0.97, 1.0);

    this.cloudCollection = this.viewer.scene.primitives.add(
      new Cesium.CloudCollection({ noiseDetail: 16 }),
    );
    if (this.cloudCollection) {
      this.cloudCollection.show = false;
    }

    // Set clock to local solar noon today — drone sims always fly in daylight,
    // and noon ensures the sun is high for a rich blue skyAtmosphere gradient.
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    this.viewer.clock.currentTime = Cesium.JulianDate.fromDate(noon);
    this.viewer.clock.shouldAnimate = false;

    // Subtle aerial-perspective fog for depth realism.
    // Very low density — barely perceptible at 1 km, gentle haze at 5 km+.
    this.viewer.scene.fog.enabled = true;
    this.viewer.scene.fog.density = 0.00006;
    this.viewer.scene.fog.minimumBrightness = 0.9;

    // Enable logarithmic depth buffer for drone-scale close-range rendering
    this.viewer.scene.logarithmicDepthBuffer = true;
  }

  /**
   * Distance-based globe visibility toggle.
   * Hides the Cesium globe within `thresholdMeters` of spawn to prevent
   * visual conflict with Google 3D Tiles (the "second flat map" artifact).
   */
  setupGlobeToggle(
    spawnPosition: Cesium.Cartesian3,
    thresholdMeters: number = 2000,
    hasRenderableTilesInView?: () => boolean,
  ): void {
    if (!this.viewer) return;
    this.globeToggleCleanup?.();
    const globe = this.viewer.scene.globe;

    // Keep the globe visible until photoreal tiles are actually ready in view.
    globe.show = true;

    this.globeToggleCleanup = this.viewer.scene.preRender.addEventListener(() => {
      const cameraPos = this.viewer!.camera.positionWC;
      const distance = Cesium.Cartesian3.distance(cameraPos, spawnPosition);
      const tilesReady = hasRenderableTilesInView?.() ?? false;

      if (globe.show) {
        globe.show = !(tilesReady && distance <= thresholdMeters);
      } else {
        globe.show = !tilesReady || distance > thresholdMeters + 500;
      }

      if (this.cloudCollection) {
        const drift = (performance.now() - this.cloudDriftStart) * 0.00002;
        this.cloudCollection.noiseOffset = new Cesium.Cartesian3(drift, 0.12, 0.04);
      }
    });
  }

  setEnvironmentAnchor(
    longitude: number,
    latitude: number,
    terrainHeight: number,
  ): void {
    if (!this.viewer || !this.cloudCollection) return;

    this.cloudCollection.removeAll();
    this.cloudCollection.show = true;
    this.cloudDriftStart = performance.now();

    const origin = Cesium.Cartesian3.fromDegrees(longitude, latitude, terrainHeight);
    const enuFrame = Cesium.Transforms.eastNorthUpToFixedFrame(origin);

    for (const cloud of CLOUD_LAYOUT) {
      const position = Cesium.Matrix4.multiplyByPoint(
        enuFrame,
        new Cesium.Cartesian3(cloud.east, cloud.north, cloud.up),
        new Cesium.Cartesian3(),
      );

      this.cloudCollection.add({
        position,
        scale: new Cesium.Cartesian2(cloud.width, cloud.height),
        maximumSize: new Cesium.Cartesian3(
          cloud.width,
          cloud.height,
          cloud.depth,
        ),
        color: new Cesium.Color(1, 1, 1, 0.92),
        brightness: cloud.brightness,
        slice: cloud.slice,
      });
    }
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

  getCloudCollection(): Cesium.CloudCollection | null {
    return this.cloudCollection;
  }

  destroy(): void {
    this.globeToggleCleanup?.();
    this.globeToggleCleanup = null;
    this.viewer?.destroy();
    this.viewer = null;
    this.cloudCollection = null;
  }
}
