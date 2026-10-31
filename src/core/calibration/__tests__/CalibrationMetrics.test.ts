import { expect, it } from 'vitest';
import { staticBenchErrors, compareReplays } from '../CalibrationMetrics';
import { PHYSICS_PROVENANCE } from '../ParameterProvenance';
import { DEFAULT_DRONE_CONFIG } from '../../physics/droneConfig';
import { calibrationScenarios, convergenceScenario } from '../Scenarios';
import { replayFlight } from '../FlightReplay';

it('computes measured static errors through the actual MotorModel with sag isolated', () => {
  const errors = staticBenchErrors(DEFAULT_DRONE_CONFIG);
  expect(errors.points).toHaveLength(5);
  expect(errors.maxAbsRpmErrorPct).toBeCloseTo(3.665815296465369, 8);
  expect(errors.maxAbsThrustErrorPct).toBeCloseTo(4.165107129807755, 8);
  expect(staticBenchErrors({ ...DEFAULT_DRONE_CONFIG, kT: DEFAULT_DRONE_CONFIG.kT * 2 }).maxAbsThrustErrorPct).toBeGreaterThan(90);
});
it('covers every default physical parameter with explicit provenance, units and uncertainty', () => {
  expect(Object.keys(PHYSICS_PROVENANCE).sort()).toEqual(Object.keys(DEFAULT_DRONE_CONFIG).sort());
  for (const entry of Object.values(PHYSICS_PROVENANCE)) {
    expect(entry.source.length).toBeGreaterThan(0);
    expect(entry.units.length).toBeGreaterThan(0);
    expect(entry.method.length).toBeGreaterThan(0);
    expect(entry.uncertainty.length).toBeGreaterThan(0);
    expect(['high', 'medium', 'low']).toContain(entry.confidence);
  }
});
it('compares paired replay states and rejects changed experiments', () => {
  const options = calibrationScenarios().coast!;
  const reference = replayFlight(options);
  expect(compareReplays(reference, replayFlight(options)).maxPositionErrorM).toBe(0);
  const changed = replayFlight({ ...options, physicsConfig: { ...options.physicsConfig, dragCoefficient: 0 } });
  const comparison = compareReplays(reference, changed);
  expect(comparison.maxPositionErrorM).toBeGreaterThan(0.1);
  expect(comparison.horizons.map(h => h.seconds)).toEqual([0.1, 0.25, 0.5, 1, 2]);
  const incompatible = structuredClone(reference); incompatible.seed++;
  expect(() => compareReplays(reference, incompatible)).toThrow(/experiment/);
  const truncated = structuredClone(reference); truncated.samples.pop();
  expect(() => compareReplays(reference, truncated)).toThrow(/sample/);
  const changedInput = structuredClone(reference); changedInput.samples[0]!.motors.m1 = 0.1;
  expect(() => compareReplays(reference, changedInput)).toThrow(/input/);
  const corrupted = structuredClone(reference);
  corrupted.samples[0]!.state.position.x = null as unknown as number;
  expect(() => compareReplays(reference, corrupted)).toThrow(/position/);
  const missingRpm = structuredClone(reference); missingRpm.samples[0]!.rpm.pop();
  expect(() => compareReplays(reference, missingRpm)).toThrow(/rpm/);
});

it('uses identical physical pulse boundaries and impulse for every convergence timestep', () => {
  for (const hz of [250, 500, 1000, 2000]) {
    const scenario = convergenceScenario(hz);
    if (scenario.inputs.kind !== 'sticks') throw new Error('Expected sticks');
    const samples = scenario.inputs.samples;
    expect(samples.findIndex(sample => sample.pitch > 0) / hz).toBe(0.24);
    expect(samples.filter(sample => sample.pitch > 0).length / hz).toBe(0.06);
    expect(samples.reduce((sum, sample) => sum + sample.pitch / hz, 0)).toBeCloseTo(0.006, 12);
  }
});
