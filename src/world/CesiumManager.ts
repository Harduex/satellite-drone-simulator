import * as Cesium from "cesium";
import { initTerrainProvider } from "./TerrainProviderFactory";

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
  private cloudDriftCleanup: Cesium.Event.RemoveCallback | null = null;
  private cloudCollection: Cesium.CloudCollection | null = null;
  private cloudDriftStart = performance.now();
  private cloudDriftScratch = new Cesium.Cartesian3();

  init(containerId: string): void {
    // Google 2D Satellite as globe base layer (requires Map Tiles API enabled)
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
    if (apiKey) {
      Cesium.GoogleMaps.defaultApiKey = apiKey;
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
      skyBox: false, // disable space/stars — drone sims always fly in daylight
      baseLayer: apiKey
        ? Cesium.ImageryLayer.fromProviderAsync(
            Cesium.Google2DImageryProvider.fromUrl({ mapType: "satellite" }) as Promise<Cesium.ImageryProvider>,
          )
        : undefined,
    });

    // Disable all default camera controls — we drive the camera from physics
    const controller = this.viewer.scene.screenSpaceCameraController;
    controller.enableRotate = false;
    controller.enableTranslate = false;
    controller.enableZoom = false;
    controller.enableTilt = false;
    controller.enableLook = false;

    // Performance tuning (PRD §7.4)
    // Increase parallel tile requests for Google's tile server
    const scheduler = Cesium.RequestScheduler as unknown as Record<
      string,
      Record<string, number>
    >;
    if (scheduler.requestsByServer) {
      scheduler.requestsByServer["tile.googleapis.com:443"] = 12;
    }

    // Daytime sky tuning for FPV: vivid blue, natural gradient toward horizon.
    if (this.viewer.scene.skyAtmosphere) {
      this.viewer.scene.skyAtmosphere.show = true;
      this.viewer.scene.skyAtmosphere.perFragmentAtmosphere = true;
      this.viewer.scene.skyAtmosphere.hueShift = 0.0;
      this.viewer.scene.skyAtmosphere.saturationShift = 0.18;
      this.viewer.scene.skyAtmosphere.brightnessShift = 0.12;
    }
    // Show sun so skyAtmosphere renders a directional gradient and the ground
    // receives natural lighting → realistic horizon colour at dawn/dusk.
    if (this.viewer.scene.sun) this.viewer.scene.sun.show = true;
    if (this.viewer.scene.moon) this.viewer.scene.moon.show = false;
    this.viewer.scene.backgroundColor = new Cesium.Color(0.53, 0.81, 0.98, 1.0);

    const globe = this.viewer.scene.globe;
    globe.showGroundAtmosphere = true;
    globe.dynamicAtmosphereLighting = true;
    globe.dynamicAtmosphereLightingFromSun = true;
    globe.atmosphereHueShift = 0.0;
    globe.atmosphereSaturationShift = 0.12;
    globe.atmosphereBrightnessShift = 0.05;
    globe.baseColor = new Cesium.Color(0.74, 0.86, 0.97, 1.0);

    // Globe terrain lighting — adds sun-based hillshading on terrain with vertex normals
    globe.enableLighting = true;
    globe.lambertDiffuseMultiplier = 0.9;

    // Boost base imagery layer visuals (Google 2D Satellite or default)
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

    // Set clock to local solar noon today — drone sims always fly in daylight,
    // and noon ensures the sun is high for a rich blue skyAtmosphere gradient.
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    this.viewer.clock.currentTime = Cesium.JulianDate.fromDate(noon);
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
        globe.show = !tilesReady || distance > thresholdMeters + 500;
      }
    });

    // Cloud drift runs as a separate, lightweight listener
    this.cloudDriftCleanup?.();
    this.cloudDriftCleanup = this.viewer.scene.preRender.addEventListener(() => {
      if (this.cloudCollection) {
        const drift = (performance.now() - this.cloudDriftStart) * 0.00002;
        this.cloudDriftScratch.x = drift;
        this.cloudDriftScratch.y = 0.12;
        this.cloudDriftScratch.z = 0.04;
        this.cloudCollection.noiseOffset = this.cloudDriftScratch;
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
    this.cloudDriftCleanup?.();
    this.cloudDriftCleanup = null;
    this.viewer?.destroy();
    this.viewer = null;
    this.cloudCollection = null;
  }
}
