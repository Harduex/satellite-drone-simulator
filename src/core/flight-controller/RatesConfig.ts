import type { ActualAxisRates, ActualRatesConfig, RatesConfig } from '../physics/types';

// Starting preferences for the optional model; not a measured airframe property.
export const DEFAULT_ACTUAL_RATES: ActualRatesConfig = {
  roll: { centerSensitivity: 200, maxRate: 800, expo: 0 },
  pitch: { centerSensitivity: 200, maxRate: 800, expo: 0 },
  yaw: { centerSensitivity: 200, maxRate: 650, expo: 0 },
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function readActualRates(value: unknown): ActualRatesConfig {
  const source = record(value);
  const axis = (name: keyof ActualRatesConfig): ActualAxisRates => {
    const saved = record(source[name]);
    const defaults = DEFAULT_ACTUAL_RATES[name];
    const numeric = (key: keyof ActualAxisRates, max: number): number => {
      const candidate = saved[key];
      return typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0 && candidate <= max ? candidate : defaults[key];
    };
    return { centerSensitivity: numeric('centerSensitivity', 2000), maxRate: numeric('maxRate', 2000), expo: numeric('expo', 1) };
  };
  return { roll: axis('roll'), pitch: axis('pitch'), yaw: axis('yaw') };
}

export function validateRates(rates: RatesConfig): void {
  if (rates.model !== undefined && rates.model !== 'polynomial' && rates.model !== 'actual') throw new Error('Replay rates model is unsupported');
  if (rates.actual !== undefined) for (const axis of ['roll', 'pitch', 'yaw'] as const) {
    for (const field of ['centerSensitivity', 'maxRate', 'expo'] as const) {
      const value = rates.actual?.[axis]?.[field];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > (field === 'expo' ? 1 : 2000)) {
        throw new Error(`Replay actual.${axis}.${field} is invalid`);
      }
    }
  }
}
