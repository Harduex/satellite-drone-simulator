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

    it("ground collision zeroes ALL velocity components", () => {
      const physics = new DronePhysics(DEFAULT_DRONE_CONFIG);
      // Start at low altitude with lateral + rotational velocity
      let state = createDefaultDroneState(0.5);
      // Give it horizontal velocity and angular velocity via roll motors
      const rollMotors: MotorCommands = { m1: 0.1, m2: 0.4, m3: 0.4, m4: 0.1 };
      // Build up some lateral velocity
      for (let i = 0; i < 50; i++) {
        state = physics.step(state, rollMotors, PHYSICS_DT);
      }
      // Now let it crash with zero throttle
      const zeroMotors: MotorCommands = { m1: 0, m2: 0, m3: 0, m4: 0 };
      for (let i = 0; i < 500; i++) {
        state = physics.step(state, zeroMotors, PHYSICS_DT);
      }

      expect(state.position.z).toBe(0);
      // All velocity components zeroed, not just Z
      expect(state.velocity.x).toBe(0);
      expect(state.velocity.y).toBe(0);
      expect(state.velocity.z).toBe(0);
      expect(state.angularVelocity.x).toBe(0);
      expect(state.angularVelocity.y).toBe(0);
      expect(state.angularVelocity.z).toBe(0);
    });

    it("cannot tunnel through ground at extreme velocity", () => {
      const physics = new DronePhysics(DEFAULT_DRONE_CONFIG);
      let state = createDefaultDroneState(100);
      const fullMotors: MotorCommands = { m1: 1, m2: 1, m3: 1, m4: 1 };
      const zeroMotors: MotorCommands = { m1: 0, m2: 0, m3: 0, m4: 0 };

      // Build up extreme downward velocity by flying up then inverting
      // First fly up for 1 second
      for (let i = 0; i < 500; i++) {
        state = physics.step(state, fullMotors, PHYSICS_DT);
      }
      // Now free fall for 5 seconds from high altitude
      for (let i = 0; i < 2500; i++) {
        state = physics.step(state, zeroMotors, PHYSICS_DT);
      }

      // Position should never go below 0
      expect(state.position.z).toBeGreaterThanOrEqual(0);
    });
  });

  describe("hover test", () => {
    it("approximately hovers at the right throttle", () => {
      const physics = new DronePhysics(DEFAULT_DRONE_CONFIG);
      const config = DEFAULT_DRONE_CONFIG;

      // Calculate hover throttle:
      // At hover, total thrust = m * g
      // T_per_motor = m * g / 4
      // T = kT * rpm²  →  rpm = sqrt(T / kT)
      // With thrust linearization (sqrt applied to cmd before computing RPM):
      //   targetRpm = sqrt(cmd) * maxRpm → cmd = (rpm / maxRpm)²
      const hoverThrustPerMotor = (config.mass * 9.81) / 4;
      const hoverRpm = Math.sqrt(hoverThrustPerMotor / config.kT);
      const rawThrottle = hoverRpm / config.maxThrottleRpm;
      // Invert sqrt linearization: if MotorModel does sqrt(cmd)*maxRpm,
      // we need cmd such that sqrt(cmd)*maxRpm = hoverRpm → cmd = rawThrottle²
      const hoverThrottle = config.thrustLinearization !== false
        ? rawThrottle * rawThrottle
        : rawThrottle;

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

      // Should have non-zero roll angular velocity (roll = rotation around Y axis)
      expect(Math.abs(state.angularVelocity.y)).toBeGreaterThan(0.01);
    });
  });
});
