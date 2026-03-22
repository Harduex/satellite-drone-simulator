import type { PhysicsConfig, Quaternion, Vector3 } from "./types";
import { v3Magnitude, v3Scale, quatRotateVector, quatConjugate } from "./types";

const AIR_DENSITY = 1.225; // kg/m³ at sea level

// Quadratic angular drag coefficient (tuned for 5" quad at typical rates)
const ANGULAR_DRAG_COEFF = 0.00015;

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
