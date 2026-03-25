import type { PhysicsConfig, RatesConfig, MotorDef } from "./types";

/**
 * Canonical X-config motor layout.
 * Referenced by DronePhysics (torque) and FlightController (mixing).
 *
 * Top view (front = +Y):
 *   M1(CCW) --- M2(CW)    front
 *      \       /
 *       \     /
 *   M4(CW) --- M3(CCW)    back
 */
export const MOTOR_LAYOUT: readonly [MotorDef, MotorDef, MotorDef, MotorDef] = [
  { label: 'M1', posX: -1, posY:  1, spin:  1, mixRoll: -1, mixPitch:  1, mixYaw:  1 },
  { label: 'M2', posX:  1, posY:  1, spin: -1, mixRoll:  1, mixPitch:  1, mixYaw: -1 },
  { label: 'M3', posX:  1, posY: -1, spin:  1, mixRoll:  1, mixPitch: -1, mixYaw:  1 },
  { label: 'M4', posX: -1, posY: -1, spin: -1, mixRoll: -1, mixPitch: -1, mixYaw: -1 },
] as const;

export const DEFAULT_DRONE_CONFIG: PhysicsConfig = {
  mass: 0.550,
  armLength: 0.11,
  inertia: { xx: 0.003, yy: 0.003, zz: 0.005 },
  // kT chosen so hover occurs at ~35% throttle:
  // T_hover_per_motor = (0.550 * 9.81) / 4 = 1.349 N
  // RPM_hover = 0.35 * 24000 = 8400
  // kT = 1.349 / 8400² ≈ 1.9e-8
  kT: 1.9e-8,
  // kQ maintains same kQ/kT ratio as original (≈0.01314, ~13mm torque arm)
  kQ: 2.5e-10,
  motorTimeConstant: 0.018,
  motorSpinDownFactor: 1.3,
  maxThrottleRpm: 24000,
  dragCoefficient: 0.3,
  referenceArea: 0.04,
  verticalDragMultiplier: 3.0,
  spawnAltitude: 2.0,
  thrustLinearization: true,
};

export const DEFAULT_RATES: RatesConfig = {
  rollRate: 800,
  pitchRate: 800,
  yawRate: 650,
  expo: 0.60,
};
