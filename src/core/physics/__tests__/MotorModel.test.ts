import { describe, expect, it } from "vitest";
import { MotorModel } from "../MotorModel";
import { DEFAULT_DRONE_CONFIG } from "../types";

const DT = 0.002; // 500Hz

describe("MotorModel", () => {
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("keeps stopped motors stopped with invalid response exponent %f", (motorResponseExponent) => {
    const model = new MotorModel({ ...DEFAULT_DRONE_CONFIG, motorResponseExponent });
    expect(model.update([0, 0, 0, 0], DT)).toEqual([0, 0, 0, 0]);
  });
  // F60 Pro V 1750KV / T5147-3, manufacturer static bench at 24.8–25.2V.
  it.each([
    [0.2, 11132, 227], [0.4, 16928, 558.6], [0.6, 21409, 910.7],
    [0.8, 26122, 1403.4], [1, 30527, 1882.5],
  ])("matches loaded RPM and thrust near %f command", (command, rpm, grams) => {
    const model = new MotorModel(DEFAULT_DRONE_CONFIG);
    let thrust = 0;
    for (let step = 0; step < 500; step++) {
      thrust = model.update([command, 0, 0, 0], DT)[0]!;
    }
    expect(Math.abs(model.state.rpm[0]! / rpm - 1)).toBeLessThan(0.06);
    expect(Math.abs(thrust / (grams * 0.00981) - 1)).toBeLessThan(0.1);
  });

  it("applies a changed motor lag without changing the timestep", () => {
    const config = { ...DEFAULT_DRONE_CONFIG };
    const model = new MotorModel(config);
    model.update([1, 1, 1, 1], DT);
    config.motorTimeConstant = 0.1;
    model.reset();
    model.update([1, 1, 1, 1], DT);
    expect(model.state.rpm[0]).toBeCloseTo(DEFAULT_DRONE_CONFIG.maxThrottleRpm * (1 - Math.exp(-DT / 0.1)), 4);
  });

  describe("asymmetric spin-up/down", () => {
    it("spins up faster than it spins down over same duration", () => {
      const model = new MotorModel(DEFAULT_DRONE_CONFIG);

      // Spin up from 0 to full throttle for 30ms (15 steps at 500Hz)
      // Short duration makes the asymmetry between spin-up (18ms tau) and
      // spin-down (23.4ms tau) visible before both processes complete.
      for (let i = 0; i < 15; i++) {
        model.update([1, 0, 0, 0], DT);
      }
      const rpmAfterSpinUp = model.state.rpm[0]!;

      // Now spin down from current RPM for same 30ms
      for (let i = 0; i < 15; i++) {
        model.update([0, 0, 0, 0], DT);
      }
      const rpmAfterSpinDown = model.state.rpm[0]!;

      // After spin-down, motor should still retain significant RPM
      // because spin-down is slower (motorSpinDownFactor = 1.3)
      expect(rpmAfterSpinDown).toBeGreaterThan(0);
      // Should retain more than 20% of peak — spin-down tau is 1.3x spin-up tau
      expect(rpmAfterSpinDown / rpmAfterSpinUp).toBeGreaterThan(0.2);
    });

    it("motor commands are clamped to [0, 1]", () => {
      const model = new MotorModel(DEFAULT_DRONE_CONFIG);
      const thrusts = model.update([1.5, -0.5, 0.5, 0.5], DT);
      // Should produce valid thrust values (not NaN or negative)
      for (const t of thrusts) {
        expect(t).toBeGreaterThanOrEqual(0);
        expect(isNaN(t)).toBe(false);
      }
    });
  });
});
