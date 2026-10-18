import type { PhysicsConfig, Quaternion, Vector3 } from "./types";
import {
  v3Magnitude,
  v3MagnitudeSq,
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
 * When rotors are unpowered (free-fall), bluff-body drag strictly opposes
 * the air velocity vector using direction-dependent effective Cd*A.
 * When rotors are spinning under power, actuator-disc normal drag acts along
 * the body axes alongside linear lateral H-force rotor drag.
 */
export function computeTranslationalDrag(
  velocity: Vector3,
  bodyQuaternion: Quaternion,
  config: PhysicsConfig,
  rotorDrag: number = 0,
): Vector3 {
  const speedSq = v3MagnitudeSq(velocity);
  if (speedSq < 1e-12) return { x: 0, y: 0, z: 0 };

  // Transform velocity into body frame
  const bodyVel = quatRotateVector(quatConjugate(bodyQuaternion), velocity);

  const rho = AIR_DENSITY;
  const CdA_lateral = config.dragCoefficient * config.referenceArea;
  const CdA_vertical = CdA_lateral * config.verticalDragMultiplier;

  const speed = Math.sqrt(speedSq);
  const latSpeed = Math.hypot(bodyVel.x, bodyVel.y);
  const latRatio = latSpeed / speed;
  const vzRatio = Math.abs(bodyVel.z) / speed;
  const CdA_eff =
    CdA_lateral * (latRatio * latRatio * latRatio) +
    CdA_vertical * (vzRatio * vzRatio * vzRatio);
  const bluffDrag = 0.5 * rho * CdA_eff * speed;

  const discShare = Math.min(1, Math.max(0, rotorDrag / 0.015));
  const latQuad = 0.5 * rho * CdA_lateral;
  const vertQuad = 0.5 * rho * CdA_vertical;

  const dragBody: Vector3 = {
    x: -((1 - discShare) * bluffDrag + discShare * latQuad * Math.abs(bodyVel.x) + rotorDrag) * bodyVel.x,
    y: -((1 - discShare) * bluffDrag + discShare * latQuad * Math.abs(bodyVel.y) + rotorDrag) * bodyVel.y,
    z: -((1 - discShare) * bluffDrag + discShare * vertQuad * Math.abs(bodyVel.z)) * bodyVel.z,
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
  rotorDrag: number = 0,
): Vector3 {
  const speedSq = v3MagnitudeSq(velocity);
  if (speedSq < 1e-12) { out.x = 0; out.y = 0; out.z = 0; return out; }

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

  const speed = Math.sqrt(speedSq);
  const latSpeed = Math.hypot(_bodyVel.x, _bodyVel.y);
  const latRatio = latSpeed / speed;
  const vzRatio = Math.abs(_bodyVel.z) / speed;
  const CdA_eff =
    CdA_lateral * (latRatio * latRatio * latRatio) +
    CdA_vertical * (vzRatio * vzRatio * vzRatio);
  const bluffDrag = 0.5 * rho * CdA_eff * speed;

  const discShare = Math.min(1, Math.max(0, rotorDrag / 0.015));
  const latQuad = 0.5 * rho * CdA_lateral;
  const vertQuad = 0.5 * rho * CdA_vertical;

  // Per-axis drag in body frame
  _dragBody.x = -((1 - discShare) * bluffDrag + discShare * latQuad * Math.abs(_bodyVel.x) + rotorDrag) * _bodyVel.x;
  _dragBody.y = -((1 - discShare) * bluffDrag + discShare * latQuad * Math.abs(_bodyVel.y) + rotorDrag) * _bodyVel.y;
  _dragBody.z = -((1 - discShare) * bluffDrag + discShare * vertQuad * Math.abs(_bodyVel.z)) * _bodyVel.z;

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
