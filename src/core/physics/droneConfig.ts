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
  mass: 0.644,
  armLength: 0.1125,
  // Component-mass estimate for a central battery/body plus four motors and arms.
  inertia: { xx: 0.00165, yy: 0.00125, zz: 0.0027 },
  // Fit to F60 Pro V 1750KV / T5147-3 static thrust/RPM data at 24.8–25.2V.
  kT: 1.94e-8,
  // Estimate: implied shaft power kQ*rpm²*ω is ~67–77% of the bench's measured
  // electrical power (53.6–1002.8 W), a plausible motor+ESC efficiency.
  kQ: 2.5e-10,
  motorTimeConstant: 0.018,
  motorSpinDownFactor: 1.3,
  maxThrottleRpm: 30527,
  motorResponseExponent: 0.65,
  // T5147-3 geometric pitch (4.7 in); drives the axial-inflow thrust loss.
  propellerPitch: 0.1194,
  // Effective Cd*A is a flight-envelope estimate (level top speed ≈ the
  // advertised 190 km/h with inflow loss), not a measured body area.
  dragCoefficient: 1.0,
  referenceArea: 0.007,
  verticalDragMultiplier: 3.0,
  // Conservative flight-feel estimate; rotor drag scales with mean loaded RPM.
  rotorDragCoefficient: 0.025,
  gentleWind: true,
  windSpeed: 1.5,
  windDirection: 233.130102,
  windGustStrength: 0.35,
  spawnAltitude: 2.0,
  thrustLinearization: false,
};

export const DEFAULT_RATES: RatesConfig = {
  rollRate: 800,
  pitchRate: 800,
  yawRate: 650,
  expo: 0.60,
};
