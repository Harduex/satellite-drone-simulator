import { create } from "zustand";
import type { SessionSlice } from "./sessionSlice";
import { createSessionSlice } from "./sessionSlice";
import type { DroneSlice } from "./droneSlice";
import { createDroneSlice } from "./droneSlice";
import type { SettingsSlice } from "./settingsSlice";
import { createSettingsSlice } from "./settingsSlice";
import type { DiagnosticsSlice } from "./diagnosticsSlice";
import { createDiagnosticsSlice } from "./diagnosticsSlice";
import { createRecordingSlice, type RecordingSlice } from './recordingSlice';
export { DEFAULT_FOV, DEFAULT_CAMERA_TILT } from "./SettingsPersistence";

export type AppStore = SessionSlice & DroneSlice & SettingsSlice & DiagnosticsSlice & RecordingSlice;

export const useStore = create<AppStore>()((...a) => ({
  ...createSessionSlice(...a),
  ...createDroneSlice(...a),
  ...createSettingsSlice(...a),
  ...createDiagnosticsSlice(...a),
  ...createRecordingSlice(...a),
}));
