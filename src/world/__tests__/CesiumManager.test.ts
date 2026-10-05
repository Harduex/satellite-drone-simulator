// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Cesium from "cesium";
import { CesiumManager } from "../CesiumManager";

beforeEach(() => {
  vi.stubGlobal("ImageBitmap", class ImageBitmap {});
  vi.stubGlobal("OffscreenCanvas", class OffscreenCanvas {});
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });

function createEnvironment() {
  const manager = new CesiumManager();
  const clouds = new Cesium.CloudCollection();
  const preRender = new Cesium.Event();
  const clock = { currentTime: new Cesium.JulianDate(), shouldAnimate: true };
  const viewer = { clock, scene: { preRender, globe: { show: false }, fog: {}, primitives: new Cesium.PrimitiveCollection() },
    camera: { positionWC: Cesium.Cartesian3.fromDegrees(0, 40, 600) } };
  Object.assign(manager, { viewer, cloudCollection: clouds });
  return { manager, clouds, preRender, clock };
}

describe('daylight environment', () => {
  it('keeps scene lighting continuous through sunrise', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2024-03-20T06:06:00Z'));
    const { manager, preRender } = createEnvironment();
    manager.setEnvironmentAnchor(0, 0, 0);
    manager.setEnvironmentOptions(true, 0, 0);
    const before = manager.getViewer().scene.light.intensity;
    vi.setSystemTime(new Date('2024-03-20T06:08:00Z'));
    preRender.raiseEvent();
    // Two minutes spans roughly half a degree of solar motion at the equator.
    expect(Math.abs(manager.getViewer().scene.light.intensity - before)).toBeLessThan(0.07);
  });
  it('keeps corrected solar noon across eastern and western locations', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-04T08:00:00Z'));
    const { manager, clock } = createEnvironment();
    for (const longitude of [-120, 120]) {
      manager.setEnvironmentAnchor(longitude, 40, 500);
      const solarTime = new Date(Cesium.JulianDate.toDate(clock.currentTime).getTime() + longitude * 4 * 60 * 1000);
      expect(solarTime.getUTCHours()).toBe(11);
      expect(solarTime.getUTCMinutes()).toBeGreaterThan(40);
      expect(clock.shouldAnimate).toBe(false);
    }
  });

  it('tracks UTC while paused and freezes clouds without resume jumps', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2024-03-20T12:00:00Z'));
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { manager, clouds, preRender, clock } = createEnvironment();
    manager.setEnvironmentAnchor(0, 40, 0);
    manager.setEnvironmentOptions(true, 4, 0);
    const initial = Cesium.Cartesian3.clone(clouds.get(0).position);
    now = 1000; preRender.raiseEvent();
    expect(Cesium.Cartesian3.distance(initial, clouds.get(0).position)).toBeCloseTo(4);
    manager.setEnvironmentPaused(true);
    const paused = Cesium.Cartesian3.clone(clouds.get(0).position);
    vi.setSystemTime(new Date('2024-03-20T23:00:00Z'));
    now = 20000; preRender.raiseEvent();
    expect(Cesium.JulianDate.toIso8601(clock.currentTime)).toContain('23:00:00');
    expect(Cesium.Cartesian3.equals(paused, clouds.get(0).position)).toBe(true);
    manager.setEnvironmentOptions(true, 0, 2);
    manager.setEnvironmentPaused(false);
    now = 21000; preRender.raiseEvent();
    expect(Cesium.Cartesian3.distance(paused, clouds.get(0).position)).toBeCloseTo(2);
    manager.teardownGlobeToggle();
    expect(preRender.numberOfListeners).toBe(0);
  });

  it('separates procedural cloud shape from world size, drifts clouds, and removes drift on teardown', () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { manager, clouds, preRender } = createEnvironment();
    manager.setEnvironmentAnchor(0, 40, 500);
    for (let index = 0; index < clouds.length; index++) {
      const cloud = clouds.get(index);
      expect(cloud.scale.x).toBeGreaterThan(400);
      expect(cloud.maximumSize.x).toBeLessThan(100);
      expect(cloud.maximumSize.z).toBeLessThan(100);
    }
    const cloud = clouds.get(0);
    const previousSky = manager.getViewer().scene.primitives.get(0);
    const initial = Cesium.Cartesian3.clone(cloud.position);
    manager.setupGlobeToggle(Cesium.Cartesian3.fromDegrees(0, 40, 500), 2000, () => true);
    now = 1000;
    preRender.raiseEvent();
    expect(Cesium.Cartesian3.distance(initial, cloud.position)).toBeGreaterThan(0);
    const drifted = Cesium.Cartesian3.clone(cloud.position);
    manager.teardownGlobeToggle();
    now = 2000;
    preRender.raiseEvent();
    expect(Cesium.Cartesian3.equals(drifted, cloud.position)).toBe(true);
    manager.setEnvironmentAnchor(120, -30, 100);
    expect(Cesium.Cartesian3.distance(initial, clouds.get(0).position)).toBeGreaterThan(1000000);
    expect(previousSky.isDestroyed()).toBe(true);
    expect(manager.getViewer().scene.primitives.length).toBe(1);
  });
});

describe("photorealistic terrain visibility", () => {
  it("does not reintroduce overlapping globe terrain when the pilot looks away from tiles", () => {
    const preRender = new Cesium.Event();
    const globe = { show: true };
    const camera = { positionWC: new Cesium.Cartesian3(0, 0, 10) };
    const manager = new CesiumManager();
    Object.assign(manager, { viewer: { scene: { globe, preRender }, camera } });
    let tilesInView = false;
    manager.setupGlobeToggle(Cesium.Cartesian3.ZERO, 2000, () => tilesInView);

    preRender.raiseEvent();
    expect(globe.show).toBe(true);
    tilesInView = true;
    preRender.raiseEvent();
    expect(globe.show).toBe(false);
    tilesInView = false;
    preRender.raiseEvent();
    expect(globe.show).toBe(false);

    camera.positionWC.x = 2600;
    preRender.raiseEvent();
    expect(globe.show).toBe(true);
    camera.positionWC.x = 100;
    preRender.raiseEvent();
    expect(globe.show).toBe(true);
    tilesInView = true;
    preRender.raiseEvent();
    expect(globe.show).toBe(false);
    manager.teardownGlobeToggle();
    expect(globe.show).toBe(true);
  });
});
