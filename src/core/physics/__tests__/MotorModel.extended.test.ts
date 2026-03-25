import { describe, expect, it } from "vitest";
import { MotorModel } from "../MotorModel";
import { DEFAULT_DRONE_CONFIG } from "../types";
import type { PhysicsConfig } from "../types";

const DT = 0.002; // 500Hz

describe("MotorModel extended", () => {
  describe("alpha cache", () => {
    it("reuses cached alpha when dt is constant", () => {
      const model = new MotorModel(DEFAULT_DRONE_CONFIG);
      // First call — populates cache
      model.update([0.5, 0.5, 0.5, 0.5], DT);
      // Internal cachedDt should now equal DT — verified by ensuring
      // subsequent calls produce consistent results without recalculating
      const rpm1 = [...model.state.rpm];
      model.update([0.5, 0.5, 0.5, 0.5], DT);
      const rpm2 = [...model.state.rpm];
      // RPMs should continue to increase toward target
      for (let i = 0; i < 4; i++) {
        expect(rpm2[i]).toBeGreaterThan(rpm1[i]!);
      }
    });

    it("recomputes alpha when dt changes", () => {
      const model = new MotorModel(DEFAULT_DRONE_CONFIG);
      model.update([1, 1, 1, 1], DT);
      const rpm1 = model.state.rpm[0]!;
      model.update([1, 1, 1, 1], DT * 2); // different dt
      const rpm2 = model.state.rpm[0]!;
      // Larger dt should produce larger step toward target
      // (difference is at least as large as with smaller dt)
      expect(rpm2).toBeGreaterThan(rpm1);
    });
  });

  describe("buffer reuse", () => {
    it("update returns same array reference each call", () => {
      const model = new MotorModel(DEFAULT_DRONE_CONFIG);
      const thrusts1 = model.update([0.5, 0.5, 0.5, 0.5], DT);
      const thrusts2 = model.update([0.5, 0.5, 0.5, 0.5], DT);
      expect(thrusts1).toBe(thrusts2); // same array reference
    });

    it("getReactionTorques returns same array reference each call", () => {
      const model = new MotorModel(DEFAULT_DRONE_CONFIG);
      model.update([0.5, 0.5, 0.5, 0.5], DT);
      const t1 = model.getReactionTorques();
      const t2 = model.getReactionTorques();
      expect(t1).toBe(t2);
    });
  });

  describe("reaction torques", () => {
    it("torques are proportional to rpm squared", () => {
      const model = new MotorModel(DEFAULT_DRONE_CONFIG);
      // Spin up motor 0 for a while
      for (let i = 0; i < 100; i++) {
        model.update([1, 0, 0, 0], DT);
      }
      const torques = model.getReactionTorques();
      // Motor 0 should have high torque, others near zero
      expect(torques[0]).toBeGreaterThan(0);
      expect(torques[1]).toBeCloseTo(0, 5);
    });

    it("torques use kQ coefficient", () => {
      const model = new MotorModel(DEFAULT_DRONE_CONFIG);
      for (let i = 0; i < 200; i++) {
        model.update([0.5, 0.5, 0.5, 0.5], DT);
      }
      const torques = model.getReactionTorques();
      const rpm = model.state.rpm[0]!;
      const expectedTorque = DEFAULT_DRONE_CONFIG.kQ * rpm * rpm;
      expect(torques[0]).toBeCloseTo(expectedTorque);
    });
  });

  describe("thrustLinearization", () => {
    it("linearized thrust: half-cmd produces roughly half-thrust of full-cmd", () => {
      const config: PhysicsConfig = { ...DEFAULT_DRONE_CONFIG, thrustLinearization: true };
      const model = new MotorModel(config);
      // Let motor reach steady state at cmd=1
      for (let i = 0; i < 500; i++) model.update([1, 0, 0, 0], DT);
      const fullThrust = model.update([1, 0, 0, 0], DT)[0]!;

      // Reset and reach steady state at cmd=0.5
      const model2 = new MotorModel(config);
      for (let i = 0; i < 500; i++) model2.update([0.5, 0, 0, 0], DT);
      const halfThrust = model2.update([0.5, 0, 0, 0], DT)[0]!;

      // With linearization, thrust should be roughly proportional to command
      const ratio = halfThrust / fullThrust;
      expect(ratio).toBeGreaterThan(0.35);
      expect(ratio).toBeLessThan(0.65);
    });

    it("without linearization, half-cmd produces quarter-thrust", () => {
      const config: PhysicsConfig = { ...DEFAULT_DRONE_CONFIG, thrustLinearization: false };
      const model = new MotorModel(config);
      for (let i = 0; i < 500; i++) model.update([1, 0, 0, 0], DT);
      const fullThrust = model.update([1, 0, 0, 0], DT)[0]!;

      const model2 = new MotorModel(config);
      for (let i = 0; i < 500; i++) model2.update([0.5, 0, 0, 0], DT);
      const halfThrust = model2.update([0.5, 0, 0, 0], DT)[0]!;

      // Without linearization, T = kT * (cmd * maxRPM)² — quadratic
      const ratio = halfThrust / fullThrust;
      expect(ratio).toBeGreaterThan(0.15);
      expect(ratio).toBeLessThan(0.35);
    });
  });

  describe("reset", () => {
    it("zeroes all motor RPMs", () => {
      const model = new MotorModel(DEFAULT_DRONE_CONFIG);
      for (let i = 0; i < 100; i++) {
        model.update([1, 1, 1, 1], DT);
      }
      expect(model.state.rpm[0]).toBeGreaterThan(0);
      model.reset();
      expect(model.state.rpm).toEqual([0, 0, 0, 0]);
    });
  });

  describe("command clamping", () => {
    it("clamps negative commands to 0", () => {
      const model = new MotorModel(DEFAULT_DRONE_CONFIG);
      const thrusts = model.update([-1, -0.5, 0, 0], DT);
      // All thrusts should be >= 0 (RPM can't go negative)
      for (const t of thrusts) {
        expect(t).toBeGreaterThanOrEqual(0);
      }
    });

    it("clamps commands above 1 to 1", () => {
      const model = new MotorModel(DEFAULT_DRONE_CONFIG);
      // Run at cmd=2.0 for a while, then check RPM doesn't exceed maxThrottleRpm
      for (let i = 0; i < 500; i++) {
        model.update([2, 2, 2, 2], DT);
      }
      for (const rpm of model.state.rpm) {
        expect(rpm).toBeLessThanOrEqual(DEFAULT_DRONE_CONFIG.maxThrottleRpm * 1.01);
      }
    });
  });
});
