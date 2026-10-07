// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { create } from "zustand";
import { createSettingsSlice, type SettingsSlice } from "../settingsSlice";
import { SettingsPersistence } from "../SettingsPersistence";

describe("environment settings", () => {
  it('persists pedestrian preference and survives denied storage', () => {
    const store=create<SettingsSlice>()(createSettingsSlice);
    expect(store.getState().pedestriansEnabled).toBe(true);
    store.getState().setPedestriansEnabled(false);
    expect(SettingsPersistence.readPedestriansEnabled()).toBe(false);
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked');});
    vi.spyOn(console,'warn').mockImplementation(()=>{});
    store.getState().setPedestriansEnabled(true);
    expect(store.getState().pedestriansEnabled).toBe(true);
  });
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
  it("remembers both minimap states after recreating the store", () => {
    const store = create<SettingsSlice>()(createSettingsSlice);
    expect(store.getState().minimapCollapsed).toBe(false);
    store.getState().setMinimapCollapsed(true);
    const reloaded = create<SettingsSlice>()(createSettingsSlice);
    expect(reloaded.getState().minimapCollapsed).toBe(true);
    reloaded.getState().setMinimapCollapsed(false);
    expect(create<SettingsSlice>()(createSettingsSlice).getState().minimapCollapsed).toBe(false);
  });
  it("defaults the minimap open on invalid or denied storage and still toggles in memory", () => {
    localStorage.setItem("fpvsim_minimap_collapsed", "invalid");
    expect(create<SettingsSlice>()(createSettingsSlice).getState().minimapCollapsed).toBe(false);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    const store = create<SettingsSlice>()(createSettingsSlice);
    expect(store.getState().minimapCollapsed).toBe(false);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    store.getState().setMinimapCollapsed(true);
    expect(store.getState().minimapCollapsed).toBe(true);
    expect(warning).toHaveBeenCalledOnce();
  });
  it("defaults road traffic on and keeps session state when saving is blocked", () => {
    const store = create<SettingsSlice>()(createSettingsSlice);
    expect(store.getState().roadTrafficEnabled).toBe(true);
    store.getState().setRoadTrafficEnabled(false);
    expect(SettingsPersistence.readRoadTrafficEnabled()).toBe(false);
    vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new Error('blocked');});
    vi.spyOn(console,"warn").mockImplementation(()=>{});
    store.getState().setRoadTrafficEnabled(true);
    expect(store.getState().roadTrafficEnabled).toBe(true);
  });
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
