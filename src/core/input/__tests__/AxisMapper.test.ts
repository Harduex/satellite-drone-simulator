import { describe, expect, it } from "vitest";
import { AxisMapper, DEFAULT_DEADZONE } from "../AxisMapper";
import type { AxisMapping } from "../AxisMapper";

/** Standard Mode 2 AETR mapping for tests */
const MODE2: AxisMapping = {
  throttle: { axis: 1, inverted: true },
  roll: { axis: 2, inverted: false },
  pitch: { axis: 3, inverted: true },
  yaw: { axis: 0, inverted: false },
};

function makeAxes(...values: number[]): ArrayLike<number> {
  return Float64Array.from(values);
}

describe("AxisMapper", () => {
  describe("shared buffer pattern", () => {
    it("returns same reference on every call", () => {
      const mapper = new AxisMapper(MODE2);
      const result1 = mapper.map(makeAxes(0, 0, 0, 0));
      const result2 = mapper.map(makeAxes(0.5, 0.5, 0.5, 0.5));
      expect(result1).toBe(result2); // same object reference
    });

    it("previous result is overwritten by subsequent call", () => {
      const mapper = new AxisMapper(MODE2);
      const result = mapper.map(makeAxes(0, -1, 0, 0));
      const firstThrottle = result.throttle;
      expect(firstThrottle).toBeCloseTo(1, 1); // inverted -1 → +1 → throttle ~1

      mapper.map(makeAxes(0, 0, 0, 0));
      // result reference now has new values
      expect(result.throttle).toBeCloseTo(0.5, 1); // centered → 0.5 throttle
    });
  });

  describe("deadzone", () => {
    it("values inside deadzone map to 0", () => {
      const mapper = new AxisMapper(MODE2);
      const small = DEFAULT_DEADZONE * 0.5; // half of deadzone
      const result = mapper.map(makeAxes(small, 0, small, small));
      expect(result.yaw).toBe(0);
      expect(result.roll).toBe(0);
      expect(result.pitch).toBe(0);
    });

    it("values just outside deadzone produce non-zero output", () => {
      const mapper = new AxisMapper(MODE2);
      const val = DEFAULT_DEADZONE + 0.1;
      const result = mapper.map(makeAxes(val, 0, val, 0));
      expect(result.yaw).toBeGreaterThan(0);
    });

    it("custom deadzone is respected", () => {
      const mapping: AxisMapping = {
        throttle: { axis: 1, inverted: true, deadzone: 0.3 },
        roll: { axis: 2, inverted: false, deadzone: 0.3 },
        pitch: { axis: 3, inverted: true, deadzone: 0.3 },
        yaw: { axis: 0, inverted: false, deadzone: 0.3 },
      };
      const mapper = new AxisMapper(mapping);
      const result = mapper.map(makeAxes(0.2, 0, 0.2, 0));
      expect(result.yaw).toBe(0); // 0.2 < 0.3 deadzone
    });
  });

  describe("inversion", () => {
    it("non-inverted axis passes through sign", () => {
      const mapper = new AxisMapper(MODE2);
      // Yaw: axis 0, not inverted
      const result = mapper.map(makeAxes(0.5, 0, 0, 0));
      expect(result.yaw).toBeGreaterThan(0);
    });

    it("inverted axis flips sign", () => {
      const mapper = new AxisMapper(MODE2);
      // Pitch: axis 3, inverted — positive raw → negative stick
      const result = mapper.map(makeAxes(0, 0, 0, 0.5));
      expect(result.pitch).toBeLessThan(0);
    });

    it("throttle inversion: raw -1 → throttle 1.0", () => {
      const mapper = new AxisMapper(MODE2);
      // Throttle: axis 1, inverted; raw=-1 → inverted=+1 → normalized=(1+1)/2=1
      const result = mapper.map(makeAxes(0, -1, 0, 0));
      expect(result.throttle).toBeCloseTo(1, 1);
    });

    it("throttle inversion: raw +1 → throttle 0.0", () => {
      const mapper = new AxisMapper(MODE2);
      // Throttle: axis 1, inverted; raw=+1 → inverted=-1 → normalized=(-1+1)/2=0
      const result = mapper.map(makeAxes(0, 1, 0, 0));
      expect(result.throttle).toBeCloseTo(0, 1);
    });
  });

  describe("centerOffset", () => {
    it("applies center offset before inversion", () => {
      const mapping: AxisMapping = {
        throttle: { axis: 1, inverted: false, centerOffset: 0.1 },
        roll: { axis: 2, inverted: false },
        pitch: { axis: 3, inverted: false },
        yaw: { axis: 0, inverted: false },
      };
      const mapper = new AxisMapper(mapping);
      // Raw = 0.1, offset = 0.1 → effective = 0 → throttle = 0.5
      const result = mapper.map(makeAxes(0, 0.1, 0, 0));
      expect(result.throttle).toBeCloseTo(0.5, 1);
    });
  });

  describe("ArrayLike support", () => {
    it("accepts regular array", () => {
      const mapper = new AxisMapper(MODE2);
      const result = mapper.map([0, 0, 0.5, 0]);
      expect(result.roll).toBeGreaterThan(0);
    });

    it("accepts Float64Array (gamepad axes)", () => {
      const mapper = new AxisMapper(MODE2);
      const axes = new Float64Array([0, 0, 0.5, 0]);
      const result = mapper.map(axes);
      expect(result.roll).toBeGreaterThan(0);
    });

    it("accepts Float32Array", () => {
      const mapper = new AxisMapper(MODE2);
      const axes = new Float32Array([0, 0, 0.5, 0]);
      const result = mapper.map(axes);
      expect(result.roll).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("missing axis index returns 0", () => {
      const mapper = new AxisMapper(MODE2);
      // Only 2 axes provided, but mapping references axis 2 and 3
      const result = mapper.map(makeAxes(0, 0));
      expect(result.roll).toBe(0);
      expect(result.pitch).toBe(0);
    });

    it("throttle is clamped to [0, 1]", () => {
      const mapper = new AxisMapper(MODE2);
      // Raw = -2 (out of range), inverted → +2, normalized → 1.5, clamped → 1
      const result = mapper.map(makeAxes(0, -2, 0, 0));
      expect(result.throttle).toBeLessThanOrEqual(1);
      expect(result.throttle).toBeGreaterThanOrEqual(0);
    });

    it("full stick deflection from all axes", () => {
      const mapper = new AxisMapper(MODE2);
      // All axes at -1
      const result = mapper.map(makeAxes(-1, -1, -1, -1));
      expect(result.throttle).toBeCloseTo(1, 1); // inverted
      expect(result.roll).toBeCloseTo(-1, 1);
      expect(result.pitch).toBeCloseTo(1, 1); // inverted
      expect(result.yaw).toBeCloseTo(-1, 1);
    });
  });
});
