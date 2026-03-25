import * as Cesium from "cesium";
import type { DroneState, Quaternion } from "../core/physics/types";
import { quatMultiplyInto } from "../core/physics/types";
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

// Scratch quaternion for camera orientation computation
const _cameraQuat: Quaternion = { w: 1, x: 0, y: 0, z: 0 };

export class FPVCamera {
  private viewer: Cesium.Viewer | null = null;
  private config: CameraConfig;
  private cachedTiltQuat: Quaternion = { w: 1, x: 0, y: 0, z: 0 };
  private cachedTiltDegrees: number = NaN; // NaN forces first update
  // Pre-allocated setView objects — mutated each frame, zero allocation
  private _lastEcefPos = new Cesium.Cartesian3();
  private _orientationObj = { direction: new Cesium.Cartesian3(), up: new Cesium.Cartesian3() };
  private _setViewOpts: {
    destination: Cesium.Cartesian3;
    orientation: { direction: Cesium.Cartesian3; up: Cesium.Cartesian3 };
  } = { destination: this._lastEcefPos, orientation: this._orientationObj };

  constructor(config: CameraConfig = DEFAULT_CAMERA_CONFIG) {
    this.config = config;
    this.updateTiltQuat();
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
    this.updateTiltQuat();
  }

  /** Recompute the cached tilt quaternion (only when tilt changes) */
  private updateTiltQuat(): void {
    if (this.config.tiltDegrees === this.cachedTiltDegrees) return;
    this.cachedTiltDegrees = this.config.tiltDegrees;
    const halfTilt = Cesium.Math.toRadians(this.config.tiltDegrees) / 2;
    this.cachedTiltQuat.w = Math.cos(halfTilt);
    this.cachedTiltQuat.x = Math.sin(halfTilt);
    this.cachedTiltQuat.y = 0;
    this.cachedTiltQuat.z = 0;
  }

  /** Sync Cesium camera position and orientation from drone physics state */
  sync(droneState: DroneState, enuFrame: Cesium.Matrix4): void {
    if (!this.viewer) return;

    // Convert drone ENU position to ECEF
    const ecefPosition = enuToEcef(droneState.position, enuFrame);
    Cesium.Cartesian3.clone(ecefPosition, this._lastEcefPos);

    // Apply cached camera tilt via composite quaternion — zero-alloc
    quatMultiplyInto(droneState.quaternion, this.cachedTiltQuat, _cameraQuat);

    // Convert tilted quaternion to ECEF camera orientation
    const { direction, up } = bodyQuatToEcefOrientation(_cameraQuat, enuFrame);
    Cesium.Cartesian3.clone(direction, this._orientationObj.direction);
    Cesium.Cartesian3.clone(up, this._orientationObj.up);

    // Set camera — no animation, direct placement (pre-allocated options object)
    this._setViewOpts.destination = this._lastEcefPos;
    this.viewer.camera.setView(this._setViewOpts);
  }

  /** Get the ECEF position computed during the last sync() call */
  getLastEcefPosition(): Cesium.Cartesian3 {
    return this._lastEcefPos;
  }
}
