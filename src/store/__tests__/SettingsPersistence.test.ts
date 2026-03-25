// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import { SettingsPersistence, mergeNumericPartial } from "../SettingsPersistence";
import { DEFAULT_DRONE_CONFIG, DEFAULT_RATES } from "../../core/physics/droneConfig";

describe("mergeNumericPartial", () => {
  it("returns defaults when persisted is null/undefined", () => {
    expect(mergeNumericPartial(null, { a: 1, b: 2 })).toEqual({ a: 1, b: 2 });
    expect(mergeNumericPartial(undefined, { a: 1 })).toEqual({ a: 1 });
  });

  it("merges valid numeric fields", () => {
    const result = mergeNumericPartial({ mass: 0.8 }, { mass: 0.55, armLength: 0.11 });
    expect(result).toEqual({ mass: 0.8, armLength: 0.11 });
  });

  it("ignores NaN and Infinity", () => {
    const result = mergeNumericPartial({ mass: NaN, armLength: Infinity }, { mass: 0.55, armLength: 0.11 });
    expect(result).toEqual({ mass: 0.55, armLength: 0.11 });
  });

  it("ignores non-numeric fields", () => {
    const result = mergeNumericPartial({ mass: "not a number" }, { mass: 0.55 });
    expect(result).toEqual({ mass: 0.55 });
  });

  it("merges boolean fields", () => {
    const result = mergeNumericPartial({ thrustLinearization: false }, { thrustLinearization: true });
    expect(result).toEqual({ thrustLinearization: false });
  });

  it("recursively merges nested objects", () => {
    const defaults = { inertia: { xx: 0.003, yy: 0.003, zz: 0.005 } };
    const persisted = { inertia: { xx: 0.005 } };
    const result = mergeNumericPartial(persisted, defaults);
    expect(result).toEqual({ inertia: { xx: 0.005, yy: 0.003, zz: 0.005 } });
  });

  it("ignores extra keys not in defaults", () => {
    const result = mergeNumericPartial({ mass: 0.8, extraField: 99 }, { mass: 0.55 });
    expect(result).toEqual({ mass: 0.8 }); // mass merged, extraField ignored
    expect((result as Record<string, unknown>).extraField).toBeUndefined();
  });
});

describe("SettingsPersistence.readPhysicsConfig", () => {
  it("returns DEFAULT_DRONE_CONFIG when localStorage is empty", () => {
    localStorage.clear();
    expect(SettingsPersistence.readPhysicsConfig()).toEqual(DEFAULT_DRONE_CONFIG);
  });

  it("merges persisted values with defaults", () => {
    localStorage.setItem("fpvsim_physics_config", JSON.stringify({ mass: 0.9 }));
    const config = SettingsPersistence.readPhysicsConfig();
    expect(config.mass).toBe(0.9);
    expect(config.armLength).toBe(DEFAULT_DRONE_CONFIG.armLength);
  });

  it("survives corrupted JSON", () => {
    localStorage.setItem("fpvsim_physics_config", "not-json{{{");
    expect(SettingsPersistence.readPhysicsConfig()).toEqual(DEFAULT_DRONE_CONFIG);
  });
});

describe("SettingsPersistence.readRates / writeRates roundtrip", () => {
  it("roundtrips rates correctly", () => {
    localStorage.clear();
    const customRates = { rollRate: 600, pitchRate: 700, yawRate: 500, expo: 0.4 };
    SettingsPersistence.writeRates(customRates);
    expect(SettingsPersistence.readRates()).toEqual(customRates);
  });

  it("returns DEFAULT_RATES when empty", () => {
    localStorage.clear();
    expect(SettingsPersistence.readRates()).toEqual(DEFAULT_RATES);
  });
});

describe("SettingsPersistence.readFov / writeFov", () => {
  it("roundtrips FOV correctly", () => {
    localStorage.clear();
    SettingsPersistence.writeFov(120);
    expect(SettingsPersistence.readFov()).toBe(120);
  });

  it("clamps to valid range", () => {
    localStorage.setItem("fpvsim_fov", "200");
    expect(SettingsPersistence.readFov()).toBe(140);
    localStorage.setItem("fpvsim_fov", "10");
    expect(SettingsPersistence.readFov()).toBe(60);
  });

  it("returns 90 for invalid values", () => {
    localStorage.setItem("fpvsim_fov", "notanumber");
    expect(SettingsPersistence.readFov()).toBe(90);
  });
});

describe("SettingsPersistence.readCameraTilt / writeCameraTilt", () => {
  it("roundtrips tilt correctly", () => {
    localStorage.clear();
    SettingsPersistence.writeCameraTilt(25);
    expect(SettingsPersistence.readCameraTilt()).toBe(25);
  });

  it("clamps to valid range [0, 45]", () => {
    localStorage.setItem("fpvsim_camera_tilt", "99");
    expect(SettingsPersistence.readCameraTilt()).toBe(45);
    localStorage.setItem("fpvsim_camera_tilt", "-5");
    expect(SettingsPersistence.readCameraTilt()).toBe(0);
  });
});

describe("SettingsPersistence.readDefaultLocation / writeDefaultLocation", () => {
  it("roundtrips a valid location", () => {
    localStorage.clear();
    const loc = { lat: 48.8566, lng: 2.3522, name: "Paris" };
    SettingsPersistence.writeDefaultLocation(loc);
    expect(SettingsPersistence.readDefaultLocation()).toEqual(loc);
  });

  it("returns null for empty storage", () => {
    localStorage.clear();
    expect(SettingsPersistence.readDefaultLocation()).toBeNull();
  });

  it("returns null for invalid location data", () => {
    localStorage.setItem("fpvsim_default_location", JSON.stringify({ lat: "bad", lng: 2.35, name: "X" }));
    expect(SettingsPersistence.readDefaultLocation()).toBeNull();
  });

  it("rejects out-of-range coordinates", () => {
    localStorage.setItem("fpvsim_default_location", JSON.stringify({ lat: 999, lng: 2.35, name: "X" }));
    expect(SettingsPersistence.readDefaultLocation()).toBeNull();
  });
});

describe("SettingsPersistence.isFiniteLatLng", () => {
  it("validates correct coordinates", () => {
    expect(SettingsPersistence.isFiniteLatLng(48.85, 2.35)).toBe(true);
    expect(SettingsPersistence.isFiniteLatLng(-90, -180)).toBe(true);
    expect(SettingsPersistence.isFiniteLatLng(90, 180)).toBe(true);
  });

  it("rejects out-of-range", () => {
    expect(SettingsPersistence.isFiniteLatLng(91, 0)).toBe(false);
    expect(SettingsPersistence.isFiniteLatLng(0, 181)).toBe(false);
  });

  it("rejects NaN and Infinity", () => {
    expect(SettingsPersistence.isFiniteLatLng(NaN, 0)).toBe(false);
    expect(SettingsPersistence.isFiniteLatLng(0, Infinity)).toBe(false);
  });
});
