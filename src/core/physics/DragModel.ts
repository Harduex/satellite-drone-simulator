import type { PhysicsConfig, Quaternion, Vector3 } from "./types";
import {
  v3Magnitude,
  v3Scale,
  v3ScaleInto,
  quatRotateVector,
  quatRotateVectorInto,
  quatConjugate,
} from "./types";

const AIR_DENSITY = 1.225; // kg/m³ at sea level

// Quadratic angular drag coefficient (tuned for 5" quad at typical rates)
const ANGULAR_DRAG_COEFF = 0.00006;

// Scratch objects for zero-alloc Into variants
const _conjQuat: Quaternion = { w: 1, x: 0, y: 0, z: 0 };
const _bodyVel: Vector3 = { x: 0, y: 0, z: 0 };
const _dragBody: Vector3 = { x: 0, y: 0, z: 0 };

/**
 * Compute direction-dependent translational drag.
 * Transforms velocity to body frame, applies per-axis Cd*A,
 * and transforms drag force back to world frame.
 * Vertical axis has higher drag (bottom of frame facing airflow).
 */
export function computeTranslationalDrag(
  velocity: Vector3,
  bodyQuaternion: Quaternion,
  config: PhysicsConfig,
): Vector3 {
  const speed = v3Magnitude(velocity);
  if (speed < 1e-6) return { x: 0, y: 0, z: 0 };

  // Transform velocity into body frame
  const bodyVel = quatRotateVector(quatConjugate(bodyQuaternion), velocity);

  // Per-axis drag in body frame: F_i = -0.5 * rho * Cd_i * A_i * |v_i| * v_i
  const rho = AIR_DENSITY;
  const CdA_lateral = config.dragCoefficient * config.referenceArea;
  const CdA_vertical = CdA_lateral * config.verticalDragMultiplier;

  const dragBody: Vector3 = {
    x: -0.5 * rho * CdA_lateral * Math.abs(bodyVel.x) * bodyVel.x,
    y: -0.5 * rho * CdA_lateral * Math.abs(bodyVel.y) * bodyVel.y,
    z: -0.5 * rho * CdA_vertical * Math.abs(bodyVel.z) * bodyVel.z,
  };

  // Transform drag force back to world frame
  return quatRotateVector(bodyQuaternion, dragBody);
}

/** Zero-alloc variant — writes result into `out`. */
export function computeTranslationalDragInto(
  velocity: Vector3,
  bodyQuaternion: Quaternion,
  config: PhysicsConfig,
  out: Vector3,
): Vector3 {
  const speed = v3Magnitude(velocity);
  if (speed < 1e-6) { out.x = 0; out.y = 0; out.z = 0; return out; }

  // Conjugate into scratch
  _conjQuat.w = bodyQuaternion.w;
  _conjQuat.x = -bodyQuaternion.x;
  _conjQuat.y = -bodyQuaternion.y;
  _conjQuat.z = -bodyQuaternion.z;

  // Transform velocity into body frame
  quatRotateVectorInto(_conjQuat, velocity, _bodyVel);

  const rho = AIR_DENSITY;
  const CdA_lateral = config.dragCoefficient * config.referenceArea;
  const CdA_vertical = CdA_lateral * config.verticalDragMultiplier;

  // Per-axis drag in body frame
  _dragBody.x = -0.5 * rho * CdA_lateral * Math.abs(_bodyVel.x) * _bodyVel.x;
  _dragBody.y = -0.5 * rho * CdA_lateral * Math.abs(_bodyVel.y) * _bodyVel.y;
  _dragBody.z = -0.5 * rho * CdA_vertical * Math.abs(_bodyVel.z) * _bodyVel.z;

  // Transform drag force back to world frame
  quatRotateVectorInto(bodyQuaternion, _dragBody, out);
  return out;
}

/**
 * Compute quadratic angular drag torque: tau = -kD * |omega| * omega.
 * Quadratic drag increases resistance dramatically at high spin rates,
 * giving snappier feel at start and heavier deceleration during sustained flips.
 */
export function computeAngularDrag(angularVelocity: Vector3): Vector3 {
  const mag = v3Magnitude(angularVelocity);
  if (mag < 1e-6) return { x: 0, y: 0, z: 0 };
  return v3Scale(angularVelocity, -ANGULAR_DRAG_COEFF * mag);
}

/** Zero-alloc variant — writes result into `out`. */
export function computeAngularDragInto(angularVelocity: Vector3, out: Vector3): Vector3 {
  const mag = v3Magnitude(angularVelocity);
  if (mag < 1e-6) { out.x = 0; out.y = 0; out.z = 0; return out; }
  v3ScaleInto(angularVelocity, -ANGULAR_DRAG_COEFF * mag, out);
  return out;
}
