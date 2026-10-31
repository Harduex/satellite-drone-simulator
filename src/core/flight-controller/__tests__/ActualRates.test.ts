import { describe, expect, it } from 'vitest';
import { applyActualRates, axisRateDeg } from '../FlightModes';
import { DEFAULT_DRONE_CONFIG, DEFAULT_RATES } from '../../physics/droneConfig';
import { DEFAULT_ACTUAL_RATES } from '../RatesConfig';
import { replayFlight } from '../../calibration/FlightReplay';
import { createDefaultDroneState } from '../../physics/types';

describe('Actual rate law', () => {
  it.each([[0, 0], [0.5, 179.6875], [1, 800], [-0.5, -179.6875], [-1, -800]])(
    'evaluates the official reference curve at %s', (stick, expected) => {
      expect(applyActualRates(stick!, { centerSensitivity: 200, maxRate: 800, expo: 0.5 })).toBe(expected);
    });
  it.each([0, 0.5, 1])('preserves center slope and endpoints with expo %s', expo => {
    const config = { centerSensitivity: 200, maxRate: 800, expo };
    expect(applyActualRates(1e-7, config) / 1e-7).toBeCloseTo(200, 3);
    let previous = 0;
    for (let i = 0; i <= 100; i++) {
      const value = applyActualRates(i / 100, config);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(applyActualRates(-i / 100, config)).toBeCloseTo(-value, 12);
      previous = value;
    }
    expect(applyActualRates(1, config)).toBe(800);
    expect(applyActualRates(2, config)).toBe(800);
  });
  it('matches the center floor when max rate is below sensitivity', () => {
    expect(applyActualRates(1, { centerSensitivity: 200, maxRate: 100, expo: 0.5 })).toBe(200);
  });
  it('preserves polynomial semantics when the model is missing or explicit', () => {
    for (const axis of ['roll', 'pitch', 'yaw'] as const) for (const input of [-1, -0.5, 0, 0.5, 1]) {
      const expected = input * (DEFAULT_RATES.expo * input * input + 1 - DEFAULT_RATES.expo) * DEFAULT_RATES[`${axis}Rate`];
      expect(axisRateDeg(input, axis, DEFAULT_RATES)).toBeCloseTo(expected, 12);
      expect(axisRateDeg(input, axis, { ...DEFAULT_RATES, model: 'polynomial' })).toBe(axisRateDeg(input, axis, DEFAULT_RATES));
    }
  });
  it.each([['roll', 'y', 1], ['pitch', 'x', -1], ['yaw', 'z', -1]] as const)(
    'maps positive %s sticks to body %s with the documented sign', (axis, component, sign) => {
      const run = replayFlight({ physicsConfig: { ...DEFAULT_DRONE_CONFIG },
        ratesConfig: { ...DEFAULT_RATES, model: 'actual', actual: DEFAULT_ACTUAL_RATES },
        initialState: createDefaultDroneState(100), effects: { wind: false, groundContact: false },
        inputs: { kind: 'sticks', samples: Array.from({ length: 50 }, () => ({ throttle: 0.3, roll: 0, pitch: 0, yaw: 0, [axis]: 0.2 })) },
      });
      expect(sign * run.samples.at(-1)!.state.angularVelocity[component]).toBeGreaterThan(0);
    });
});
