import { describe, expect, it } from "vitest";
import { FlightController } from "../FlightController";
import { applyExpo } from "../FlightModes";
import { DronePhysics } from "../../physics/DronePhysics";
import { DEFAULT_DRONE_CONFIG, DEFAULT_RATES } from "../../physics/droneConfig";
import { createDefaultDroneState, type StickInputs } from "../../physics/types";

describe("controller with the reference quad physics", () => {
  describe.each([
    ["roll", "y", DEFAULT_RATES.rollRate, 1],
    ["pitch", "x", DEFAULT_RATES.pitchRate, -1],
    ["yaw", "z", DEFAULT_RATES.yawRate, -1],
  ] as const)("%s axis", (stick, axis, rate, sign) => {
    it.each([0.25, -0.25, 1, -1])("tracks and stops a sustained %f command", (command) => {
      const config = DEFAULT_DRONE_CONFIG;
      const physics = new DronePhysics(config);
      const controller = new FlightController(DEFAULT_RATES);
      const hoverRpmFraction = Math.sqrt(config.mass * 9.81 / (4 * config.kT)) / config.maxThrottleRpm;
      const inputs: StickInputs = {
        throttle: Math.pow(hoverRpmFraction, 1 / config.motorResponseExponent!),
        roll: 0, pitch: 0, yaw: 0,
      };
      let state = createDefaultDroneState(1000);
      const dt = 0.002;
      // Start the hover observation with motors settled, excluding launch spin-up.
      for (let step = 0; step < 500; step++) {
        physics.getMotorModel().update([inputs.throttle, inputs.throttle, inputs.throttle, inputs.throttle], dt);
      }
      for (let step = 0; step < 500; step++) {
        state = physics.step(state, controller.update(inputs, state, dt), dt);
      }
      expect(Math.abs(state.velocity.z)).toBeLessThan(0.2);
      inputs[stick] = command;
      const target = sign * applyExpo(command, DEFAULT_RATES.expo) * rate * Math.PI / 180;
      let error = 0;
      for (let step = 0; step < 1500; step++) {
        state = physics.step(state, controller.update(inputs, state, dt), dt);
        if (step >= 1250) {
          error += Math.abs(state.angularVelocity[axis] - target) / 250;
        }
      }
      expect(error).toBeLessThan(15 * Math.PI / 180);
      inputs[stick] = 0;
      for (let step = 0; step < 500; step++) {
        state = physics.step(state, controller.update(inputs, state, dt), dt);
      }
      expect(Math.abs(state.angularVelocity[axis])).toBeLessThan(15 * Math.PI / 180);
      expect(Math.hypot(state.quaternion.w, state.quaternion.x, state.quaternion.y, state.quaternion.z)).toBeCloseTo(1, 8);
    });
  });
});
