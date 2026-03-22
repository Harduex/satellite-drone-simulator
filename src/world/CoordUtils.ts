import * as Cesium from "cesium";
import type { Quaternion, Vector3 } from "../core/physics/types";
import { quatRotateVector } from "../core/physics/types";

// Scratch variables to avoid allocation in hot paths
const _scratchCartesian = new Cesium.Cartesian3();
const _scratchMatrix3 = new Cesium.Matrix3();

/** Create an ENU (East-North-Up) reference frame at a WGS84 position */
export function createENUFrame(
  longitude: number,
  latitude: number,
  height: number,
): Cesium.Matrix4 {
  const origin = Cesium.Cartesian3.fromDegrees(longitude, latitude, height);
  return Cesium.Transforms.eastNorthUpToFixedFrame(origin);
}

/** Convert ENU position to ECEF using the ENU-to-ECEF frame matrix */
export function enuToEcef(
  enuPos: Vector3,
  enuFrame: Cesium.Matrix4,
): Cesium.Cartesian3 {
  const localCartesian = new Cesium.Cartesian3(enuPos.x, enuPos.y, enuPos.z);
  return Cesium.Matrix4.multiplyByPoint(
    enuFrame,
    localCartesian,
    new Cesium.Cartesian3(),
  );
}

/** Convert ECEF position to ENU using the inverse of the ENU frame matrix */
export function ecefToEnu(
  ecefPos: Cesium.Cartesian3,
  enuFrameInverse: Cesium.Matrix4,
): Vector3 {
  const local = Cesium.Matrix4.multiplyByPoint(
    enuFrameInverse,
    ecefPos,
    _scratchCartesian,
  );
  return { x: local.x, y: local.y, z: local.z };
}

/**
 * Convert body quaternion (in ENU frame) to ECEF camera direction and up vectors.
 *
 * In our physics, the drone body frame has:
 *   - X: right (East initially)
 *   - Y: forward (North initially)
 *   - Z: up (Up initially)
 *
 * CesiumJS camera wants direction (where camera looks) and up vector in ECEF.
 * FPV camera looks along body Y axis (forward), with body Z as up.
 */
export function bodyQuatToEcefOrientation(
  bodyQuat: Quaternion,
  enuFrame: Cesium.Matrix4,
): { direction: Cesium.Cartesian3; up: Cesium.Cartesian3 } {
  // Body forward direction (Y axis in body frame)
  const bodyForward = quatRotateVector(bodyQuat, { x: 0, y: 1, z: 0 });
  // Body up direction (Z axis in body frame)
  const bodyUp = quatRotateVector(bodyQuat, { x: 0, y: 0, z: 1 });

  // Extract rotation part of ENU frame (3x3 rotation matrix)
  const rotation = Cesium.Matrix4.getMatrix3(enuFrame, _scratchMatrix3);

  // Transform ENU vectors to ECEF
  const enuForward = new Cesium.Cartesian3(
    bodyForward.x,
    bodyForward.y,
    bodyForward.z,
  );
  const enuUp = new Cesium.Cartesian3(bodyUp.x, bodyUp.y, bodyUp.z);

  const ecefDirection = Cesium.Matrix3.multiplyByVector(
    rotation,
    enuForward,
    new Cesium.Cartesian3(),
  );
  const ecefUp = Cesium.Matrix3.multiplyByVector(
    rotation,
    enuUp,
    new Cesium.Cartesian3(),
  );

  return { direction: ecefDirection, up: ecefUp };
}
