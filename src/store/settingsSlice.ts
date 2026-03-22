import type { StateCreator } from "zustand";
import type { PhysicsConfig, RatesConfig } from "../core/physics/types";
import { DEFAULT_DRONE_CONFIG, DEFAULT_RATES } from "../core/physics/types";
import type { AxisMapping } from "../core/input/AxisMapper";
import { FlightMode } from "../core/flight-controller/FlightModes";

export interface SettingsSlice {
  axisMapping: AxisMapping | null;
  rates: RatesConfig;
  physicsConfig: PhysicsConfig;
  flightMode: FlightMode;
  fov: number;
  cameraTilt: number;
  setAxisMapping: (mapping: AxisMapping) => void;
  setRates: (rates: Partial<RatesConfig>) => void;
  setPhysicsConfig: (config: Partial<PhysicsConfig>) => void;
  setFlightMode: (mode: FlightMode) => void;
  setFov: (fov: number) => void;
  setCameraTilt: (tilt: number) => void;
}

export const createSettingsSlice: StateCreator<SettingsSlice> = (set) => ({
  axisMapping: null,
  rates: DEFAULT_RATES,
  physicsConfig: DEFAULT_DRONE_CONFIG,
  flightMode: FlightMode.ACRO,
  fov: 90,
  cameraTilt: 15,
  setAxisMapping: (mapping) => set({ axisMapping: mapping }),
  setRates: (rates) =>
    set((state) => ({ rates: { ...state.rates, ...rates } })),
  setPhysicsConfig: (config) =>
    set((state) => ({ physicsConfig: { ...state.physicsConfig, ...config } })),
  setFlightMode: (mode) => set({ flightMode: mode }),
  setFov: (fov) => set({ fov: Math.max(60, Math.min(140, fov)) }),
  setCameraTilt: (tilt) => set({ cameraTilt: Math.max(0, Math.min(45, tilt)) }),
});
