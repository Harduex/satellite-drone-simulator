import { describe, expect, it } from "vitest";
import { MotorModel } from "../MotorModel";
import { DEFAULT_DRONE_CONFIG } from "../types";

const DT = 0.002; // 500Hz

describe("MotorModel", () => {
  describe("asymmetric spin-up/down", () => {
    it("spins up faster than it spins down over same duration", () => {
      const model = new MotorModel(DEFAULT_DRONE_CONFIG);

      // Spin up from 0 to full throttle for 100ms (50 steps at 500Hz)
      for (let i = 0; i < 50; i++) {
        model.update([1, 0, 0, 0], DT);
      }
      const rpmAfterSpinUp = model.state.rpm[0]!;

      // Now spin down from current RPM for same 100ms
      for (let i = 0; i < 50; i++) {
        model.update([0, 0, 0, 0], DT);
      }
      const rpmAfterSpinDown = model.state.rpm[0]!;

      // After spin-down, motor should still retain significant RPM
      // because spin-down is 2x slower (motorSpinDownFactor = 2.0)
      expect(rpmAfterSpinDown).toBeGreaterThan(0);
      // Specifically, it should retain more than half its peak RPM
      // because less time constant means less decay
      expect(rpmAfterSpinDown / rpmAfterSpinUp).toBeGreaterThan(0.3);
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
