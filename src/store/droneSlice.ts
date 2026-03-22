import type { StateCreator } from "zustand";

export interface DroneTelemetry {
  positionX: number;
  positionY: number;
  positionZ: number;
  speed: number; // m/s
  altitudeAGL: number; // m
  batteryPercent: number;
  batteryVoltage: number;
  throttle: number; // 0-1
}

export interface DroneSlice extends DroneTelemetry {
  updateTelemetry: (telemetry: Partial<DroneTelemetry>) => void;
  resetTelemetry: () => void;
}

const INITIAL_TELEMETRY: DroneTelemetry = {
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  speed: 0,
  altitudeAGL: 0,
  batteryPercent: 100,
  batteryVoltage: 16.8,
  throttle: 0,
};

export const createDroneSlice: StateCreator<DroneSlice> = (set) => ({
  ...INITIAL_TELEMETRY,
  updateTelemetry: (telemetry) => set(telemetry),
  resetTelemetry: () => set(INITIAL_TELEMETRY),
});
