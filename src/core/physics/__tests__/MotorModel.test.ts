import { describe, expect, it } from "vitest";
import { MotorModel } from "../MotorModel";
import { DEFAULT_DRONE_CONFIG } from "../types";

const DT = 0.002; // 500Hz

describe("MotorModel", () => {
  it("supports approximately 35% hover throttle for the default quad", () => {
    const model = new MotorModel(DEFAULT_DRONE_CONFIG);
    let thrust = 0;
    for (let step = 0; step < 500; step++) {
      thrust = model.update([0.35, 0.35, 0.35, 0.35], DT).reduce((sum, t) => sum + t, 0);
    }
    expect(thrust).toBeCloseTo(5.3955, 1);
  });

  it("applies a changed motor lag without changing the timestep", () => {
    const config = { ...DEFAULT_DRONE_CONFIG };
    const model = new MotorModel(config);
    model.update([1, 1, 1, 1], DT);
    config.motorTimeConstant = 0.1;
    model.reset();
    model.update([1, 1, 1, 1], DT);
    // First-order response: 24000 * (1 - exp(-0.002 / 0.1)).
    expect(model.state.rpm[0]).toBeCloseTo(475.23184, 4);
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
