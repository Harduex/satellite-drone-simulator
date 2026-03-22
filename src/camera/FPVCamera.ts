import * as Cesium from "cesium";
import type { DroneState } from "../core/physics/types";
import { bodyQuatToEcefOrientation, enuToEcef } from "../world/CoordUtils";

export interface CameraConfig {
  fov: number; // degrees
  nearClip: number; // meters
  farClip: number; // meters
  tiltDegrees: number; // FPV camera up-angle
}

export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  fov: 90,
  nearClip: 0.1,
  farClip: 5000,
  tiltDegrees: 0,
};

export class FPVCamera {
  private viewer: Cesium.Viewer | null = null;
  private config: CameraConfig;

  constructor(config: CameraConfig = DEFAULT_CAMERA_CONFIG) {
    this.config = config;
  }

  init(viewer: Cesium.Viewer): void {
    this.viewer = viewer;

    // Set FPV field of view
    const frustum = viewer.camera.frustum as Cesium.PerspectiveFrustum;
    frustum.fov = Cesium.Math.toRadians(this.config.fov);
    frustum.near = this.config.nearClip;
    frustum.far = this.config.farClip;
  }

  /** Update FOV at runtime (e.g. from settings slider) */
  setFov(degrees: number): void {
    this.config = { ...this.config, fov: degrees };
    if (!this.viewer) return;
    const frustum = this.viewer.camera.frustum as Cesium.PerspectiveFrustum;
    frustum.fov = Cesium.Math.toRadians(degrees);
  }

  /** Sync Cesium camera position and orientation from drone physics state */
  sync(droneState: DroneState, enuFrame: Cesium.Matrix4): void {
    if (!this.viewer) return;

    // Convert drone ENU position to ECEF
    const ecefPosition = enuToEcef(droneState.position, enuFrame);

    // Convert body quaternion to ECEF camera orientation
    const { direction, up } = bodyQuatToEcefOrientation(
      droneState.quaternion,
      enuFrame,
    );

    // Set camera — no animation, direct placement
    this.viewer.camera.setView({
      destination: ecefPosition,
      orientation: {
        direction,
        up,
      },
    });
  }
}
