import type { StateCreator } from "zustand";

export interface DroneTelemetry {
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
  speed: 0,
  altitudeAGL: 0,
  throttle: 0,
};

let crashFlashTimeoutId: ReturnType<typeof setTimeout> | null = null;

export const createDroneSlice: StateCreator<DroneSlice> = (set) => ({
  ...INITIAL_TELEMETRY,
  crashFlashActive: false,
  updateTelemetry: (telemetry) => set(telemetry),
  resetTelemetry: () => set({ ...INITIAL_TELEMETRY, crashFlashActive: false }),
  triggerCrashFlash: () => {
    if (crashFlashTimeoutId !== null) clearTimeout(crashFlashTimeoutId);
    set({ crashFlashActive: true });
    crashFlashTimeoutId = setTimeout(() => {
      set({ crashFlashActive: false });
      crashFlashTimeoutId = null;
    }, 200);
  },
});
