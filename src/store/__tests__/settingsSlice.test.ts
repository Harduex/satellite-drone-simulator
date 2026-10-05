// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { create } from "zustand";
import { createSettingsSlice, type SettingsSlice } from "../settingsSlice";
import { SettingsPersistence } from "../SettingsPersistence";

describe("environment settings", () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
  it("migrates saved calm before default merging", () => {
    localStorage.setItem("fpvsim_physics_config", JSON.stringify({ gentleWind: false }));
    expect(SettingsPersistence.readPhysicsConfig().windSpeed).toBe(0);
  });
  it("persists time mode and preserves direction on preset selection", () => {
    const store = create<SettingsSlice>()(createSettingsSlice);
    expect(store.getState().realTimeOfDay).toBe(false);
    store.getState().setRealTimeOfDay(true);
    expect(SettingsPersistence.readRealTimeOfDay()).toBe(true);
    store.getState().setPhysicsConfig({ windDirection: 90 });
    store.getState().setWindPreset("breezy");
    expect(store.getState().physicsConfig).toMatchObject({ windSpeed: 4, windGustStrength: 1, windDirection: 90 });
  });
  it("updates memory when storage is unavailable", () => {
    const store = create<SettingsSlice>()(createSettingsSlice);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    store.getState().setRealTimeOfDay(true);
    store.getState().setPhysicsConfig({ windSpeed: 4 });
    expect(store.getState().realTimeOfDay).toBe(true);
    expect(store.getState().physicsConfig.windSpeed).toBe(4);
  });
});
