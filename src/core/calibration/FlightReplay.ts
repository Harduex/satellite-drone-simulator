import { FlightController } from '../flight-controller/FlightController';
import { validateRates } from '../flight-controller/RatesConfig';
import { DronePhysics } from '../physics/DronePhysics';
import { WindModel } from '../physics/WindModel';
import { resolveWindConfig } from '../physics/WindConfig';
import type { DroneState, MotorCommands, PhysicsConfig, RatesConfig, StickInputs, Vector3 } from '../physics/types';

export interface ReplayEffects {
  wind: boolean;
  groundContact: boolean;
  groundEffect: boolean;
  propwash: boolean;
  inflow: boolean;
  loadSag: boolean;
}
export interface ReplayOptions {
  physicsConfig: PhysicsConfig;
  ratesConfig: RatesConfig;
  initialState: DroneState;
  inputs: { kind: 'sticks'; samples: readonly StickInputs[] } | { kind: 'motors'; samples: readonly MotorCommands[] };
  seed?: number;
  dt?: number;
  groundHeight?: number;
  effects?: Partial<ReplayEffects>;
}
export interface ReplaySample {
  step: number;
  t: number;
  sticks: StickInputs | null;
  motors: MotorCommands;
  rpm: number[];
  wind: Vector3;
  state: DroneState;
}
export interface FlightReplay {
  schemaVersion: 1;
  kind: 'synthetic-simulation';
  sampleRateHz: number;
  dt: number;
  seed: number;
  inputKind: 'sticks' | 'motors';
  groundHeight: number;
  effects: ReplayEffects;
  conventions: typeof REPLAY_CONVENTIONS;
  physicsConfig: PhysicsConfig;
  requestedPhysicsConfig: PhysicsConfig;
  ratesConfig: RatesConfig;
  initialState: DroneState;
  samples: ReplaySample[];
}

export const REPLAY_CONVENTIONS = {
  world: 'ENU: x east, y north, z up', body: 'x right (pitch), y forward (roll), z up (yaw)',
  quaternion: 'w,x,y,z; body to world', position: 'm', velocity: 'm/s', angularVelocity: 'rad/s; body x,y,z',
  rpm: 'modeled mechanical RPM; m1,m2,m3,m4', motors: 'normalized command [0,1]; m1,m2,m3,m4',
  sticks: 'throttle [0,1]; roll,pitch,yaw [-1,1]',
  stickToBody: 'roll -> +omega.y; pitch -> -omega.x; yaw -> -omega.z',
  timestamp: 'seconds since initial state; post-step state, input applied during preceding dt',
  precision: 'IEEE-754 binary64; no rounding, decimation or ring-buffer truncation',
} as const;

function cloneState(state: DroneState): DroneState {
  return { position: { ...state.position }, velocity: { ...state.velocity },
    quaternion: { ...state.quaternion }, angularVelocity: { ...state.angularVelocity } };
}

function requireNumber(value: unknown, name: string, min = -Infinity, max = Infinity): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Replay ${name} must be finite in [${min}, ${max}]`);
  }
}

function validateState(state: DroneState): void {
  if (!state || typeof state !== 'object') throw new Error('Replay state is missing');
  for (const group of ['position', 'velocity', 'angularVelocity', 'quaternion'] as const) {
    for (const axis of group === 'quaternion' ? ['w', 'x', 'y', 'z'] : ['x', 'y', 'z']) {
      requireNumber((state[group] as unknown as Record<string, unknown>)?.[axis], `${group}.${axis}`);
    }
  }
  const q = state.quaternion;
  if (Math.abs(Math.hypot(q.w, q.x, q.y, q.z) - 1) > 1e-9) throw new Error('Replay quaternion must be unit length');
}

/** Validate imported baseline data before arithmetic can coerce missing/null values to zero. */
export function validateReplay(report: FlightReplay): void {
  if (!report || report.schemaVersion !== 1 || report.kind !== 'synthetic-simulation') throw new Error('Unsupported replay schema');
  requireNumber(report.dt, 'dt', Number.MIN_VALUE, 0.1);
  requireNumber(report.sampleRateHz, 'sampleRateHz', 1);
  if (report.sampleRateHz !== 1 / report.dt) throw new Error('Replay sample rate differs from dt');
  if (report.inputKind !== 'sticks' && report.inputKind !== 'motors') throw new Error('Replay input kind is missing');
  validateState(report.initialState);
  if (!Array.isArray(report.samples) || report.samples.length === 0) throw new Error('Replay samples are missing');
  for (const [i, sample] of report.samples.entries()) {
    if (!sample || sample.step !== i + 1 || sample.t !== (i + 1) * report.dt) throw new Error('Replay sample timing is invalid');
    validateState(sample.state);
    for (const field of ['m1', 'm2', 'm3', 'm4'] as const) requireNumber(sample.motors?.[field], `motors.${field}`, 0, 1);
    if (!Array.isArray(sample.rpm) || sample.rpm.length !== 4) throw new Error('Replay rpm must contain four values');
    for (const value of sample.rpm) requireNumber(value, 'rpm', 0);
    for (const axis of ['x', 'y', 'z'] as const) requireNumber(sample.wind?.[axis], `wind.${axis}`);
    if (report.inputKind === 'sticks') {
      for (const field of ['throttle', 'roll', 'pitch', 'yaw'] as const) requireNumber(sample.sticks?.[field], `input.${field}`, field === 'throttle' ? 0 : -1, 1);
    } else if (sample.sticks !== null) throw new Error('Direct motor replay must not imply measured sticks');
  }
}

function validateConfig(config: PhysicsConfig): void {
  const positive = ['mass', 'armLength', 'kT', 'motorTimeConstant', 'motorSpinDownFactor', 'maxThrottleRpm'] as const;
  for (const key of positive) requireNumber(config[key], key, Number.MIN_VALUE);
  for (const key of ['kQ', 'dragCoefficient', 'referenceArea', 'verticalDragMultiplier', 'spawnAltitude'] as const) {
    requireNumber(config[key], key, 0);
  }
  for (const axis of ['xx', 'yy', 'zz'] as const) requireNumber(config.inertia?.[axis], `inertia.${axis}`, Number.MIN_VALUE);
  for (const key of ['motorResponseExponent', 'loadSagTimeConstant', 'rotorDiameter'] as const) {
    if (config[key] !== undefined) requireNumber(config[key], key, Number.MIN_VALUE);
  }
  for (const key of ['loadVoltageSag', 'propwashThrustLoss', 'groundEffectStrength'] as const) {
    if (config[key] !== undefined) requireNumber(config[key], key, 0, 0.5);
  }
  for (const [key, value] of Object.entries(config)) {
    if (key === 'inertia') continue;
    if (key === 'gentleWind' || key === 'thrustLinearization') {
      if (typeof value !== 'boolean') throw new Error(`Replay ${key} must be boolean`);
    } else requireNumber(value, key, key === 'windDirection' ? -Infinity : 0);
  }
}

/** Development-only replay. No imports from the browser loop or rounded flight logger. */
export function replayFlight(options: ReplayOptions): FlightReplay {
  const dt = options.dt ?? 1 / 500;
  requireNumber(dt, 'dt', Number.MIN_VALUE, 0.1);
  requireNumber(1 / dt, 'sampleRateHz', 1);
  requireNumber(options.seed ?? 1729, 'seed', 0, 0xffffffff);
  if (!Number.isInteger(options.seed ?? 1729)) throw new Error('Replay seed must be an integer');
  const seed = (options.seed ?? 1729) >>> 0 || 1729;
  const groundHeight = options.groundHeight ?? 0;
  requireNumber(groundHeight, 'groundHeight');
  validateState(options.initialState);
  validateConfig(options.physicsConfig);
  validateRates(options.ratesConfig);
  for (const key of ['rollRate', 'pitchRate', 'yawRate', 'expo'] as const) {
    requireNumber(options.ratesConfig[key], key, 0, key === 'expo' ? 1 : Infinity);
  }
  const effects: ReplayEffects = { wind: true, groundContact: true, groundEffect: true,
    propwash: true, inflow: true, loadSag: true, ...options.effects };
  for (const [key, value] of Object.entries(effects)) if (typeof value !== 'boolean') throw new Error(`Replay effect ${key} must be boolean`);
  const config: PhysicsConfig = { ...options.physicsConfig, inertia: { ...options.physicsConfig.inertia } };
  if (!effects.groundEffect) config.groundEffectStrength = 0;
  if (!effects.propwash) { config.propwashThrustLoss = 0; config.propwashTurbulence = 0; }
  if (!effects.inflow) delete config.propellerPitch;
  if (!effects.loadSag) config.loadVoltageSag = 0;
  if (!effects.wind) { config.gentleWind = false; config.windSpeed = 0; config.windGustStrength = 0; }
  Object.assign(config, resolveWindConfig(config));
  if (options.inputs.kind !== 'sticks' && options.inputs.kind !== 'motors') throw new Error('Replay input kind must be sticks or motors');
  if (!Array.isArray(options.inputs.samples) || options.inputs.samples.length === 0) throw new Error('Replay requires input samples');
  for (const [i, sample] of options.inputs.samples.entries()) {
    const fields = options.inputs.kind === 'sticks' ? ['throttle', 'roll', 'pitch', 'yaw'] : ['m1', 'm2', 'm3', 'm4'];
    for (const key of fields) requireNumber((sample as unknown as Record<string, unknown>)?.[key], `input[${i}].${key}`,
      key === 'throttle' || options.inputs.kind === 'motors' ? 0 : -1, 1);
  }
  const physics = new DronePhysics(config);
  const ratesConfig = JSON.parse(JSON.stringify(options.ratesConfig)) as RatesConfig;
  const controller = new FlightController(ratesConfig);
  const windModel = new WindModel(resolveWindConfig(config), seed);
  const wind = { x: 0, y: 0, z: 0 };
  let state = cloneState(options.initialState);
  let next = cloneState(state);
  const motors: MotorCommands = { m1: 0, m2: 0, m3: 0, m4: 0 };
  const samples: ReplaySample[] = [];
  for (let i = 0; i < options.inputs.samples.length; i++) {
    let sticks: StickInputs | null = null;
    if (options.inputs.kind === 'sticks') {
      const input: StickInputs = { ...options.inputs.samples[i]! };
      sticks = input;
      controller.updateInto(input, state, dt, motors);
    } else Object.assign(motors, options.inputs.samples[i]!);
    windModel.updateInto(dt, wind);
    physics.stepInto(state, motors, dt, groundHeight, next, wind, effects.groundContact);
    const previous = state; state = next; next = previous;
    validateState(state);
    samples.push({ step: i + 1, t: (i + 1) * dt, sticks, motors: { ...motors },
      rpm: [...physics.getMotorModel().state.rpm], wind: { ...wind }, state: cloneState(state) });
  }
  return { schemaVersion: 1, kind: 'synthetic-simulation', sampleRateHz: 1 / dt, dt, seed,
    inputKind: options.inputs.kind, groundHeight, effects, conventions: { ...REPLAY_CONVENTIONS },
    physicsConfig: config, requestedPhysicsConfig: { ...options.physicsConfig, inertia: { ...options.physicsConfig.inertia } },
    ratesConfig, initialState: cloneState(options.initialState), samples };
}

export function replayToCsv(report: FlightReplay): string {
  const header = 'step,t_s,throttle,roll,pitch,yaw,m1,m2,m3,m4,rpm1,rpm2,rpm3,rpm4,wind_x_m_s,wind_y_m_s,wind_z_m_s,x_m,y_m,z_m,vx_m_s,vy_m_s,vz_m_s,omega_x_rad_s,omega_y_rad_s,omega_z_rad_s,qw,qx,qy,qz';
  const rows = report.samples.map(s => {
    const { position: p, velocity: v, angularVelocity: w, quaternion: q } = s.state;
    return [s.step, s.t, s.sticks?.throttle ?? '', s.sticks?.roll ?? '', s.sticks?.pitch ?? '', s.sticks?.yaw ?? '',
      s.motors.m1, s.motors.m2, s.motors.m3, s.motors.m4, ...s.rpm, s.wind.x, s.wind.y, s.wind.z,
      p.x, p.y, p.z, v.x, v.y, v.z, w.x, w.y, w.z, q.w, q.x, q.y, q.z].join(',');
  });
  return [header, ...rows, ''].join('\n');
}
