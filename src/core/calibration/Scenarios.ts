import { DEFAULT_DRONE_CONFIG, DEFAULT_RATES } from '../physics/droneConfig';
import { createDefaultDroneState, type RatesConfig } from '../physics/types';
import type { ReplayOptions } from './FlightReplay';

export function convergenceScenario(hz: number): ReplayOptions {
  if (![250, 500, 1000, 2000].includes(hz)) throw new Error('Unsupported convergence sample rate');
  return { physicsConfig: { ...DEFAULT_DRONE_CONFIG }, ratesConfig: DEFAULT_RATES, seed: 1729,
    dt: 1 / hz, initialState: createDefaultDroneState(100), effects: { wind: false, groundContact: false, groundEffect: false },
    inputs: { kind: 'sticks', samples: Array.from({ length: hz }, (_, i) => ({
      throttle: 0.21, roll: 0, pitch: i / hz >= 0.24 && i / hz < 0.3 ? 0.1 : 0, yaw: 0,
    })) } };
}

/** Synthetic regressions, not measured flights or fitting/holdout datasets. */
export function calibrationScenarios(ratesConfig: RatesConfig = DEFAULT_RATES): Record<string, ReplayOptions> {
  const base = (): ReplayOptions => ({
    physicsConfig: { ...DEFAULT_DRONE_CONFIG, inertia: { ...DEFAULT_DRONE_CONFIG.inertia } },
    ratesConfig, seed: 1729, initialState: createDefaultDroneState(100),
    effects: { wind: false, groundContact: false, groundEffect: false },
    inputs: { kind: 'sticks', samples: [] },
  });
  const hover = Math.pow(Math.sqrt(DEFAULT_DRONE_CONFIG.mass * 9.81 / (4 * DEFAULT_DRONE_CONFIG.kT)) /
    DEFAULT_DRONE_CONFIG.maxThrottleRpm, 1 / DEFAULT_DRONE_CONFIG.motorResponseExponent!);
  const motorSequence = (count: number, command: (i: number) => number) => ({
    kind: 'motors' as const, samples: Array.from({ length: count }, (_, i) => {
      const value = command(i); return { m1: value, m2: value, m3: value, m4: value };
    }),
  });
  const runs: Record<string, ReplayOptions> = {
    hover: { ...base(), effects: { wind: false, groundContact: false, groundEffect: false, inflow: false, loadSag: false, propwash: false },
      inputs: motorSequence(1500, () => hover) },
    'motor-step': { ...base(), inputs: motorSequence(1500, i => i < 500 || i >= 1000 ? 0.2 : 0.8) },
    climb: { ...base(), inputs: { kind: 'sticks', samples: Array.from({ length: 1500 }, (_, i) => ({
      throttle: i < 500 ? 0.21 : 0.4, roll: 0, pitch: 0, yaw: 0,
    })) } },
    coast: { ...base(), initialState: { ...createDefaultDroneState(100), velocity: { x: 20, y: 0, z: 0 } },
      inputs: motorSequence(1000, () => 0) },
    wind: { ...base(), effects: { wind: true, groundContact: false, groundEffect: false }, inputs: motorSequence(1000, () => 0.21) },
    propwash: { ...base(), initialState: { ...createDefaultDroneState(100), velocity: { x: 0, y: 0, z: -2.5 } },
      inputs: motorSequence(1000, () => 0.21) },
    'near-ground': { ...base(), initialState: createDefaultDroneState(0.08),
      effects: { wind: false, groundContact: true, groundEffect: true }, inputs: motorSequence(250, () => 0.21) },
    inverted: { ...base(), initialState: { ...createDefaultDroneState(100), quaternion: { w: 0, x: 1, y: 0, z: 0 } },
      inputs: motorSequence(500, () => 0.21) },
  };
  for (const axis of ['roll', 'pitch', 'yaw'] as const) for (const throttle of [0.1, 0.21, 0.5]) {
    runs[`${axis}-${throttle}`] = { ...base(), inputs: { kind: 'sticks', samples: Array.from({ length: 1000 }, (_, i) => ({
      throttle, roll: 0, pitch: 0, yaw: 0, [axis]: i >= 250 && i < 275 ? 0.5 : i >= 500 && i < 525 ? -0.5 : 0,
    })) } };
  }
  return runs;
}
