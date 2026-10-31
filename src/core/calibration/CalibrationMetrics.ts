import { MotorModel } from '../physics/MotorModel';
import type { DroneState, PhysicsConfig } from '../physics/types';
import { validateReplay, type FlightReplay } from './FlightReplay';
import { MOTOR_BENCH, MOTOR_BENCH_SOURCE } from './ParameterProvenance';

export function staticBenchErrors(config: PhysicsConfig) {
  const points = MOTOR_BENCH.map(point => {
    const motor = new MotorModel({ ...config, loadVoltageSag: 0, thrustLinearization: false });
    const commands = Array<number>(4).fill(point.command);
    let thrust = 0;
    for (let i = 0; i < 1000; i++) thrust = motor.update(commands, 0.002)[0]!;
    const rpm = motor.state.rpm[0]!;
    return { ...point, predictedRpm: rpm, predictedThrustN: thrust, measuredThrustN: point.thrustG * 9.81 / 1000,
      rpmErrorPct: 100 * (rpm / point.rpm - 1), thrustErrorPct: 100 * (thrust / (point.thrustG * 9.81 / 1000) - 1) };
  });
  return { source: MOTOR_BENCH_SOURCE, airframe: 'F60 Pro V 1750KV + T5147-3; 24.8–25.2V static bench',
    method: 'MotorModel, 2s settling at 500Hz; sag disabled to isolate motor/prop static response',
    limitations: 'No transient/shaft-torque/flight holdout; bench throttle is not independently verified as ESC command. Below 20% is extrapolation.',
    points, maxAbsRpmErrorPct: Math.max(...points.map(p => Math.abs(p.rpmErrorPct))),
    maxAbsThrustErrorPct: Math.max(...points.map(p => Math.abs(p.thrustErrorPct))) };
}

function distance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function stateErrors(a: DroneState, b: DroneState) {
  const q = a.quaternion, r = b.quaternion;
  const sameOrientation = q.w === r.w && q.x === r.x && q.y === r.y && q.z === r.z;
  const dot = Math.abs(q.w * r.w + q.x * r.x + q.y * r.y + q.z * r.z) /
    (Math.hypot(q.w, q.x, q.y, q.z) * Math.hypot(r.w, r.x, r.y, r.z));
  return { positionM: distance(a.position, b.position), velocityMs: distance(a.velocity, b.velocity),
    angularVelocityRadS: distance(a.angularVelocity, b.angularVelocity),
    attitudeRad: sameOrientation ? 0 : 2 * Math.acos(Math.min(1, dot)) };
}

export function compareReplays(before: FlightReplay, after: FlightReplay) {
  validateReplay(before);
  validateReplay(after);
  for (const key of ['schemaVersion', 'kind', 'sampleRateHz', 'dt', 'seed', 'inputKind', 'groundHeight', 'effects', 'conventions', 'initialState'] as const) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) throw new Error(`Incompatible replay experiment: ${key}`);
  }
  if (before.samples.length !== after.samples.length) throw new Error('Incompatible replay sample count');
  let maxPositionErrorM = 0, maxVelocityErrorMs = 0, maxAttitudeErrorRad = 0, positionSquared = 0;
  for (let i = 0; i < before.samples.length; i++) {
    const a = before.samples[i]!, b = after.samples[i]!;
    if (a.step !== b.step || a.t !== b.t) throw new Error('Incompatible replay sample timing');
    const inputA = before.inputKind === 'sticks' ? a.sticks : a.motors;
    const inputB = after.inputKind === 'sticks' ? b.sticks : b.motors;
    if (JSON.stringify(inputA) !== JSON.stringify(inputB)) throw new Error('Incompatible replay input');
    const errors = stateErrors(a.state, b.state);
    maxPositionErrorM = Math.max(maxPositionErrorM, errors.positionM);
    maxVelocityErrorMs = Math.max(maxVelocityErrorMs, errors.velocityMs);
    maxAttitudeErrorRad = Math.max(maxAttitudeErrorRad, errors.attitudeRad);
    positionSquared += errors.positionM ** 2;
  }
  const horizons = [0.1, 0.25, 0.5, 1, 2].filter(t => t <= before.samples.length * before.dt).map(seconds => {
    const index = Math.round(seconds / before.dt) - 1;
    return { seconds, sampledSeconds: before.samples[index]!.t, ...stateErrors(before.samples[index]!.state, after.samples[index]!.state) };
  });
  return { interpretation: 'Paired synthetic regression difference; not real-flight prediction error',
    maxPositionErrorM, positionRmseM: Math.sqrt(positionSquared / before.samples.length), maxVelocityErrorMs, maxAttitudeErrorRad, horizons };
}

export function summarizeReplay(replay: FlightReplay) {
  let maxSpeedMs = 0, maxQuaternionNormError = 0;
  const maxBodyRateRadS = { x: 0, y: 0, z: 0 };
  for (const sample of replay.samples) {
    const { velocity: v, angularVelocity: w, quaternion: q } = sample.state;
    maxSpeedMs = Math.max(maxSpeedMs, Math.hypot(v.x, v.y, v.z));
    maxQuaternionNormError = Math.max(maxQuaternionNormError, Math.abs(Math.hypot(q.w, q.x, q.y, q.z) - 1));
    for (const axis of ['x', 'y', 'z'] as const) maxBodyRateRadS[axis] = Math.max(maxBodyRateRadS[axis], Math.abs(w[axis]));
  }
  return { sampleCount: replay.samples.length, durationSeconds: replay.samples.length * replay.dt,
    maxSpeedMs, maxBodyRateRadS, maxQuaternionNormError, finalState: replay.samples.at(-1)!.state };
}
