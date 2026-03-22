// ── Vector3 ──────────────────────────────────────────────
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export function vec3(x: number, y: number, z: number): Vector3 {
  return { x, y, z };
}

export const V3_ZERO: Vector3 = { x: 0, y: 0, z: 0 };

export function v3Add(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function v3Sub(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function v3Scale(v: Vector3, s: number): Vector3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function v3Dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function v3Cross(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function v3Magnitude(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function v3Normalize(v: Vector3): Vector3 {
  const m = v3Magnitude(v);
  if (m < 1e-12) return V3_ZERO;
  return v3Scale(v, 1 / m);
}

export function v3Negate(v: Vector3): Vector3 {
  return { x: -v.x, y: -v.y, z: -v.z };
}

// ── Quaternion ───────────────────────────────────────────
export interface Quaternion {
  w: number;
  x: number;
  y: number;
  z: number;
}

export const Q_IDENTITY: Quaternion = { w: 1, x: 0, y: 0, z: 0 };

export function quatMultiply(a: Quaternion, b: Quaternion): Quaternion {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

export function quatNormalize(q: Quaternion): Quaternion {
  const m = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
  if (m < 1e-12) return Q_IDENTITY;
  return { w: q.w / m, x: q.x / m, y: q.y / m, z: q.z / m };
}

export function quatConjugate(q: Quaternion): Quaternion {
  return { w: q.w, x: -q.x, y: -q.y, z: -q.z };
}

/** Rotate a vector by a quaternion: q * v * q⁻¹ */
export function quatRotateVector(q: Quaternion, v: Vector3): Vector3 {
  const qv: Quaternion = { w: 0, x: v.x, y: v.y, z: v.z };
  const result = quatMultiply(quatMultiply(q, qv), quatConjugate(q));
  return { x: result.x, y: result.y, z: result.z };
}

/** Create quaternion from Euler angles (roll, pitch, yaw) in radians */
export function quatFromEuler(
  roll: number,
  pitch: number,
  yaw: number,
): Quaternion {
  const cr = Math.cos(roll / 2);
  const sr = Math.sin(roll / 2);
  const cp = Math.cos(pitch / 2);
  const sp = Math.sin(pitch / 2);
  const cy = Math.cos(yaw / 2);
  const sy = Math.sin(yaw / 2);
  return {
    w: cr * cp * cy + sr * sp * sy,
    x: sr * cp * cy - cr * sp * sy,
    y: cr * sp * cy + sr * cp * sy,
    z: cr * cp * sy - sr * sp * cy,
  };
}

// ── Drone State ──────────────────────────────────────────
export interface DroneState {
  position: Vector3; // meters, local ENU from spawn origin
  velocity: Vector3; // m/s, world frame
  quaternion: Quaternion; // body orientation
  angularVelocity: Vector3; // rad/s, body frame
}

export function createDefaultDroneState(spawnAltitude: number): DroneState {
  return {
    position: vec3(0, 0, spawnAltitude),
    velocity: V3_ZERO,
    quaternion: Q_IDENTITY,
    angularVelocity: V3_ZERO,
  };
}

// ── Motor Commands ───────────────────────────────────────
export interface MotorCommands {
  m1: number; // [0, 1] front-left CCW
  m2: number; // [0, 1] front-right CW
  m3: number; // [0, 1] back-right CCW
  m4: number; // [0, 1] back-left CW
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
  maxThrottleRpm: number;
  dragCoefficient: number;
  referenceArea: number; // m²
  spawnAltitude: number; // m AGL
}

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
  motorTimeConstant: 0.05,
  maxThrottleRpm: 24000,
  dragCoefficient: 0.3,
  referenceArea: 0.04,
  spawnAltitude: 10.0,
};

export interface RatesConfig {
  rollRate: number; // deg/s at full stick
  pitchRate: number;
  yawRate: number;
  expo: number; // 0-1
}

export const DEFAULT_RATES: RatesConfig = {
  rollRate: 700,
  pitchRate: 700,
  yawRate: 400,
  expo: 0.65,
};
