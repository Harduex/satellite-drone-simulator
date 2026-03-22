import * as Cesium from "cesium";
import type { Quaternion, Vector3 } from "../core/physics/types";
import { quatRotateVectorInto } from "../core/physics/types";

// Scratch variables to avoid allocation in hot paths.
// WARNING: Functions using these return shared mutable buffers.
// Callers must consume returned values before the next call.
const _scratchCartesian = new Cesium.Cartesian3();
const _scratchMatrix3 = new Cesium.Matrix3();
const _scratchLocalCartesian = new Cesium.Cartesian3();
const _scratchResult = new Cesium.Cartesian3();
const _scratchEnuForward = new Cesium.Cartesian3();
const _scratchEnuUp = new Cesium.Cartesian3();
const _scratchEcefDir = new Cesium.Cartesian3();
const _scratchEcefUp = new Cesium.Cartesian3();

// Pre-allocated physics direction vectors (body forward = +Y, body up = +Z)
const _bodyForwardInput: Vector3 = { x: 0, y: 1, z: 0 };
const _bodyUpInput: Vector3 = { x: 0, y: 0, z: 1 };
const _bodyForwardResult: Vector3 = { x: 0, y: 0, z: 0 };
const _bodyUpResult: Vector3 = { x: 0, y: 0, z: 0 };

// Reusable return object for bodyQuatToEcefOrientation
const _orientationResult = { direction: _scratchEcefDir, up: _scratchEcefUp };

/** Create an ENU (East-North-Up) reference frame at a WGS84 position */
export function createENUFrame(
  longitude: number,
  latitude: number,
  height: number,
): Cesium.Matrix4 {
  const origin = Cesium.Cartesian3.fromDegrees(longitude, latitude, height);
  return Cesium.Transforms.eastNorthUpToFixedFrame(origin);
}

/**
 * Convert ENU position to ECEF using the ENU-to-ECEF frame matrix.
 *
 * WARNING: Returns a shared scratch Cartesian3. The value is valid only until
 * the next call to enuToEcef. Callers must consume the result immediately.
 */
export function enuToEcef(
  enuPos: Vector3,
  enuFrame: Cesium.Matrix4,
): Cesium.Cartesian3 {
  _scratchLocalCartesian.x = enuPos.x;
  _scratchLocalCartesian.y = enuPos.y;
  _scratchLocalCartesian.z = enuPos.z;
  return Cesium.Matrix4.multiplyByPoint(
    enuFrame,
    _scratchLocalCartesian,
    _scratchResult,
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
 *
 * WARNING: The returned Cartesian3 objects are shared scratch buffers.
 * Callers must consume the values before the next call.
 */
export function bodyQuatToEcefOrientation(
  bodyQuat: Quaternion,
  enuFrame: Cesium.Matrix4,
): { direction: Cesium.Cartesian3; up: Cesium.Cartesian3 } {
  // Body forward direction (Y axis in body frame) — zero-alloc
  quatRotateVectorInto(bodyQuat, _bodyForwardInput, _bodyForwardResult);
  // Body up direction (Z axis in body frame) — zero-alloc
  quatRotateVectorInto(bodyQuat, _bodyUpInput, _bodyUpResult);

  // Extract rotation part of ENU frame (3x3 rotation matrix)
  const rotation = Cesium.Matrix4.getMatrix3(enuFrame, _scratchMatrix3);

  // Transform ENU vectors to ECEF — reuse scratch Cartesian3s
  _scratchEnuForward.x = _bodyForwardResult.x;
  _scratchEnuForward.y = _bodyForwardResult.y;
  _scratchEnuForward.z = _bodyForwardResult.z;
  _scratchEnuUp.x = _bodyUpResult.x;
  _scratchEnuUp.y = _bodyUpResult.y;
  _scratchEnuUp.z = _bodyUpResult.z;

  Cesium.Matrix3.multiplyByVector(rotation, _scratchEnuForward, _scratchEcefDir);
  Cesium.Matrix3.multiplyByVector(rotation, _scratchEnuUp, _scratchEcefUp);

  return _orientationResult;
}
