import type {
  DroneState,
  MotorCommands,
  PhysicsConfig,
  RatesConfig,
  StickInputs,
} from "./types";

const FIELDS_PER_SAMPLE = 27;
const DEFAULT_MAX_SAMPLES = 6000; // 60s at 100Hz
const DEFAULT_STRIDE = 5; // every 5th step of 500Hz -> 100Hz

export interface BlackboxSample {
  t: number;
  sticks: [number, number, number, number]; // [throttle, roll, pitch, yaw]
  motors: [number, number, number, number]; // [m1, m2, m3, m4]
  rpm: [number, number, number, number]; // [rpm1, rpm2, rpm3, rpm4]
  position: [number, number, number]; // [x, y, z] ENU m
  velocity: [number, number, number]; // [vx, vy, vz] ENU m/s
  angularVelocityDeg: [number, number, number]; // [pitchRateX, rollRateY, yawRateZ] deg/s
  quaternion: [number, number, number, number]; // [w, x, y, z]
  agl: number;
}

export interface BlackboxReport {
  recordedAt: string;
  sampleRateHz: number;
  sampleCount: number;
  physicsConfig: PhysicsConfig;
  ratesConfig: RatesConfig;
  summary: {
    durationSeconds: number;
    maxSpeedMs: number;
    maxClimbRateMs: number;
    maxDescentRateMs: number;
    maxAngularRateDeg: [number, number, number];
    meanThrottle: number;
  };
  samples: BlackboxSample[];
}

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Zero-allocation ring buffer for recording in-flight telemetry at 100Hz.
 * Allocates a single Float32Array upfront; formatting occurs only when the
 * user exports from the pause menu.
 */
export class BlackboxLogger {
  private readonly maxSamples: number;
  private readonly stride: number;
  private readonly buffer: Float32Array;
  private writeIndex = 0;
  private count = 0;
  private stepCounter = 0;
  private elapsedSeconds = 0;

  constructor(maxSamples: number = DEFAULT_MAX_SAMPLES, stride: number = DEFAULT_STRIDE) {
    this.maxSamples = Math.max(1, Math.floor(maxSamples));
    this.stride = Math.max(1, Math.floor(stride));
    this.buffer = new Float32Array(this.maxSamples * FIELDS_PER_SAMPLE);
  }

  recordStep(
    dt: number,
    sticks: StickInputs,
    state: DroneState,
    motors: MotorCommands,
    rpms: readonly number[],
    groundHeight: number,
  ): void {
    const sampleStep = this.stepCounter++;
    const sampleTime = this.elapsedSeconds;
    this.elapsedSeconds += dt;
    if (sampleStep % this.stride !== 0) return;

    const base = this.writeIndex * FIELDS_PER_SAMPLE;
    const b = this.buffer;
    b[base] = sampleTime;
    b[base + 1] = sticks.throttle;
    b[base + 2] = sticks.roll;
    b[base + 3] = sticks.pitch;
    b[base + 4] = sticks.yaw;
    b[base + 5] = motors.m1;
    b[base + 6] = motors.m2;
    b[base + 7] = motors.m3;
    b[base + 8] = motors.m4;
    b[base + 9] = rpms[0] ?? 0;
    b[base + 10] = rpms[1] ?? 0;
    b[base + 11] = rpms[2] ?? 0;
    b[base + 12] = rpms[3] ?? 0;
    b[base + 13] = state.position.x;
    b[base + 14] = state.position.y;
    b[base + 15] = state.position.z;
    b[base + 16] = state.velocity.x;
    b[base + 17] = state.velocity.y;
    b[base + 18] = state.velocity.z;
    b[base + 19] = state.angularVelocity.x * RAD_TO_DEG;
    b[base + 20] = state.angularVelocity.y * RAD_TO_DEG;
    b[base + 21] = state.angularVelocity.z * RAD_TO_DEG;
    b[base + 22] = state.quaternion.w;
    b[base + 23] = state.quaternion.x;
    b[base + 24] = state.quaternion.y;
    b[base + 25] = state.quaternion.z;
    b[base + 26] = Math.max(0, state.position.z - groundHeight);

    this.writeIndex = (this.writeIndex + 1) % this.maxSamples;
    if (this.count < this.maxSamples) this.count++;
  }

  exportReport(physicsConfig: PhysicsConfig, ratesConfig: RatesConfig): BlackboxReport {
    const samples: BlackboxSample[] = [];
    const startIdx = this.count < this.maxSamples ? 0 : this.writeIndex;
    const b = this.buffer;

    let maxSpeedMs = 0;
    let maxClimbRateMs = 0;
    let maxDescentRateMs = 0;
    let maxRateX = 0;
    let maxRateY = 0;
    let maxRateZ = 0;
    let throttleSum = 0;

    for (let i = 0; i < this.count; i++) {
      const idx = (startIdx + i) % this.maxSamples;
      const base = idx * FIELDS_PER_SAMPLE;
      const vx = b[base + 16]!;
      const vy = b[base + 17]!;
      const vz = b[base + 18]!;
      const wx = b[base + 19]!;
      const wy = b[base + 20]!;
      const wz = b[base + 21]!;
      const thr = b[base + 1]!;

      const speed = Math.hypot(vx, vy, vz);
      if (speed > maxSpeedMs) maxSpeedMs = speed;
      if (vz > maxClimbRateMs) maxClimbRateMs = vz;
      if (-vz > maxDescentRateMs) maxDescentRateMs = -vz;
      if (Math.abs(wx) > maxRateX) maxRateX = Math.abs(wx);
      if (Math.abs(wy) > maxRateY) maxRateY = Math.abs(wy);
      if (Math.abs(wz) > maxRateZ) maxRateZ = Math.abs(wz);
      throttleSum += thr;

      samples.push({
        t: Number(b[base]!.toFixed(3)),
        sticks: [
          Number(thr.toFixed(3)),
          Number(b[base + 2]!.toFixed(3)),
          Number(b[base + 3]!.toFixed(3)),
          Number(b[base + 4]!.toFixed(3)),
        ],
        motors: [
          Number(b[base + 5]!.toFixed(3)),
          Number(b[base + 6]!.toFixed(3)),
          Number(b[base + 7]!.toFixed(3)),
          Number(b[base + 8]!.toFixed(3)),
        ],
        rpm: [
          Math.round(b[base + 9]!),
          Math.round(b[base + 10]!),
          Math.round(b[base + 11]!),
          Math.round(b[base + 12]!),
        ],
        position: [
          Number(b[base + 13]!.toFixed(2)),
          Number(b[base + 14]!.toFixed(2)),
          Number(b[base + 15]!.toFixed(2)),
        ],
        velocity: [
          Number(vx.toFixed(2)),
          Number(vy.toFixed(2)),
          Number(vz.toFixed(2)),
        ],
        angularVelocityDeg: [
          Number(wx.toFixed(1)),
          Number(wy.toFixed(1)),
          Number(wz.toFixed(1)),
        ],
        quaternion: [
          Number(b[base + 22]!.toFixed(4)),
          Number(b[base + 23]!.toFixed(4)),
          Number(b[base + 24]!.toFixed(4)),
          Number(b[base + 25]!.toFixed(4)),
        ],
        agl: Number(b[base + 26]!.toFixed(2)),
      });
    }

    const durationSeconds = samples.length > 1
      ? Number((samples[samples.length - 1]!.t - samples[0]!.t).toFixed(3))
      : 0;

    return {
      recordedAt: new Date().toISOString(),
      sampleRateHz: Math.round(500 / this.stride),
      sampleCount: this.count,
      physicsConfig: { ...physicsConfig },
      ratesConfig: { ...ratesConfig },
      summary: {
        durationSeconds,
        maxSpeedMs: Number(maxSpeedMs.toFixed(2)),
        maxClimbRateMs: Number(maxClimbRateMs.toFixed(2)),
        maxDescentRateMs: Number(maxDescentRateMs.toFixed(2)),
        maxAngularRateDeg: [
          Number(maxRateX.toFixed(1)),
          Number(maxRateY.toFixed(1)),
          Number(maxRateZ.toFixed(1)),
        ],
        meanThrottle: this.count > 0 ? Number((throttleSum / this.count).toFixed(3)) : 0,
      },
      samples,
    };
  }

  reset(): void {
    this.writeIndex = 0;
    this.count = 0;
    this.stepCounter = 0;
    this.elapsedSeconds = 0;
  }
}
