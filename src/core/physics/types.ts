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

export function v3MagnitudeSq(v: Vector3): number {
  return v.x * v.x + v.y * v.y + v.z * v.z;
}

export function v3Normalize(v: Vector3): Vector3 {
  const m = v3Magnitude(v);
  if (m < 1e-12) return V3_ZERO;
  return v3Scale(v, 1 / m);
}

export function v3Negate(v: Vector3): Vector3 {
  return { x: -v.x, y: -v.y, z: -v.z };
}

// ── Mutable "Into" variants for hot paths (zero allocation) ─
// These write results into a caller-provided output object.
// The originals above are kept for readability in non-hot code and tests.

export function v3Set(out: Vector3, x: number, y: number, z: number): Vector3 {
  out.x = x; out.y = y; out.z = z;
  return out;
}

export function v3AddInto(a: Vector3, b: Vector3, out: Vector3): Vector3 {
  out.x = a.x + b.x; out.y = a.y + b.y; out.z = a.z + b.z;
  return out;
}

export function v3ScaleInto(v: Vector3, s: number, out: Vector3): Vector3 {
  out.x = v.x * s; out.y = v.y * s; out.z = v.z * s;
  return out;
}

export function v3CrossInto(a: Vector3, b: Vector3, out: Vector3): Vector3 {
  // Use temps to allow a === out or b === out aliasing
  const ox = a.y * b.z - a.z * b.y;
  const oy = a.z * b.x - a.x * b.z;
  const oz = a.x * b.y - a.y * b.x;
  out.x = ox; out.y = oy; out.z = oz;
  return out;
}

export function quatMultiplyInto(a: Quaternion, b: Quaternion, out: Quaternion): Quaternion {
  // Use temps to allow a === out or b === out aliasing
  const ow = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z;
  const ox = a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y;
  const oy = a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x;
  const oz = a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w;
  out.w = ow; out.x = ox; out.y = oy; out.z = oz;
  return out;
}

export function quatNormalizeInto(q: Quaternion, out: Quaternion): Quaternion {
  const m = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
  if (m < 1e-12) { out.w = 1; out.x = 0; out.y = 0; out.z = 0; return out; }
  out.w = q.w / m; out.x = q.x / m; out.y = q.y / m; out.z = q.z / m;
  return out;
}

/**
 * Rotate a vector by a quaternion: q * v * q⁻¹ (zero-alloc).
 * Uses the Rodrigues rotation formula applied to quaternions:
 *   t = 2 * cross(q.xyz, v)
 *   result = v + q.w * t + cross(q.xyz, t)
 * Mathematically equivalent to the sandwich product but avoids all
 * intermediate quaternion allocations.
 */
export function quatRotateVectorInto(q: Quaternion, v: Vector3, out: Vector3): Vector3 {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  out.x = v.x + q.w * tx + (q.y * tz - q.z * ty);
  out.y = v.y + q.w * ty + (q.z * tx - q.x * tz);
  out.z = v.z + q.w * tz + (q.x * ty - q.y * tx);
  return out;
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

export interface RatesConfig {
  rollRate: number; // deg/s at full stick
  pitchRate: number;
  yawRate: number;
  expo: number; // 0-1
}

export const DEFAULT_RATES: RatesConfig = {
  rollRate: 800,
  pitchRate: 800,
  yawRate: 650,
  expo: 0.60,
};
