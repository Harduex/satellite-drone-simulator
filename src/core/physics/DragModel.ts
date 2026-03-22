import type { PhysicsConfig, Vector3 } from "./types";
import { v3Magnitude, v3Scale } from "./types";

const AIR_DENSITY = 1.225; // kg/m³ at sea level

// Angular drag coefficient (empirically tuned for 5" quad)
const ANGULAR_DRAG_COEFF = 0.0005;

/** Compute translational drag force: F = -0.5 * rho * Cd * A * |v| * v */
export function computeTranslationalDrag(
  velocity: Vector3,
  config: PhysicsConfig,
): Vector3 {
  const speed = v3Magnitude(velocity);
  if (speed < 1e-6) return { x: 0, y: 0, z: 0 };
  const dragMagnitude = 0.5 * AIR_DENSITY * config.dragCoefficient *
    config.referenceArea * speed;
  // Force opposes velocity direction and scales with speed²
  return v3Scale(velocity, -dragMagnitude);
}

/** Compute angular drag torque: tau = -kD * omega */
export function computeAngularDrag(angularVelocity: Vector3): Vector3 {
  return v3Scale(angularVelocity, -ANGULAR_DRAG_COEFF);
}
