import { describe, expect, it } from 'vitest';
import { replayFlight, replayToCsv } from '../FlightReplay';
import { DEFAULT_DRONE_CONFIG, DEFAULT_RATES } from '../../physics/droneConfig';
import { createDefaultDroneState } from '../../physics/types';

const sticks = () => Array.from({ length: 500 }, (_, i) => ({
  throttle: 0.21, roll: i >= 100 && i < 125 ? 0.1 : 0, pitch: 0, yaw: 0,
}));
const options = () => ({
  physicsConfig: structuredClone(DEFAULT_DRONE_CONFIG), ratesConfig: { ...DEFAULT_RATES },
  initialState: createDefaultDroneState(100), inputs: { kind: 'sticks' as const, samples: sticks() }, seed: 123,
});

describe('deterministic full-precision replay', () => {
  it('replays identical seeded inputs exactly, independently of intervening runs', () => {
    const input = options();
    const first = replayFlight(input);
    replayFlight({ ...options(), seed: 999 });
    expect(replayFlight(input)).toEqual(first);
    expect(replayFlight({ ...input, seed: 999 }).samples).not.toEqual(first.samples);
    expect(first.samples).toHaveLength(500);
    expect(first.samples[0]!.t).toBe(0.002);
    expect(first.samples[499]!.t).toBe(1);
  });

  it('owns snapshots and preserves double precision through JSON and CSV', () => {
    const input = options();
    input.initialState.position.x = 1.1234567890123457;
    const original = structuredClone(input);
    const report = replayFlight(input);
    expect(input).toEqual(original);
    const sample = structuredClone(report.samples[0]!);
    report.samples[1]!.state.position.x = 999;
    input.initialState.position.x = 888;
    expect(report.samples[0]).toEqual(sample);
    expect(report.initialState.position.x).toBe(original.initialState.position.x);
    expect(JSON.parse(JSON.stringify(report)).samples[0]).toEqual(sample);
    const csv = replayToCsv(report).split('\n');
    expect(csv).toHaveLength(502);
    expect(csv[0]).toContain('omega_x_rad_s');
    expect(csv[1]).toContain(String(sample.state.position.x));
  });

  it.each([NaN, -1, 0, Infinity, Number.MIN_VALUE])('rejects invalid timestep %s', dt => {
    expect(() => replayFlight({ ...options(), dt })).toThrow(/dt|sampleRateHz/);
  });
  it('rejects missing/nonfinite/out-of-range samples and invalid initial states', () => {
    expect(() => replayFlight({ ...options(), inputs: { kind: 'sticks', samples: [{ throttle: NaN, roll: 0, pitch: 0, yaw: 0 }] } })).toThrow(/throttle/);
    expect(() => replayFlight({ ...options(), inputs: { kind: 'motors', samples: [{ m1: 2, m2: 0, m3: 0, m4: 0 }] } })).toThrow(/m1/);
    const input = options(); input.initialState.quaternion.w = 2;
    expect(() => replayFlight(input)).toThrow(/quaternion/);
    expect(() => replayFlight({ ...options(), physicsConfig: { ...DEFAULT_DRONE_CONFIG, mass: 0 } })).toThrow(/mass/);
  });

  it('exports resolved wind and rejects motor/aero settings that would be silently coerced', () => {
    const wind = replayFlight({ ...options(), physicsConfig: { ...DEFAULT_DRONE_CONFIG,
      windSpeed: 99, windGustStrength: 99, windDirection: -360 },
    });
    expect(wind.requestedPhysicsConfig.windSpeed).toBe(99);
    expect(wind.physicsConfig.windSpeed).toBe(8);
    expect(wind.physicsConfig.windGustStrength).toBe(2);
    expect(wind.physicsConfig.windDirection).toBe(0);
    for (const invalid of [{ motorResponseExponent: 0 }, { loadVoltageSag: 0.6 }, { loadSagTimeConstant: 0 },
      { propwashThrustLoss: 0.6 }, { groundEffectStrength: 0.6 }, { rotorDiameter: 0 }]) {
      expect(() => replayFlight({ ...options(), physicsConfig: { ...DEFAULT_DRONE_CONFIG, ...invalid } })).toThrow(/Replay/);
    }
  });

  it('matches independent ballistic Euler and gravity oracles with identification effects off', () => {
    const state = createDefaultDroneState(100); state.velocity.x = 12;
    const report = replayFlight({ ...options(), initialState: state,
      physicsConfig: { ...DEFAULT_DRONE_CONFIG, dragCoefficient: 0, rotorDragCoefficient: 0 },
      effects: { wind: false, groundContact: false, groundEffect: false, propwash: false, inflow: false, loadSag: false },
      inputs: { kind: 'motors', samples: Array.from({ length: 1000 }, () => ({ m1: 0, m2: 0, m3: 0, m4: 0 })) },
    });
    const last = report.samples.at(-1)!.state;
    expect(last.position.x).toBeCloseTo(24, 10);
    expect(last.velocity.z).toBeCloseTo(-19.62, 10);
    expect(last.position.z).toBeCloseTo(100 - 9.81 * 0.002 ** 2 * 1000 * 999 / 2, 10);
    expect(last.quaternion).toEqual({ w: 1, x: 0, y: 0, z: 0 });
    expect(report.physicsConfig.propwashTurbulence).toBe(0);
  });

  it('converges toward analytical free fall at 250/500/1000 Hz', () => {
    const errors = [250, 500, 1000].map(hz => {
      const report = replayFlight({ ...options(), dt: 1 / hz,
        physicsConfig: { ...DEFAULT_DRONE_CONFIG, dragCoefficient: 0, rotorDragCoefficient: 0 },
        effects: { wind: false, groundContact: false },
        inputs: { kind: 'motors', samples: Array.from({ length: hz }, () => ({ m1: 0, m2: 0, m3: 0, m4: 0 })) },
      });
      return Math.abs(report.samples.at(-1)!.state.position.z - (100 - 9.81 / 2));
    });
    expect(errors[0]! / errors[1]!).toBeCloseTo(2, 8);
    expect(errors[1]! / errors[2]!).toBeCloseTo(2, 8);
  });
});
