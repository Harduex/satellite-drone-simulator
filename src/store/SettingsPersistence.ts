import type { PhysicsConfig, RatesConfig } from "../core/physics/types";
import { DEFAULT_DRONE_CONFIG, DEFAULT_RATES } from "../core/physics/droneConfig";
import type { SavedLocation } from "./settingsSlice";
import { resolveWindConfig } from "../core/physics/WindConfig";

const DEFAULT_LOCATION_STORAGE_KEY = "fpvsim_default_location";
const PHYSICS_CONFIG_STORAGE_KEY = "fpvsim_physics_config";
const RATES_STORAGE_KEY = "fpvsim_rates";
const FOV_STORAGE_KEY = "fpvsim_fov";
const CAMERA_TILT_STORAGE_KEY = "fpvsim_camera_tilt";
const GOD_MODE_STORAGE_KEY = "fpvsim_god_mode";
const AUDIO_VOLUME_STORAGE_KEY = "fpvsim_audio_volume";
const SHOW_STICK_OVERLAY_STORAGE_KEY = "fpvsim_show_stick_overlay";
const REAL_TIME_STORAGE_KEY = "fpvsim_real_time_of_day";
export const DEFAULT_FOV = 110;
export const DEFAULT_CAMERA_TILT = 25;

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

  readRealTimeOfDay(): boolean {
    try { return typeof localStorage !== "undefined" && localStorage.getItem(REAL_TIME_STORAGE_KEY) === "true"; }
    catch { return false; }
  },

  writeRealTimeOfDay(enabled: boolean): void {
    try { if (typeof localStorage !== "undefined") localStorage.setItem(REAL_TIME_STORAGE_KEY, String(enabled)); }
    catch { console.warn("Time-of-day preference could not be saved; using this session's setting."); }
  },

  readShowStickOverlay(): boolean {
    try {
      return typeof localStorage === "undefined" || localStorage.getItem(SHOW_STICK_OVERLAY_STORAGE_KEY) !== "false";
    } catch { return true; }
  },

  writeShowStickOverlay(enabled: boolean): void {
    if (typeof localStorage !== "undefined") localStorage.setItem(SHOW_STICK_OVERLAY_STORAGE_KEY, String(enabled));
  },

  readAudioVolume(): number {
    try {
      const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(AUDIO_VOLUME_STORAGE_KEY);
      if (raw === null || raw.trim() === "") return 0.35;
      const volume = Number(raw);
      return Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.35;
    } catch { return 0.35; }
  },

  writeAudioVolume(volume: number): void {
    if (typeof localStorage !== "undefined") localStorage.setItem(AUDIO_VOLUME_STORAGE_KEY, String(volume));
  },

  readGodMode(): boolean {
    try {
      return typeof localStorage !== "undefined" && localStorage.getItem(GOD_MODE_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  },

  writeGodMode(enabled: boolean): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(GOD_MODE_STORAGE_KEY, String(enabled));
  },

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
      const saved: unknown = JSON.parse(raw);
      const wind = resolveWindConfig(saved && typeof saved === "object" ? saved as Partial<PhysicsConfig> : {});
      return { ...mergeNumericPartial(saved, DEFAULT_DRONE_CONFIG), ...wind };
    } catch {
      return DEFAULT_DRONE_CONFIG;
    }
  },

  writePhysicsConfig(config: PhysicsConfig): void {
    try { if (typeof localStorage !== "undefined") localStorage.setItem(PHYSICS_CONFIG_STORAGE_KEY, JSON.stringify(config)); }
    catch { console.warn("Physics preferences could not be saved; using this session's settings."); }
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
      if (typeof localStorage === "undefined") return DEFAULT_FOV;
      const raw = localStorage.getItem(FOV_STORAGE_KEY);
      if (!raw) return DEFAULT_FOV;
      const v = Number(raw);
      return Number.isFinite(v) ? Math.max(60, Math.min(140, v)) : DEFAULT_FOV;
    } catch {
      return DEFAULT_FOV;
    }
  },

  writeFov(fov: number): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(FOV_STORAGE_KEY, String(fov));
  },

  readCameraTilt(): number {
    try {
      if (typeof localStorage === "undefined") return DEFAULT_CAMERA_TILT;
      const raw = localStorage.getItem(CAMERA_TILT_STORAGE_KEY);
      if (!raw) return DEFAULT_CAMERA_TILT;
      const v = Number(raw);
      return Number.isFinite(v) ? Math.max(0, Math.min(45, v)) : DEFAULT_CAMERA_TILT;
    } catch {
      return DEFAULT_CAMERA_TILT;
    }
  },

  writeCameraTilt(tilt: number): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(CAMERA_TILT_STORAGE_KEY, String(tilt));
  },
};
