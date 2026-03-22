import { create } from "zustand";
import type { SessionSlice } from "./sessionSlice";
import { createSessionSlice } from "./sessionSlice";
import type { DroneSlice } from "./droneSlice";
import { createDroneSlice } from "./droneSlice";
import type { SettingsSlice } from "./settingsSlice";
import { createSettingsSlice } from "./settingsSlice";

export type AppStore = SessionSlice & DroneSlice & SettingsSlice;

export const useStore = create<AppStore>()((...a) => ({
  ...createSessionSlice(...a),
  ...createDroneSlice(...a),
  ...createSettingsSlice(...a),
}));
