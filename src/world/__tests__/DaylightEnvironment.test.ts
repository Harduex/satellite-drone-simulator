import { describe, expect, it } from "vitest";
import * as Cesium from "cesium";
import { createDaylightState, selectPleasantDay, updateDaylightInto } from "../DaylightEnvironment";

function stateAt(iso: string, lon = 0, lat = 0) {
  return updateDaylightInto(Cesium.JulianDate.fromIso8601(iso), lon, lat, createDaylightState());
}

describe("location daylight", () => {
  it("places equinox Sun near zenith at noon and below horizon at midnight", () => {
    expect(stateAt("2024-03-20T12:07:00Z").sunElevation * 180 / Math.PI).toBeGreaterThan(89);
    expect(stateAt("2024-03-20T00:07:00Z").sunElevation * 180 / Math.PI).toBeLessThan(-89);
  });
  it("selects corrected noon with location solar dates across UTC rollover", () => {
    const now = new Date("2024-03-20T23:30:00Z");
    const east = selectPleasantDay(now, 180, 0);
    const west = selectPleasantDay(now, -180, 0);
    expect(east.toISOString().slice(0, 10)).toBe("2024-03-21");
    expect(west.toISOString().slice(0, 10)).toBe("2024-03-21");
    expect(Math.abs(east.getTime() - Date.parse("2024-03-21T00:07:00Z"))).toBeLessThan(5 * 60000);
    expect(Math.abs(west.getTime() - Date.parse("2024-03-21T00:07:00Z"))).toBeLessThan(5 * 60000);
  });
  it.each([[90, "2024-12-21"], [-90, "2024-06-21"]])("offers pleasant polar daylight at latitude %s", (lat, date) => {
    const time = selectPleasantDay(new Date(`${date}T12:00:00Z`), 0, Number(lat));
    const state = updateDaylightInto(Cesium.JulianDate.fromDate(time), 0, Number(lat), createDaylightState());
    expect(state.sunElevation * 180 / Math.PI).toBeGreaterThanOrEqual(15);
  });
  it("weights moonlight by actual phase and horizon", () => {
    const full = stateAt("2024-03-25T00:00:00Z");
    const eclipse = stateAt("2024-04-08T18:00:00Z");
    expect(full.moonIllumination).toBeGreaterThan(0.99);
    expect(eclipse.moonIllumination).toBeLessThan(0.01);
    expect(full.moonLightIntensity).toBeGreaterThan(eclipse.moonLightIntensity);
    if (eclipse.moonElevation < 0) expect(eclipse.moonLightIntensity).toBe(0);
  });
  it("reuses output and produces finite unit directions through clock jumps", () => {
    const out = createDaylightState();
    for (const date of ["2024-06-01T00:00:00Z", "2030-01-01T12:00:00Z"]) {
      expect(updateDaylightInto(Cesium.JulianDate.fromIso8601(date), 120, 50, out)).toBe(out);
      expect(Cesium.Cartesian3.magnitude(out.sunDirection)).toBeCloseTo(1);
      expect(Cesium.Cartesian3.magnitude(out.moonDirection)).toBeCloseTo(1);
      expect(Number.isFinite(out.exposure)).toBe(true);
    }
  });
});
