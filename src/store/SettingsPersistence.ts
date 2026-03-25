import type { PhysicsConfig, RatesConfig } from "../core/physics/types";
import { DEFAULT_DRONE_CONFIG, DEFAULT_RATES } from "../core/physics/droneConfig";
import type { SavedLocation } from "./settingsSlice";

const DEFAULT_LOCATION_STORAGE_KEY = "fpvsim_default_location";
const PHYSICS_CONFIG_STORAGE_KEY = "fpvsim_physics_config";
const RATES_STORAGE_KEY = "fpvsim_rates";
const FOV_STORAGE_KEY = "fpvsim_fov";
const CAMERA_TILT_STORAGE_KEY = "fpvsim_camera_tilt";

function isFiniteLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180;
}

function parseSavedLocation(value: unknown): SavedLocation | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<SavedLocation>;
  if (
    typeof candidate.lat !== "number" ||
    typeof candidate.lng !== "number" ||
    typeof candidate.name !== "string"
  ) {
    return null;
  }
  if (!isFiniteLatLng(candidate.lat, candidate.lng)) return null;
  return {
    lat: candidate.lat,
    lng: candidate.lng,
    name: candidate.name,
  };
}

/** Merge a persisted partial object into typed defaults, keeping only valid fields. */
export function mergeNumericPartial<T>(persisted: unknown, defaults: T): T {
  if (!persisted || typeof persisted !== "object") return defaults;
  const src = persisted as Record<string, unknown>;
  const result = { ...(defaults as Record<string, unknown>) };
  for (const key of Object.keys(result)) {
    const stored = src[key];
    if (typeof stored === "number" && Number.isFinite(stored)) {
      result[key] = stored;
    } else if (typeof stored === "boolean") {
      result[key] = stored;
    } else if (stored !== null && typeof stored === "object" && typeof result[key] === "object" && result[key] !== null) {
      result[key] = mergeNumericPartial(stored, result[key]);
    }
  }
  return result as T;
}

/** Storage adapter for settings persistence. Extracted for testability. */
export const SettingsPersistence = {
  isFiniteLatLng,

  readDefaultLocation(): SavedLocation | null {
    try {
      if (typeof localStorage === "undefined") return null;
      const raw = localStorage.getItem(DEFAULT_LOCATION_STORAGE_KEY);
      if (!raw) return null;
      return parseSavedLocation(JSON.parse(raw));
    } catch {
      return null;
    }
  },

  writeDefaultLocation(location: SavedLocation): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(DEFAULT_LOCATION_STORAGE_KEY, JSON.stringify(location));
  },

  readPhysicsConfig(): PhysicsConfig {
    try {
      if (typeof localStorage === "undefined") return DEFAULT_DRONE_CONFIG;
      const raw = localStorage.getItem(PHYSICS_CONFIG_STORAGE_KEY);
      if (!raw) return DEFAULT_DRONE_CONFIG;
      return mergeNumericPartial(JSON.parse(raw), DEFAULT_DRONE_CONFIG);
    } catch {
      return DEFAULT_DRONE_CONFIG;
    }
  },

  writePhysicsConfig(config: PhysicsConfig): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(PHYSICS_CONFIG_STORAGE_KEY, JSON.stringify(config));
  },

  readRates(): RatesConfig {
    try {
      if (typeof localStorage === "undefined") return DEFAULT_RATES;
      const raw = localStorage.getItem(RATES_STORAGE_KEY);
      if (!raw) return DEFAULT_RATES;
      return mergeNumericPartial(JSON.parse(raw), DEFAULT_RATES);
    } catch {
      return DEFAULT_RATES;
    }
  },

  writeRates(rates: RatesConfig): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify(rates));
  },

  readFov(): number {
    try {
      if (typeof localStorage === "undefined") return 90;
      const raw = localStorage.getItem(FOV_STORAGE_KEY);
      if (!raw) return 90;
      const v = Number(raw);
      return Number.isFinite(v) ? Math.max(60, Math.min(140, v)) : 90;
    } catch {
      return 90;
    }
  },

  writeFov(fov: number): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(FOV_STORAGE_KEY, String(fov));
  },

  readCameraTilt(): number {
    try {
      if (typeof localStorage === "undefined") return 15;
      const raw = localStorage.getItem(CAMERA_TILT_STORAGE_KEY);
      if (!raw) return 15;
      const v = Number(raw);
      return Number.isFinite(v) ? Math.max(0, Math.min(45, v)) : 15;
    } catch {
      return 15;
    }
  },

  writeCameraTilt(tilt: number): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(CAMERA_TILT_STORAGE_KEY, String(tilt));
  },
};
