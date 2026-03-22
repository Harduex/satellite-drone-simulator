import * as Cesium from "cesium";
import type { DroneState } from "../core/physics/types";
import { quatMultiply } from "../core/physics/types";
import { bodyQuatToEcefOrientation, enuToEcef } from "../world/CoordUtils";

export interface CameraConfig {
  fov: number; // degrees
  nearClip: number; // meters
  farClip: number; // meters
  tiltDegrees: number; // FPV camera up-angle
}

export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  fov: 90,
  nearClip: 0.05,
  farClip: 30000, // 30 km — needed to render clouds (3–7 km) and distant terrain
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

  /** Update camera tilt angle at runtime */
  setTiltDegrees(degrees: number): void {
    this.config = { ...this.config, tiltDegrees: degrees };
  }

  /** Sync Cesium camera position and orientation from drone physics state */
  sync(droneState: DroneState, enuFrame: Cesium.Matrix4): void {
    if (!this.viewer) return;

    // Convert drone ENU position to ECEF
    const ecefPosition = enuToEcef(droneState.position, enuFrame);

    // Apply camera tilt by compositing a body-frame rotation around the X axis
    // (right/roll axis) before converting to ECEF. This tilts the FPV camera
    // upward relative to the drone's body forward direction.
    const halfTilt = Cesium.Math.toRadians(this.config.tiltDegrees) / 2;
    const tiltQuat = {
      w: Math.cos(halfTilt),
      x: Math.sin(halfTilt),
      y: 0,
      z: 0,
    };
    const cameraQuat = quatMultiply(droneState.quaternion, tiltQuat);

    // Convert tilted quaternion to ECEF camera orientation
    const { direction, up } = bodyQuatToEcefOrientation(cameraQuat, enuFrame);

    // Set camera — no animation, direct placement
    this.viewer.camera.setView({
      destination: ecefPosition,
      orientation: { direction, up },
    });
  }
}
