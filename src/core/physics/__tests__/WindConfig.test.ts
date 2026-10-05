import { describe, expect, it } from "vitest";
import { meanWindInto, resolveWindConfig } from "../WindConfig";

describe("wind configuration", () => {
  it("migrates legacy flags and retains valid explicit overrides", () => {
    expect(resolveWindConfig({ gentleWind: false })).toMatchObject({ windSpeed: 0, windGustStrength: 0 });
    expect(resolveWindConfig({})).toMatchObject({ windSpeed: 1.5, windGustStrength: 0.35 });
    expect(resolveWindConfig({ gentleWind: false, windSpeed: 4 }).windSpeed).toBe(4);
  });
  it("bounds finite input and defaults invalid values", () => {
    expect(resolveWindConfig({ windSpeed: 99, windDirection: 360, windGustStrength: -1 }))
      .toMatchObject({ windSpeed: 8, windDirection: 0, windGustStrength: 0 });
    expect(resolveWindConfig({ windSpeed: NaN, windDirection: -90, windGustStrength: Infinity }))
      .toMatchObject({ windSpeed: 1.5, windDirection: 270, windGustStrength: 0.35 });
  });
  it("converts meteorological from direction to ENU travel velocity without allocating", () => {
    const out = { x: 9, y: 9, z: 9 };
    expect(meanWindInto({ windSpeed: 4, windDirection: 0, windGustStrength: 0 }, out)).toBe(out);
    expect(out.x).toBeCloseTo(0); expect(out.y).toBeCloseTo(-4); expect(out.z).toBe(0);
    meanWindInto({ windSpeed: 4, windDirection: 90, windGustStrength: 0 }, out);
    expect(out.x).toBeCloseTo(-4); expect(out.y).toBeCloseTo(0);
  });
});
