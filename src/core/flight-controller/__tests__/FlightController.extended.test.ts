import { describe, expect, it } from "vitest";
import { FlightController } from "../FlightController";
import { applyExpo } from "../FlightModes";
import {
  DEFAULT_RATES,
  createDefaultDroneState,
} from "../../physics/types";
import type { MotorCommands, StickInputs } from "../../physics/types";

const DT = 0.002; // 500Hz

function zeroSticks(): StickInputs {
  return { throttle: 0.5, roll: 0, pitch: 0, yaw: 0 };
}

describe("FlightController extended", () => {
  describe("updateInto", () => {
    it("returns same reference as out", () => {
      const fc = new FlightController(DEFAULT_RATES);
      const state = createDefaultDroneState(10);
      const out: MotorCommands = { m1: 0, m2: 0, m3: 0, m4: 0 };
      const result = fc.updateInto(zeroSticks(), state, DT, out);
      expect(result).toBe(out);
    });

    it("matches update() output", () => {
      const fc1 = new FlightController(DEFAULT_RATES);
      const fc2 = new FlightController(DEFAULT_RATES);
      const state = createDefaultDroneState(10);
      const sticks: StickInputs = { throttle: 0.4, roll: 0.3, pitch: -0.2, yaw: 0.1 };

      const fromUpdate = fc1.update(sticks, state, DT);
      const out: MotorCommands = { m1: 0, m2: 0, m3: 0, m4: 0 };
      fc2.updateInto(sticks, state, DT, out);

      expect(out.m1).toBeCloseTo(fromUpdate.m1);
      expect(out.m2).toBeCloseTo(fromUpdate.m2);
      expect(out.m3).toBeCloseTo(fromUpdate.m3);
      expect(out.m4).toBeCloseTo(fromUpdate.m4);
    });

    it("shared buffer is overwritten each call", () => {
      const fc = new FlightController(DEFAULT_RATES);
      const state = createDefaultDroneState(10);
      const out: MotorCommands = { m1: 0, m2: 0, m3: 0, m4: 0 };

      fc.updateInto(zeroSticks(), state, DT, out);
      const firstM1 = out.m1;

      fc.updateInto({ throttle: 0.8, roll: 0, pitch: 0, yaw: 0 }, state, DT, out);
      expect(out.m1).not.toBe(firstM1);
    });
  });

  describe("airmode mixer", () => {
    it("outputs stay in [0, 1] with extreme PID corrections", () => {
      const fc = new FlightController(DEFAULT_RATES);
      const state = createDefaultDroneState(10);
      // High angular velocity → large PID error → large corrections
      state.angularVelocity.y = 20; // rad/s roll rate
      state.angularVelocity.x = -15;

      const sticks: StickInputs = { throttle: 0.1, roll: 1, pitch: -1, yaw: 1 };
      const motors = fc.update(sticks, state, DT);

      expect(motors.m1).toBeGreaterThanOrEqual(0);
      expect(motors.m1).toBeLessThanOrEqual(1);
      expect(motors.m2).toBeGreaterThanOrEqual(0);
      expect(motors.m2).toBeLessThanOrEqual(1);
      expect(motors.m3).toBeGreaterThanOrEqual(0);
      expect(motors.m3).toBeLessThanOrEqual(1);
      expect(motors.m4).toBeGreaterThanOrEqual(0);
      expect(motors.m4).toBeLessThanOrEqual(1);
    });

    it("zero throttle with PID corrections still produces output (airmode)", () => {
      const fc = new FlightController(DEFAULT_RATES);
      const state = createDefaultDroneState(10);
      state.angularVelocity.y = 5;
      const sticks: StickInputs = { throttle: 0, roll: 0.5, pitch: 0, yaw: 0 };

      const motors = fc.update(sticks, state, DT);
      // Airmode shifts negative values up — at least one motor > 0
      const maxMotor = Math.max(motors.m1, motors.m2, motors.m3, motors.m4);
      expect(maxMotor).toBeGreaterThan(0);
    });
  });

  describe("pitch input", () => {
    it("pitch input makes front motors different from rear", () => {
      const fc = new FlightController(DEFAULT_RATES);
      const state = createDefaultDroneState(10);
      const sticks: StickInputs = { throttle: 0.5, roll: 0, pitch: 0.5, yaw: 0 };

      const motors = fc.update(sticks, state, DT);
      // Front motors (M1, M2) should differ from rear motors (M3, M4)
      const frontAvg = (motors.m1 + motors.m2) / 2;
      const rearAvg = (motors.m3 + motors.m4) / 2;
      expect(frontAvg).not.toBeCloseTo(rearAvg, 2);
    });
  });

  describe("yaw input", () => {
    it("yaw input differential follows motor spin direction", () => {
      const fc = new FlightController(DEFAULT_RATES);
      const state = createDefaultDroneState(10);
      const sticks: StickInputs = { throttle: 0.5, roll: 0, pitch: 0, yaw: 0.5 };

      const motors = fc.update(sticks, state, DT);
      // CCW motors (M1 +yaw, M3 +yaw) should differ from CW motors (M2 -yaw, M4 -yaw)
      const ccwAvg = (motors.m1 + motors.m3) / 2;
      const cwAvg = (motors.m2 + motors.m4) / 2;
      expect(ccwAvg).not.toBeCloseTo(cwAvg, 2);
    });
  });

  describe("expo", () => {
    it("expo=0 gives linear response (tested via applyExpo)", () => {
      // applyExpo(input, 0) = input * (0 * input² + 1) = input
      expect(applyExpo(0.5, 0)).toBeCloseTo(0.5);
      expect(applyExpo(1.0, 0)).toBeCloseTo(1.0);
      expect(applyExpo(-0.3, 0)).toBeCloseTo(-0.3);
    });

    it("expo=1 applies full cubic curve", () => {
      // applyExpo(input, 1) = input * (1 * input² + 0) = input³
      expect(applyExpo(0.5, 1)).toBeCloseTo(0.125);
      expect(applyExpo(1.0, 1)).toBeCloseTo(1.0);
      expect(applyExpo(-0.5, 1)).toBeCloseTo(-0.125);
    });

    it("expo softens center stick", () => {
      // With expo > 0, small inputs produce smaller outputs than linear
      const expo = 0.6;
      const linear = 0.3;
      expect(Math.abs(applyExpo(linear, expo))).toBeLessThan(Math.abs(linear));
    });
  });

  describe("updateRates", () => {
    it("changes rate config (observable via accumulated PID output)", () => {
      // Run many steps to let PID integrator accumulate — this makes
      // the target rate difference observable even through motor clamping
      const fc1 = new FlightController(DEFAULT_RATES);
      const fc2 = new FlightController({ ...DEFAULT_RATES, rollRate: DEFAULT_RATES.rollRate * 2 });

      // Simulate a drone that tracks rotation — PID integrator accumulates error
      let state1 = createDefaultDroneState(10);
      let state2 = createDefaultDroneState(10);
      const sticks: StickInputs = { throttle: 0.5, roll: 0.1, pitch: 0, yaw: 0 };

      let m1Sum = 0;
      let m2Sum = 0;
      for (let i = 0; i < 50; i++) {
        const out1 = fc1.update(sticks, state1, DT);
        m1Sum += out1.m2 - out1.m1;
        const out2 = fc2.update(sticks, state2, DT);
        m2Sum += out2.m2 - out2.m1;
      }

      // Higher rate → bigger accumulated roll differential
      expect(Math.abs(m2Sum)).toBeGreaterThan(Math.abs(m1Sum));
    });
  });

  describe("reset", () => {
    it("reset clears PID integrator state", () => {
      const fc = new FlightController(DEFAULT_RATES);
      const state = createDefaultDroneState(10);
      const sticks: StickInputs = { throttle: 0.5, roll: 0.5, pitch: 0, yaw: 0 };

      // Build up integrator
      for (let i = 0; i < 50; i++) {
        fc.update(sticks, state, DT);
      }
      fc.update(sticks, state, DT);

      fc.reset();
      const fc2 = new FlightController(DEFAULT_RATES);
      const motorsAfterReset = fc.update(sticks, state, DT);
      const motorsFresh = fc2.update(sticks, state, DT);

      // After reset, should behave like a fresh controller
      expect(motorsAfterReset.m1).toBeCloseTo(motorsFresh.m1, 5);
      expect(motorsAfterReset.m2).toBeCloseTo(motorsFresh.m2, 5);
    });
  });
});
