// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { SettingsPersistence } from '../SettingsPersistence';
import { DEFAULT_RATES } from '../../core/physics/droneConfig';
import { DEFAULT_ACTUAL_RATES } from '../../core/flight-controller/RatesConfig';

beforeEach(() => localStorage.clear());
it('preserves legacy values without selecting a new model', () => {
  const saved = { rollRate: 600, pitchRate: 550, yawRate: 400, expo: 0.3 };
  SettingsPersistence.writeRates(saved);
  expect(SettingsPersistence.readRates()).toEqual(saved);
});
it('round-trips Actual per-axis values while retaining inactive polynomial values', () => {
  const saved = { ...DEFAULT_RATES, model: 'actual' as const, actual: {
    ...DEFAULT_ACTUAL_RATES, roll: { centerSensitivity: 123, maxRate: 777, expo: 0.42 },
  } };
  SettingsPersistence.writeRates(saved);
  expect(SettingsPersistence.readRates()).toEqual(saved);
  SettingsPersistence.writeRates({ ...saved, model: 'polynomial' });
  expect(SettingsPersistence.readRates()).toEqual({ ...saved, model: 'polynomial' });
});
it('ignores unknown models and sanitizes malformed Actual fields', () => {
  localStorage.setItem('fpvsim_rates', JSON.stringify({ ...DEFAULT_RATES, model: 'unknown' }));
  expect(SettingsPersistence.readRates()).toEqual(DEFAULT_RATES);
  localStorage.setItem('fpvsim_rates', JSON.stringify({ model: 'actual', actual: { roll: { centerSensitivity: 'bad', maxRate: -1, expo: 2 } } }));
  expect(SettingsPersistence.readRates()).toEqual({ ...DEFAULT_RATES, model: 'actual', actual: DEFAULT_ACTUAL_RATES });
});
