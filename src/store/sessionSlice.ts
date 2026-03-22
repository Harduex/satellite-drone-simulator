import type { StateCreator } from "zustand";

export type SimPhase = "PICKER" | "FLYING" | "PAUSED";

export interface SessionSlice {
  phase: SimPhase;
  location: { lat: number; lng: number; name: string } | null;
  setPhase: (phase: SimPhase) => void;
  setLocation: (location: { lat: number; lng: number; name: string }) => void;
  resetSession: () => void;
}

export const createSessionSlice: StateCreator<SessionSlice> = (set) => ({
  phase: "PICKER",
  location: null,
  setPhase: (phase) => set({ phase }),
  setLocation: (location) => set({ location }),
  resetSession: () => set({ phase: "PICKER", location: null }),
});
