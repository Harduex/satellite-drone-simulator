import type { StateCreator } from "zustand";

export interface DroneTelemetry {
  positionX: number;
  positionY: number;
  positionZ: number;
  speed: number; // m/s
  altitudeAGL: number; // m
  throttle: number; // 0-1
}

export interface DroneSlice extends DroneTelemetry {
  crashFlashActive: boolean;
  updateTelemetry: (telemetry: Partial<DroneTelemetry>) => void;
  resetTelemetry: () => void;
  triggerCrashFlash: () => void;
}

const INITIAL_TELEMETRY: DroneTelemetry = {
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  speed: 0,
  altitudeAGL: 0,
  throttle: 0,
};

export const createDroneSlice: StateCreator<DroneSlice> = (set) => ({
  ...INITIAL_TELEMETRY,
  crashFlashActive: false,
  updateTelemetry: (telemetry) => set(telemetry),
  resetTelemetry: () => set({ ...INITIAL_TELEMETRY, crashFlashActive: false }),
  triggerCrashFlash: () => {
    set({ crashFlashActive: true });
    setTimeout(() => set({ crashFlashActive: false }), 200);
  },
});
