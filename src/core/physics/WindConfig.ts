import type { PhysicsConfig, Vector3 } from "./types";

export interface WindConfig {
  windSpeed: number;
  windDirection: number;
  windGustStrength: number;
}

export const WIND_PRESETS = {
  calm: { windSpeed: 0, windGustStrength: 0 },
  light: { windSpeed: 1.5, windGustStrength: 0.35 },
  breezy: { windSpeed: 4, windGustStrength: 1 },
} as const;

function bounded(value: unknown, fallback: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(max, value)) : fallback;
}

export function resolveWindConfig(input: Partial<PhysicsConfig>): WindConfig {
  const fallback = input.gentleWind === false ? WIND_PRESETS.calm : WIND_PRESETS.light;
  const direction = typeof input.windDirection === "number" && Number.isFinite(input.windDirection)
    ? input.windDirection : 233.130102;
  return {
    windSpeed: bounded(input.windSpeed, fallback.windSpeed, 8),
    windDirection: ((direction % 360) + 360) % 360,
    windGustStrength: bounded(input.windGustStrength, fallback.windGustStrength, 2),
  };
}

export function meanWindInto(config: WindConfig, out: Vector3): Vector3 {
  const radians = config.windDirection * Math.PI / 180;
  out.x = -config.windSpeed * Math.sin(radians);
  out.y = -config.windSpeed * Math.cos(radians);
  out.z = 0;
  return out;
}
