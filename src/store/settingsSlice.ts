import type { StateCreator } from "zustand";
import type { PhysicsConfig, RatesConfig } from "../core/physics/types";
import { DEFAULT_DRONE_CONFIG, DEFAULT_RATES } from "../core/physics/types";
import type { AxisMapping } from "../core/input/AxisMapper";
import { FlightMode } from "../core/flight-controller/FlightModes";

export interface SavedLocation {
  lat: number;
  lng: number;
  name: string;
}

const DEFAULT_LOCATION_STORAGE_KEY = "fpvsim_default_location";

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

function readPersistedDefaultLocation(): SavedLocation | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(DEFAULT_LOCATION_STORAGE_KEY);
    if (!raw) return null;
    return parseSavedLocation(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writePersistedDefaultLocation(location: SavedLocation): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(DEFAULT_LOCATION_STORAGE_KEY, JSON.stringify(location));
}

export interface SettingsSlice {
  axisMapping: AxisMapping | null;
  rates: RatesConfig;
  physicsConfig: PhysicsConfig;
  flightMode: FlightMode;
  fov: number;
  cameraTilt: number;
  defaultLocation: SavedLocation | null;
  pickerInitialLocation: SavedLocation | null;
  setAxisMapping: (mapping: AxisMapping) => void;
  setRates: (rates: Partial<RatesConfig>) => void;
  setPhysicsConfig: (config: Partial<PhysicsConfig>) => void;
  setFlightMode: (mode: FlightMode) => void;
  setFov: (fov: number) => void;
  setCameraTilt: (tilt: number) => void;
  setDefaultLocation: (location: SavedLocation) => void;
  setPickerInitialLocation: (location: SavedLocation | null) => void;
  clearPickerInitialLocation: () => void;
}

export const createSettingsSlice: StateCreator<SettingsSlice> = (set) => ({
  axisMapping: null,
  rates: DEFAULT_RATES,
  physicsConfig: DEFAULT_DRONE_CONFIG,
  flightMode: FlightMode.ACRO,
  fov: 90,
  cameraTilt: 15,
  defaultLocation: readPersistedDefaultLocation(),
  pickerInitialLocation: null,
  setAxisMapping: (mapping) => set({ axisMapping: mapping }),
  setRates: (rates) =>
    set((state) => ({ rates: { ...state.rates, ...rates } })),
  setPhysicsConfig: (config) =>
    set((state) => ({ physicsConfig: { ...state.physicsConfig, ...config } })),
  setFlightMode: (mode) => set({ flightMode: mode }),
  setFov: (fov) => set({ fov: Math.max(60, Math.min(140, fov)) }),
  setCameraTilt: (tilt) => set({ cameraTilt: Math.max(0, Math.min(45, tilt)) }),
  setDefaultLocation: (location) => {
    if (!isFiniteLatLng(location.lat, location.lng)) return;
    writePersistedDefaultLocation(location);
    set({ defaultLocation: location });
  },
  setPickerInitialLocation: (location) => set({ pickerInitialLocation: location }),
  clearPickerInitialLocation: () => set({ pickerInitialLocation: null }),
});
