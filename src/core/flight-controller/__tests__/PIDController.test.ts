import { describe, expect, it } from "vitest";
import { PIDController } from "../PIDController";

describe("PIDController", () => {
  it("does not apply derivative kick when only the target rate changes", () => {
    const pid = new PIDController({ kP: 0, kI: 0, kD: 0.01, kFF: 0 });
    pid.update(0, 0.002, 0);
    expect(pid.update(1, 0.002, 1)).toBe(0);
    // Measurement rises from zero to 0.1 rad/s while the target stays at 1.
    expect(pid.update(0.9, 0.002, 1)).toBeLessThan(0);
  });

  it("applies target-rate acceleration only through feedforward", () => {
    const pid = new PIDController({ kP: 0, kI: 0, kD: 0.01, kFF: 0.001 });
    pid.update(0, 0.002, 0);
    expect(pid.update(1, 0.002, 1)).toBeCloseTo(0.5, 10);
    expect(pid.update(1, 0.002, 1)).toBeCloseTo(0, 10);
  });

  describe("step response", () => {
    it("converges error to near zero", () => {
      const pid = new PIDController({ kP: 1.0, kI: 0.5, kD: 0.1 });
      const dt = 0.002; // 500Hz
      let error = 1.0;

      // Simulate a simple system where output reduces error
      for (let i = 0; i < 500; i++) {
        const output = pid.update(error, dt);
        // Simple: error reduces by some fraction of the output
        error -= output * dt * 10;
      }

      // Error should be near zero
      expect(Math.abs(error)).toBeLessThan(0.1);
    });
  });

  describe("anti-windup", () => {
    it("integral stays bounded under sustained error", () => {
      const pid = new PIDController({
        kP: 0.1,
        kI: 1.0,
        kD: 0,
        iLimit: 0.5,
        outputLimit: 1.0,
      });
      const dt = 0.002;

      // Sustained large error for many steps
      for (let i = 0; i < 1000; i++) {
        const output = pid.update(10.0, dt);
        // Output should be clamped
        expect(output).toBeLessThanOrEqual(1.0);
        expect(output).toBeGreaterThanOrEqual(-1.0);
      }
    });
  });

  describe("reset", () => {
    it("clears accumulated state", () => {
      const pid = new PIDController({ kP: 1.0, kI: 1.0, kD: 1.0 });

      // Build up state
      pid.update(5.0, 0.002);
      pid.update(5.0, 0.002);

      // Reset
      pid.reset();

      // First call after reset should behave like fresh controller
      const output = pid.update(1.0, 0.002);
      // Only P term should contribute significantly (I and D start from zero)
      expect(output).toBeCloseTo(1.0, 0); // P * error = 1.0 * 1.0
    });
  });
});
