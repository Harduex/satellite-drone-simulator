import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { create } from "zustand";
import { createDroneSlice } from "../droneSlice";
import type { DroneSlice } from "../droneSlice";

function createTestStore() {
  return create<DroneSlice>()((...a) => ({
    ...createDroneSlice(...a),
  }));
}

describe("droneSlice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initial state", () => {
    it("starts with zeroed telemetry", () => {
      const store = createTestStore();
      const state = store.getState();
      expect(state.speed).toBe(0);
      expect(state.altitudeAGL).toBe(0);
      expect(state.throttle).toBe(0);
      expect(state.crashFlashActive).toBe(false);
    });
  });

  describe("updateTelemetry", () => {
    it("updates partial telemetry", () => {
      const store = createTestStore();
      store.getState().updateTelemetry({ speed: 15.5 });
      expect(store.getState().speed).toBe(15.5);
      expect(store.getState().altitudeAGL).toBe(0);
    });

    it("updates multiple fields", () => {
      const store = createTestStore();
      store.getState().updateTelemetry({ speed: 10, altitudeAGL: 50, throttle: 0.7 });
      expect(store.getState().speed).toBe(10);
      expect(store.getState().altitudeAGL).toBe(50);
      expect(store.getState().throttle).toBe(0.7);
    });
  });

  describe("resetTelemetry", () => {
    it("resets all telemetry to zero", () => {
      const store = createTestStore();
      store.getState().updateTelemetry({ speed: 10, altitudeAGL: 50, throttle: 0.7 });
      store.getState().resetTelemetry();
      expect(store.getState().speed).toBe(0);
      expect(store.getState().altitudeAGL).toBe(0);
      expect(store.getState().throttle).toBe(0);
    });

    it("clears crashFlashActive", () => {
      const store = createTestStore();
      store.getState().triggerCrashFlash();
      store.getState().resetTelemetry();
      expect(store.getState().crashFlashActive).toBe(false);
    });
  });

  describe("triggerCrashFlash", () => {
    it("sets crashFlashActive to true", () => {
      const store = createTestStore();
      store.getState().triggerCrashFlash();
      expect(store.getState().crashFlashActive).toBe(true);
    });

    it("auto-clears after 200ms", () => {
      const store = createTestStore();
      store.getState().triggerCrashFlash();
      expect(store.getState().crashFlashActive).toBe(true);

      vi.advanceTimersByTime(199);
      expect(store.getState().crashFlashActive).toBe(true);

      vi.advanceTimersByTime(1);
      expect(store.getState().crashFlashActive).toBe(false);
    });

    it("rapid double-trigger resets the timer (no stale clear)", () => {
      const store = createTestStore();
      store.getState().triggerCrashFlash();
      vi.advanceTimersByTime(100);
      expect(store.getState().crashFlashActive).toBe(true);

      // Second trigger while first is still active
      store.getState().triggerCrashFlash();

      // At t=200 from first trigger (t=100 from second) — should still be active
      vi.advanceTimersByTime(100);
      expect(store.getState().crashFlashActive).toBe(true);

      // At t=200 from second trigger — now it should clear
      vi.advanceTimersByTime(100);
      expect(store.getState().crashFlashActive).toBe(false);
    });

    it("triple-trigger keeps flash active until 200ms after last", () => {
      const store = createTestStore();
      store.getState().triggerCrashFlash();
      vi.advanceTimersByTime(50);
      store.getState().triggerCrashFlash();
      vi.advanceTimersByTime(50);
      store.getState().triggerCrashFlash();

      // 199ms after last trigger
      vi.advanceTimersByTime(199);
      expect(store.getState().crashFlashActive).toBe(true);

      vi.advanceTimersByTime(1);
      expect(store.getState().crashFlashActive).toBe(false);
    });
  });
});
