import { describe, it, expect } from "vitest";
import { matchPreset, RADIO_PRESETS } from "../RadioPresets";

describe("RADIO_PRESETS", () => {
  it("contains expected preset names", () => {
    expect(Object.keys(RADIO_PRESETS)).toEqual(
      expect.arrayContaining(["RadioMaster", "Jumper", "TBS Tango", "BETAFPV", "Generic"]),
    );
  });

  it("every preset has all 4 channels", () => {
    for (const [name, mapping] of Object.entries(RADIO_PRESETS)) {
      expect(mapping.throttle, `${name} missing throttle`).toBeDefined();
      expect(mapping.yaw, `${name} missing yaw`).toBeDefined();
      expect(mapping.pitch, `${name} missing pitch`).toBeDefined();
      expect(mapping.roll, `${name} missing roll`).toBeDefined();
    }
  });

  it("no preset has duplicate axis assignments", () => {
    for (const [name, mapping] of Object.entries(RADIO_PRESETS)) {
      const axes = [
        mapping.throttle.axis,
        mapping.yaw.axis,
        mapping.pitch.axis,
        mapping.roll.axis,
      ];
      const unique = new Set(axes);
      expect(unique.size, `${name} has duplicate axes: ${axes}`).toBe(4);
    }
  });
});

describe("matchPreset", () => {
  it("matches RadioMaster (case insensitive)", () => {
    expect(matchPreset("RadioMaster TX16S")).toBe("RadioMaster");
    expect(matchPreset("RADIOMASTER Boxer")).toBe("RadioMaster");
  });

  it("matches Jumper", () => {
    expect(matchPreset("Jumper T-Pro v2")).toBe("Jumper");
  });

  it("matches TBS Tango by 'tbs'", () => {
    expect(matchPreset("TBS Tango 2 Pro")).toBe("TBS Tango");
  });

  it("matches TBS Tango by 'tango' alone", () => {
    expect(matchPreset("FrSky Tango II")).toBe("TBS Tango");
  });

  it("matches BETAFPV by name", () => {
    expect(matchPreset("BETAFPV LiteRadio 3")).toBe("BETAFPV");
  });

  it("matches BETAFPV by 'literadio'", () => {
    expect(matchPreset("My LiteRadio 2 SE")).toBe("BETAFPV");
  });

  it("matches BETAFPV by 'lite radio' (with space)", () => {
    expect(matchPreset("Lite Radio 2")).toBe("BETAFPV");
  });

  it("falls back to Generic for unknown controllers", () => {
    expect(matchPreset("Xbox Wireless Controller")).toBe("Generic");
    expect(matchPreset("DualSense Wireless Controller")).toBe("Generic");
    expect(matchPreset("")).toBe("Generic");
  });
});
