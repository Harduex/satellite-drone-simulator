import { describe, expect, it } from "vitest";
import { FlightController } from "../FlightController";
import { applyExpo } from "../FlightModes";
import { DronePhysics } from "../../physics/DronePhysics";
import { WindModel } from "../../physics/WindModel";
import { DEFAULT_DRONE_CONFIG, DEFAULT_RATES } from "../../physics/droneConfig";
import { createDefaultDroneState, quatRotateVector, type StickInputs } from "../../physics/types";

describe("Acro flight maneuvers", () => {
  it.each([
    ["roll", "y", 1, DEFAULT_RATES.rollRate],
    ["pitch", "x", -1, DEFAULT_RATES.pitchRate],
    ["yaw", "z", -1, DEFAULT_RATES.yawRate],
  ] as const)("bounds transient %s response and stops without self-leveling", (stick, axis, sign, rate) => {
    for (const throttle of [0.1, 0.21, 0.5]) {
      for (const direction of [-1, 1]) {
        const physics = new DronePhysics({ ...DEFAULT_DRONE_CONFIG });
        const controller = new FlightController(DEFAULT_RATES);
        let state = createDefaultDroneState(100);
        const inputs: StickInputs = { throttle, roll: 0, pitch: 0, yaw: 0 };
        let command = 0;
        let maxRate = 0;
        // 90 ms ramp up and 60 ms return: a brief keyboard-like correction.
        for (let step = 0; step < 1000; step++) {
          command = step < 45 ? Math.min(0.7, command + 0.008) : Math.max(0, command - 0.012);
          inputs[stick] = direction * command;
          state = physics.step(state, controller.update(inputs, state, 0.002), 0.002);
          maxRate = Math.max(maxRate, Math.abs(state.angularVelocity[axis]));
        }
        const angle = direction * sign * 2 * Math.atan2(state.quaternion[axis], state.quaternion.w) * 180 / Math.PI;
        const peakTarget = applyExpo(0.36, DEFAULT_RATES.expo) * rate;
        expect(maxRate * 180 / Math.PI, `throttle=${throttle}, direction=${direction}`).toBeLessThan(peakTarget * 1.4);
        expect(angle).toBeGreaterThan(3);
        expect(angle).toBeLessThan(30);
        expect(Math.abs(state.angularVelocity[axis])).toBeLessThan(0.05);
      }
    }
  });

  it("takes off, travels forward, turns right and retains tilt with centered sticks", () => {
    const physics = new DronePhysics({ ...DEFAULT_DRONE_CONFIG });
    const controller = new FlightController(DEFAULT_RATES);
    const inputs: StickInputs = { throttle: 0.23, roll: 0, pitch: 0, yaw: 0 };
    let state = createDefaultDroneState(0);
    const advance = (seconds: number) => {
      for (let step = 0; step < seconds / 0.002; step++) {
        state = physics.step(state, controller.update(inputs, state, 0.002), 0.002);
      }
    };
    advance(1);
    expect(state.position.z).toBeGreaterThan(1);
    inputs.pitch = 0.15;
    advance(0.3);
    inputs.pitch = 0;
    advance(1);
    expect(state.position.y).toBeGreaterThan(0.5);
    expect(state.velocity.y).toBeGreaterThan(1);
    const upBefore = quatRotateVector(state.quaternion, { x: 0, y: 0, z: 1 });
    expect(upBefore.y).toBeGreaterThan(0.2);
    advance(1);
    const upAfter = quatRotateVector(state.quaternion, { x: 0, y: 0, z: 1 });
    expect(Math.abs(upAfter.y - upBefore.y)).toBeLessThan(0.05);
    expect(Math.abs(state.angularVelocity.x)).toBeLessThan(0.05);
    inputs.yaw = 0.2;
    advance(0.5);
    inputs.yaw = 0;
    advance(1);
    const forward = quatRotateVector(state.quaternion, { x: 0, y: 1, z: 0 });
    expect(forward.x).toBeGreaterThan(0.3);
    expect(Math.abs(state.angularVelocity.z)).toBeLessThan(0.05);
    expect(state.position.z).toBeGreaterThan(1);
  });

  it("smooths 50Hz discrete USB gamepad steps without 100Hz motor-reversal chatter or yaw motor shutoff", () => {
    const physics = new DronePhysics({ ...DEFAULT_DRONE_CONFIG });
    const controller = new FlightController(DEFAULT_RATES);
    let state = createDefaultDroneState(100);
    const dt = 0.002;
    const inputs: StickInputs = { throttle: 0.78, roll: 0, pitch: 0, yaw: 0 };

    // Settle motors at 0.78 throttle
    for (let step = 0; step < 250; step++) {
      state = physics.step(state, controller.update(inputs, state, dt), dt);
    }

    // Ramp pitch from 0 to -0.9 and back in 20ms (10-step) discrete USB HID packets, sampling every 10ms (5 steps)
    const pitchDiffs: number[] = [];
    let currentPitch = 0;
    for (let step = 0; step < 200; step++) {
      if (step % 10 === 0) {
        currentPitch = step < 100 ? Math.max(-0.9, currentPitch - 0.12) : Math.min(0, currentPitch + 0.15);
        inputs.pitch = currentPitch;
      }
      const motors = controller.update(inputs, state, dt);
      state = physics.step(state, motors, dt);
      if (step % 5 === 0) {
        pitchDiffs.push(motors.m1 - motors.m3);
      }
    }

    let signFlipTeeth = 0;
    for (let i = 1; i < pitchDiffs.length - 1; i++) {
      const prev = pitchDiffs[i - 1]!;
      const curr = pitchDiffs[i]!;
      const next = pitchDiffs[i + 1]!;
      if (Math.abs(prev) > 0.05 && Math.abs(curr) > 0.05 && Math.sign(prev) !== Math.sign(curr) && Math.sign(prev) === Math.sign(next)) {
        signFlipTeeth++;
      }
    }
    expect(signFlipTeeth).toBe(0);

    // Fast yaw step at 0.98 throttle should not shut off non-yaw motors to 0
    inputs.throttle = 0.98;
    inputs.pitch = 0;
    inputs.yaw = 0.6;
    const yawStepMotors = controller.update(inputs, state, dt);
    expect(Math.min(yawStepMotors.m1, yawStepMotors.m2, yawStepMotors.m3, yawStepMotors.m4)).toBeGreaterThan(0.5);
  });
});

describe.each([false, true])("controller with the reference quad physics (wind=%s)", (gentleWind) => {
  describe.each([
    ["roll", "y", DEFAULT_RATES.rollRate, 1],
    ["pitch", "x", DEFAULT_RATES.pitchRate, -1],
    ["yaw", "z", DEFAULT_RATES.yawRate, -1],
  ] as const)("%s axis", (stick, axis, rate, sign) => {
    it.each([0.25, -0.25, 1, -1])("tracks and stops a sustained %f command", (command) => {
      const config = DEFAULT_DRONE_CONFIG;
      const physics = new DronePhysics(config);
      const controller = new FlightController(DEFAULT_RATES);
      const wind = new WindModel();
      const air = { x: 0, y: 0, z: 0 };
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
        state = physics.step(state, controller.update(inputs, state, dt), dt, 0,
          gentleWind ? wind.updateInto(dt, air) : undefined);
      }
      expect(Math.abs(state.velocity.z)).toBeLessThan(0.2);
      inputs[stick] = command;
      const target = sign * applyExpo(command, DEFAULT_RATES.expo) * rate * Math.PI / 180;
      let error = 0;
      for (let step = 0; step < 1500; step++) {
        state = physics.step(state, controller.update(inputs, state, dt), dt, 0,
          gentleWind ? wind.updateInto(dt, air) : undefined);
        if (step >= 1250) {
          error += Math.abs(state.angularVelocity[axis] - target) / 250;
        }
      }
      expect(error).toBeLessThan(15 * Math.PI / 180);
      inputs[stick] = 0;
      for (let step = 0; step < 500; step++) {
        state = physics.step(state, controller.update(inputs, state, dt), dt, 0,
          gentleWind ? wind.updateInto(dt, air) : undefined);
      }
      expect(Math.abs(state.angularVelocity[axis])).toBeLessThan(15 * Math.PI / 180);
      expect(Math.hypot(state.quaternion.w, state.quaternion.x, state.quaternion.y, state.quaternion.z)).toBeCloseTo(1, 8);
    });
  });
});
