import { describe, expect, it } from "vitest";
import { DronePhysics } from "../DronePhysics";
import { createDefaultDroneState, DEFAULT_DRONE_CONFIG } from "../types";
import type { MotorCommands } from "../types";

const PHYSICS_DT = 1 / 500; // 500Hz

describe("DronePhysics", () => {
  describe("drop test", () => {
    it("drone falls under gravity with zero throttle", () => {
      const physics = new DronePhysics(DEFAULT_DRONE_CONFIG);
      let state = createDefaultDroneState(10);
      const zeroMotors: MotorCommands = { m1: 0, m2: 0, m3: 0, m4: 0 };

      // Simulate 0.5 seconds
      for (let i = 0; i < 250; i++) {
        state = physics.step(state, zeroMotors, PHYSICS_DT);
      }

      // Drone should have fallen (position.z < 10)
      expect(state.position.z).toBeLessThan(10);
      // Velocity should be negative (falling)
      expect(state.velocity.z).toBeLessThan(0);
      // After 0.5s free fall: v ≈ -4.9 m/s, pos ≈ 10 - 1.22 ≈ 8.78m
      expect(state.position.z).toBeGreaterThan(8);
      expect(state.position.z).toBeLessThan(9.5);
    });

    it("drone hits ground and stops", () => {
      const physics = new DronePhysics(DEFAULT_DRONE_CONFIG);
      let state = createDefaultDroneState(2); // low altitude
      const zeroMotors: MotorCommands = { m1: 0, m2: 0, m3: 0, m4: 0 };

      // Simulate 2 seconds — should hit ground
      for (let i = 0; i < 1000; i++) {
        state = physics.step(state, zeroMotors, PHYSICS_DT);
      }

      // Ground clamp: position.z should be 0
      expect(state.position.z).toBe(0);
      expect(state.velocity.z).toBe(0);
    });
  });

  describe("hover test", () => {
    it("approximately hovers at the right throttle", () => {
      const physics = new DronePhysics(DEFAULT_DRONE_CONFIG);
      const config = DEFAULT_DRONE_CONFIG;

      // Calculate hover throttle:
      // At hover, total thrust = m * g
      // T_per_motor = m * g / 4 = 0.55 * 9.81 / 4 ≈ 1.349 N
      // T = kT * rpm²  →  rpm = sqrt(T / kT) = sqrt(1.349 / 8.5e-6) ≈ 398.3
      // throttle = rpm / maxRpm = 398.3 / 24000 ≈ 0.0166
      // This is very low because kT * maxRpm² = 8.5e-6 * 24000² ≈ 4896 N per motor
      const hoverThrustPerMotor = (config.mass * 9.81) / 4;
      const hoverRpm = Math.sqrt(hoverThrustPerMotor / config.kT);
      const hoverThrottle = hoverRpm / config.maxThrottleRpm;

      let state = createDefaultDroneState(10);
      const hoverMotors: MotorCommands = {
        m1: hoverThrottle,
        m2: hoverThrottle,
        m3: hoverThrottle,
        m4: hoverThrottle,
      };

      // Simulate 2 seconds at hover throttle
      for (let i = 0; i < 1000; i++) {
        state = physics.step(state, hoverMotors, PHYSICS_DT);
      }

      // Position should be approximately stable (within 1m of starting altitude)
      expect(state.position.z).toBeGreaterThan(8);
      expect(state.position.z).toBeLessThan(12);
      // Vertical velocity should be near zero
      expect(Math.abs(state.velocity.z)).toBeLessThan(2);
    });
  });

  describe("spin test", () => {
    it("differential motor commands produce yaw rotation", () => {
      const physics = new DronePhysics(DEFAULT_DRONE_CONFIG);
      let state = createDefaultDroneState(10);

      // CCW motors (M1, M3) at higher throttle → yaw in one direction
      const yawMotors: MotorCommands = { m1: 0.3, m2: 0.1, m3: 0.3, m4: 0.1 };

      // Simulate 0.5 seconds
      for (let i = 0; i < 250; i++) {
        state = physics.step(state, yawMotors, PHYSICS_DT);
      }

      // Should have non-zero yaw angular velocity
      expect(Math.abs(state.angularVelocity.z)).toBeGreaterThan(0.01);
    });

    it("differential motor commands produce roll", () => {
      const physics = new DronePhysics(DEFAULT_DRONE_CONFIG);
      let state = createDefaultDroneState(10);

      // Right motors (M2, M3) higher → roll
      const rollMotors: MotorCommands = { m1: 0.1, m2: 0.3, m3: 0.3, m4: 0.1 };

      for (let i = 0; i < 250; i++) {
        state = physics.step(state, rollMotors, PHYSICS_DT);
      }

      // Should have non-zero roll angular velocity
      expect(Math.abs(state.angularVelocity.x)).toBeGreaterThan(0.01);
    });
  });
});
