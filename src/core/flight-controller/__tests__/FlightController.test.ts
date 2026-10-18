import { describe, expect, it } from "vitest";
import { FlightController } from "../FlightController";
import {
  DEFAULT_RATES,
  createDefaultDroneState,
  MOTOR_LAYOUT,
} from "../../physics/types";

const DT = 0.002; // 500Hz

describe("FlightController", () => {
  describe("motor mixing uses MOTOR_LAYOUT", () => {
    it("pure throttle produces roughly equal motor commands", () => {
      const fc = new FlightController(DEFAULT_RATES);
      const state = createDefaultDroneState(10);
      const sticks = { throttle: 0.5, roll: 0, pitch: 0, yaw: 0 };

      const motors = fc.update(sticks, state, DT);

      // With zero stick deflection and zero angular velocity, PID output is ~0
      // so all motors should be approximately equal to throttle
      expect(motors.m1).toBeCloseTo(0.5, 1);
      expect(motors.m2).toBeCloseTo(0.5, 1);
      expect(motors.m3).toBeCloseTo(0.5, 1);
      expect(motors.m4).toBeCloseTo(0.5, 1);
    });

    it("right roll input raises the left motors", () => {
      const fc = new FlightController(DEFAULT_RATES);
      const state = createDefaultDroneState(10);
      const sticks = { throttle: 0.5, roll: 0.5, pitch: 0, yaw: 0 };

      const motors = fc.update(sticks, state, DT);

      expect(motors.m1).toBeGreaterThan(motors.m2);
      expect(motors.m4).toBeGreaterThan(motors.m3);
    });

    it("MOTOR_LAYOUT mixing signs are consistent", () => {
      // Verify the layout definition matches the expected X-config
      const [m1, m2, m3, m4] = MOTOR_LAYOUT;

      // Positive body torques follow r × F and oppose propeller spin.
      expect(m1.mixRoll).toBe(1);
      expect(m1.mixPitch).toBe(1);
      expect(m1.mixYaw).toBe(-1);

      expect(m2.mixRoll).toBe(-1);
      expect(m2.mixPitch).toBe(1);
      expect(m2.mixYaw).toBe(1);

      expect(m3.mixRoll).toBe(-1);
      expect(m3.mixPitch).toBe(-1);
      expect(m3.mixYaw).toBe(-1);

      expect(m4.mixRoll).toBe(1);
      expect(m4.mixPitch).toBe(-1);
      expect(m4.mixYaw).toBe(1);
    });
  });
});
