import type { StateCreator } from "zustand";
import type { PhysicsConfig, RatesConfig } from "../core/physics/types";
import type { AxisMapping } from "../core/input/AxisMapper";
import { FlightMode } from "../core/flight-controller/FlightModes";
import { SettingsPersistence } from "./SettingsPersistence";

export interface SavedLocation {
  lat: number;
  lng: number;
  name: string;
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
  rates: SettingsPersistence.readRates(),
  physicsConfig: SettingsPersistence.readPhysicsConfig(),
  flightMode: FlightMode.ACRO,
  fov: SettingsPersistence.readFov(),
  cameraTilt: SettingsPersistence.readCameraTilt(),
  defaultLocation: SettingsPersistence.readDefaultLocation(),
  pickerInitialLocation: null,
  setAxisMapping: (mapping) => set({ axisMapping: mapping }),
  setRates: (rates) =>
    set((state) => {
      const next = { ...state.rates, ...rates };
      SettingsPersistence.writeRates(next);
      return { rates: next };
    }),
  setPhysicsConfig: (config) =>
    set((state) => {
      const next = { ...state.physicsConfig, ...config };
      SettingsPersistence.writePhysicsConfig(next);
      return { physicsConfig: next };
    }),
  setFlightMode: (mode) => set({ flightMode: mode }),
  setFov: (fov) => {
    const clamped = Math.max(60, Math.min(140, fov));
    SettingsPersistence.writeFov(clamped);
    set({ fov: clamped });
  },
  setCameraTilt: (tilt) => {
    const clamped = Math.max(0, Math.min(45, tilt));
    SettingsPersistence.writeCameraTilt(clamped);
    set({ cameraTilt: clamped });
  },
  setDefaultLocation: (location) => {
    if (!SettingsPersistence.isFiniteLatLng(location.lat, location.lng)) return;
    SettingsPersistence.writeDefaultLocation(location);
    set({ defaultLocation: location });
  },
  setPickerInitialLocation: (location) => set({ pickerInitialLocation: location }),
  clearPickerInitialLocation: () => set({ pickerInitialLocation: null }),
});
