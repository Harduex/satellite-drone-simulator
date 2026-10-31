import type { ActualAxisRates, RatesConfig } from '../physics/types';
import { DEFAULT_ACTUAL_RATES } from './RatesConfig';

export enum FlightMode {
  ACRO = "ACRO",
}

/** Apply expo curve to a stick input [-1, 1] */
export function applyExpo(input: number, expo: number): number {
  return input * (expo * input * input + (1 - expo));
}
/** Actual rates: independent center slope and full-stick rate, expressed in deg/s. */
export function applyActualRates(input: number, rates: ActualAxisRates): number {
  const stick = Math.max(-1, Math.min(1, input));
  const squared = stick * stick;
  const transition = Math.abs(stick) * stick * (1 - rates.expo + rates.expo * squared * squared);
  return rates.centerSensitivity * stick + Math.max(0, rates.maxRate - rates.centerSensitivity) * transition;
}

export function axisRateDeg(input: number, axis: 'roll' | 'pitch' | 'yaw', config: RatesConfig): number {
  if (config.model === 'actual') return applyActualRates(input, (config.actual ?? DEFAULT_ACTUAL_RATES)[axis]);
  const maxRate = axis === 'roll' ? config.rollRate : axis === 'pitch' ? config.pitchRate : config.yawRate;
  return applyExpo(input, config.expo) * maxRate;
}
