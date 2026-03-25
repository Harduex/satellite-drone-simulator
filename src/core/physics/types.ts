// Re-export math primitives and drone config for backwards compatibility.
// New code should import directly from "./math" or "./droneConfig".
export {
  type Vector3,
  vec3,
  V3_ZERO,
  v3Add,
  v3Sub,
  v3Scale,
  v3Dot,
  v3Cross,
  v3Magnitude,
  v3MagnitudeSq,
  v3Normalize,
  v3Negate,
  v3Set,
  v3AddInto,
  v3ScaleInto,
  v3CrossInto,
  type Quaternion,
  Q_IDENTITY,
  quatMultiply,
  quatNormalize,
  quatConjugate,
  quatRotateVector,
  quatFromEuler,
  quatMultiplyInto,
  quatNormalizeInto,
  quatRotateVectorInto,
} from "./math";

export {
  MOTOR_LAYOUT,
  DEFAULT_DRONE_CONFIG,
  DEFAULT_RATES,
} from "./droneConfig";

import type { Vector3, Quaternion } from "./math";
import { vec3 } from "./math";

// ── Drone State ──────────────────────────────────────────
export interface DroneState {
  position: Vector3; // meters, local ENU from spawn origin
  velocity: Vector3; // m/s, world frame
  quaternion: Quaternion; // body orientation
  angularVelocity: Vector3; // rad/s, body frame
}

export function createDefaultDroneState(spawnPosition: number | Vector3): DroneState {
  const position =
    typeof spawnPosition === "number"
      ? vec3(0, 0, spawnPosition)
      : { x: spawnPosition.x, y: spawnPosition.y, z: spawnPosition.z };

  return {
    position,
    velocity: { x: 0, y: 0, z: 0 },
    quaternion: { w: 1, x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
  };
}

// ── Motor Commands ───────────────────────────────────────
export interface MotorCommands {
  m1: number; // [0, 1] front-left CCW
  m2: number; // [0, 1] front-right CW
  m3: number; // [0, 1] back-right CCW
  m4: number; // [0, 1] back-left CW
}

// ── Motor Layout (X config, single source of truth) ─────
export interface MotorDef {
  label: string;
  /** Position sign: X (right+) */
  posX: -1 | 1;
  /** Position sign: Y (forward+) */
  posY: -1 | 1;
  /** Spin direction: +1 = CCW, -1 = CW */
  spin: 1 | -1;
  /** Mixing: how roll PID correction adds to this motor */
  mixRoll: -1 | 1;
  /** Mixing: how pitch PID correction adds to this motor */
  mixPitch: -1 | 1;
  /** Mixing: how yaw PID correction adds to this motor */
  mixYaw: -1 | 1;
}

// ── Stick Inputs ─────────────────────────────────────────
export interface StickInputs {
  throttle: number; // [0, 1]
  roll: number; // [-1, 1]
  pitch: number; // [-1, 1]
  yaw: number; // [-1, 1]
}

// ── Physics Config ───────────────────────────────────────
export interface PhysicsConfig {
  mass: number; // kg
  armLength: number; // m
  inertia: { xx: number; yy: number; zz: number };
  kT: number; // thrust coefficient (N per RPM²)
  kQ: number; // torque coefficient
  motorTimeConstant: number; // s
  motorSpinDownFactor: number; // multiplier on motorTimeConstant for spin-down (>1 = slower)
  maxThrottleRpm: number;
  dragCoefficient: number;
  referenceArea: number; // m²
  verticalDragMultiplier: number; // multiplier on Cd*A for vertical axis drag
  spawnAltitude: number; // m AGL
  thrustLinearization?: boolean; // apply sqrt to throttle commands for linear thrust feel
}

export interface RatesConfig {
  rollRate: number; // deg/s at full stick
  pitchRate: number;
  yawRate: number;
  expo: number; // 0-1
}
