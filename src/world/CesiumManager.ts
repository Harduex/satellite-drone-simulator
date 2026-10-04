import * as Cesium from "cesium";
import { initTerrainProvider } from "./TerrainProviderFactory";
import { createDaylightPanorama } from "./DaylightSky";

const CLOUD_LAYOUT = [
  { east: -3400, north: 4200, up: 1400, width: 2200, height: 820, depth: 11, brightness: 0.96 },
  { east: -1500, north: 5000, up: 1700, width: 1800, height: 700, depth: 9, brightness: 0.98 },
  { east: 800, north: 4600, up: 1450, width: 1400, height: 620, depth: 13, brightness: 0.94 },
  { east: 2900, north: 5300, up: 1950, width: 2100, height: 740, depth: 8, brightness: 0.97 },
  { east: 4900, north: 3200, up: 1550, width: 1900, height: 760, depth: 12, brightness: 0.95 },
  { east: 6100, north: 800, up: 1800, width: 2400, height: 880, depth: 10, brightness: 0.98 },
  { east: 4500, north: -1700, up: 1250, width: 1300, height: 560, depth: 9, brightness: 0.93 },
  { east: 5700, north: -3900, up: 2000, width: 2000, height: 730, depth: 13, brightness: 0.96 },
  { east: 2300, north: -5100, up: 1550, width: 1800, height: 640, depth: 11, brightness: 0.95 },
  { east: -200, north: -6200, up: 1850, width: 2300, height: 800, depth: 8, brightness: 0.98 },
  { east: -2200, north: -4300, up: 1350, width: 1400, height: 600, depth: 12, brightness: 0.94 },
  { east: -4800, north: -3900, up: 1750, width: 2100, height: 780, depth: 10, brightness: 0.96 },
  { east: -6100, north: -1200, up: 2050, width: 2000, height: 680, depth: 9, brightness: 0.98 },
  { east: -4400, north: 1400, up: 1300, width: 1500, height: 640, depth: 13, brightness: 0.94 },
  { east: -7000, north: 4200, up: 2200, width: 2400, height: 840, depth: 10, brightness: 0.97 },
  { east: 6800, north: 6800, up: 2400, width: 1900, height: 600, depth: 8, brightness: 0.99 },
] as const;

export class CesiumManager {
  private viewer: Cesium.Viewer | null = null;
  private globeToggleCleanup: Cesium.Event.RemoveCallback | null = null;
  private cloudDriftCleanup: Cesium.Event.RemoveCallback | null = null;
  private renderResolutionCleanup: Cesium.Event.RemoveCallback | null = null;
  private cloudCollection: Cesium.CloudCollection | null = null;
  private daylightPanorama: Cesium.CubeMapPanorama | null = null;
  private cloudDriftStart = performance.now();
  private cloudDriftLastUpdate = 0;
  private cloudDriftScratch = new Cesium.Cartesian3();
  private cloudPositionScratch = new Cesium.Cartesian3();
  private cloudVelocity = new Cesium.Cartesian3();
  private driftingClouds: { cloud: Cesium.CumulusCloud; origin: Cesium.Cartesian3 }[] = [];

  init(containerId: string): void {
    const ionToken = import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN?.trim();
    if (!ionToken) {
      throw new Error("Set VITE_CESIUM_ION_ACCESS_TOKEN in .env and restart the dev server.");
    }
    Cesium.Ion.defaultAccessToken = ionToken;

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
      shadows: true,
    });

    // Use a bounded display density instead of unbounded high-DPI supersampling.
    // With browser-recommended resolution, resolutionScale is pixels per CSS pixel.
    this.viewer.useBrowserRecommendedResolution = true;
    const updateRenderResolution = () => {
      const displayDensity = window.devicePixelRatio || 1;
      this.viewer!.resolutionScale = Math.min(1.5, Math.max(1, displayDensity));
    };
    updateRenderResolution();
    this.renderResolutionCleanup = this.viewer.scene.preUpdate.addEventListener(
      updateRenderResolution,
    );

    // Disable all default camera controls — we drive the camera from physics
    const controller = this.viewer.scene.screenSpaceCameraController;
    controller.enableRotate = false;
    controller.enableTranslate = false;
    controller.enableZoom = false;
    controller.enableTilt = false;
    controller.enableLook = false;

    // Daytime sky tuning for FPV: vivid blue, natural gradient toward horizon.
    if (this.viewer.scene.skyAtmosphere) {
      this.viewer.scene.skyAtmosphere.show = true;
      this.viewer.scene.skyAtmosphere.perFragmentAtmosphere = true;
      this.viewer.scene.skyAtmosphere.hueShift = 0.0;
      this.viewer.scene.skyAtmosphere.saturationShift = 0.04;
      this.viewer.scene.skyAtmosphere.brightnessShift = 0.02;
    }
    // Disabling the default star sky also disables Viewer creation of the sun.
    this.viewer.scene.sun = new Cesium.Sun();
    if (this.viewer.scene.moon) this.viewer.scene.moon.show = false;
    this.viewer.scene.backgroundColor = new Cesium.Color(0.38, 0.62, 0.82, 1.0);
    const shadows = this.viewer.scene.shadowMap;
    shadows.softShadows = true;
    shadows.size = 2048;
    shadows.maximumDistance = 750;
    // Photogrammetry already contains photographed shadows; keep added shade gentle.
    shadows.darkness = 0.65;

    const globe = this.viewer.scene.globe;
    globe.showGroundAtmosphere = true;
    globe.dynamicAtmosphereLighting = true;
    globe.dynamicAtmosphereLightingFromSun = true;
    globe.atmosphereHueShift = 0.0;
    globe.atmosphereSaturationShift = 0.04;
    globe.atmosphereBrightnessShift = 0.02;
    globe.baseColor = new Cesium.Color(0.74, 0.86, 0.97, 1.0);

    // Globe terrain lighting — adds sun-based hillshading on terrain with vertex normals
    globe.enableLighting = true;
    globe.lambertDiffuseMultiplier = 0.9;

    // Boost base imagery layer visuals
    const baseLayer = this.viewer.imageryLayers.get(0);
    if (baseLayer) {
      baseLayer.contrast = 1.1;
      baseLayer.saturation = 1.05;
      baseLayer.gamma = 0.95;
    }

    this.cloudCollection = this.viewer.scene.primitives.add(
      new Cesium.CloudCollection({ noiseDetail: 16 }),
    );
    if (this.cloudCollection) {
      this.cloudCollection.show = false;
    }

    this.viewer.clock.shouldAnimate = false;

    // Subtle aerial-perspective fog for depth realism.
    this.viewer.scene.fog.enabled = true;
    this.viewer.scene.fog.density = 0.00008;
    this.viewer.scene.fog.minimumBrightness = 0.9;

    // Enable logarithmic depth buffer for drone-scale close-range rendering
    this.viewer.scene.logarithmicDepthBuffer = true;

    // Fire-and-forget terrain init (ArcGIS → Terrarium fallback)
    initTerrainProvider(this.viewer);
  }

  /** Remove the globe-toggle preRender listener (e.g. on session end). */
  teardownGlobeToggle(): void {
    if (this.globeToggleCleanup) {
      this.globeToggleCleanup();
      this.globeToggleCleanup = null;
    }
    if (this.cloudDriftCleanup) {
      this.cloudDriftCleanup();
      this.cloudDriftCleanup = null;
    }
    if (this.viewer) {
      this.viewer.scene.globe.show = true;
    }
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
        // Looking at sky or a brief streaming gap must not bring a second
        // terrain surface back into the photorealistic flight area.
        globe.show = distance > thresholdMeters + 500;
      }
    });

    // Cloud drift runs as a separate, lightweight listener
    this.cloudDriftCleanup?.();
    this.cloudDriftCleanup = this.viewer.scene.preRender.addEventListener(() => {
      const now = performance.now();
      if (now - this.cloudDriftLastUpdate < 100) return;
      this.cloudDriftLastUpdate = now;
      Cesium.Cartesian3.multiplyByScalar(this.cloudVelocity, (now - this.cloudDriftStart) / 1000, this.cloudDriftScratch);
      for (const { cloud, origin } of this.driftingClouds) {
        Cesium.Cartesian3.add(origin, this.cloudDriftScratch, this.cloudPositionScratch);
        cloud.position = this.cloudPositionScratch;
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
    this.cloudDriftLastUpdate = this.cloudDriftStart;
    this.driftingClouds.length = 0;

    const today = new Date();
    // Mean solar time shifts by four minutes per degree of longitude.
    const afternoon = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 13, 30)
      - longitude * 4 * 60 * 1000);
    this.viewer.clock.currentTime = Cesium.JulianDate.fromDate(afternoon);
    this.viewer.clock.shouldAnimate = false;

    if (this.daylightPanorama) this.viewer.scene.primitives.remove(this.daylightPanorama);
    this.daylightPanorama = this.viewer.scene.primitives.add(createDaylightPanorama(longitude, latitude));

    const origin = Cesium.Cartesian3.fromDegrees(longitude, latitude, terrainHeight);
    const enuFrame = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
    Cesium.Matrix4.multiplyByPointAsVector(enuFrame, new Cesium.Cartesian3(2.4, 0.8, 0), this.cloudVelocity);

    for (const cloud of CLOUD_LAYOUT) {
      const position = Cesium.Matrix4.multiplyByPoint(
        enuFrame,
        new Cesium.Cartesian3(cloud.east, cloud.north, cloud.up),
        new Cesium.Cartesian3(),
      );

      const renderedCloud = this.cloudCollection.add({
        position,
        scale: new Cesium.Cartesian2(cloud.width, cloud.height),
        maximumSize: new Cesium.Cartesian3(
          18,
          18 * cloud.height / cloud.width,
          cloud.depth,
        ),
        color: new Cesium.Color(1, 0.985, 0.97, 0.96),
        brightness: cloud.brightness,
        slice: -1,
      });
      this.driftingClouds.push({ cloud: renderedCloud, origin: position });
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
    this.renderResolutionCleanup?.();
    this.renderResolutionCleanup = null;
    this.globeToggleCleanup?.();
    this.globeToggleCleanup = null;
    this.cloudDriftCleanup?.();
    this.cloudDriftCleanup = null;
    this.viewer?.destroy();
    this.viewer = null;
    this.cloudCollection = null;
    this.daylightPanorama = null;
    this.driftingClouds.length = 0;
  }
}
