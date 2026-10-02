import { describe, expect, it } from "vitest";
import * as Cesium from "cesium";
import { FPVCamera, DEFAULT_CAMERA_CONFIG } from "../FPVCamera";
import { createDefaultDroneState } from "../../core/physics/types";

function cameraFixture(aspectRatio: number) {
  const frustum = new Cesium.PerspectiveFrustum({ aspectRatio });
  const viewer = { camera: { frustum, setView: () => {} } } as unknown as Cesium.Viewer;
  const camera = new FPVCamera({ ...DEFAULT_CAMERA_CONFIG, fov: 110 });
  camera.init(viewer);
  return { camera, frustum };
}

describe("FPVCamera horizontal field of view", () => {
  it.each([16 / 9, 4 / 3, 9 / 16])("maintains 110° horizontal FOV at aspect %f", (aspectRatio) => {
    const { frustum } = cameraFixture(aspectRatio);
    const horizontalDegrees = 2 * Math.atan(Math.tan(frustum.fovy! / 2) * aspectRatio) * 180 / Math.PI;
    expect(horizontalDegrees).toBeCloseTo(110, 8);
  });

  it("maintains horizontal FOV when the viewport becomes portrait", () => {
    const { camera, frustum } = cameraFixture(16 / 9);
    frustum.aspectRatio = 9 / 16;
    camera.sync(createDefaultDroneState(2), Cesium.Matrix4.IDENTITY);
    const horizontalDegrees = 2 * Math.atan(Math.tan(frustum.fovy! / 2) * 9 / 16) * 180 / Math.PI;
    expect(horizontalDegrees).toBeCloseTo(110, 8);
  });

  it("applies a changed horizontal FOV in portrait", () => {
    const { camera, frustum } = cameraFixture(9 / 16);
    camera.setFov(100);
    const horizontalDegrees = 2 * Math.atan(Math.tan(frustum.fovy! / 2) * 9 / 16) * 180 / Math.PI;
    expect(horizontalDegrees).toBeCloseTo(100, 8);
  });
});
