import { describe, expect, it } from "vitest";
import * as Cesium from "cesium";
import { CesiumManager } from "../CesiumManager";

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
