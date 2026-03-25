import { describe, expect, it } from "vitest";
import { DronePhysics } from "../DronePhysics";
import { createDefaultDroneState, DEFAULT_DRONE_CONFIG } from "../types";
import type { DroneState, MotorCommands } from "../types";

const DT = 1 / 500;

function makeOutputBuffer(): DroneState {
  return {
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    quaternion: { w: 1, x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
  };
}

describe("DronePhysics.stepInto", () => {
  it("returns the same reference as out", () => {
    const physics = new DronePhysics(DEFAULT_DRONE_CONFIG);
    const state = createDefaultDroneState(10);
    const motors: MotorCommands = { m1: 0.3, m2: 0.3, m3: 0.3, m4: 0.3 };
    const out = makeOutputBuffer();
    const result = physics.stepInto(state, motors, DT, 0, out);
    expect(result).toBe(out);
  });

  it("does NOT mutate the input state", () => {
    const physics = new DronePhysics(DEFAULT_DRONE_CONFIG);
    const state = createDefaultDroneState(10);
    const motors: MotorCommands = { m1: 0.5, m2: 0.5, m3: 0.5, m4: 0.5 };
    const out = makeOutputBuffer();

    const posBefore = { ...state.position };
    const velBefore = { ...state.velocity };
    const quatBefore = { ...state.quaternion };
    const avBefore = { ...state.angularVelocity };

    physics.stepInto(state, motors, DT, 0, out);

    expect(state.position).toEqual(posBefore);
    expect(state.velocity).toEqual(velBefore);
    expect(state.quaternion).toEqual(quatBefore);
    expect(state.angularVelocity).toEqual(avBefore);
  });

  it("produces same result as step()", () => {
    const physics = new DronePhysics(DEFAULT_DRONE_CONFIG);
    const state = createDefaultDroneState(10);
    const motors: MotorCommands = { m1: 0.4, m2: 0.3, m3: 0.4, m4: 0.3 };
    const out = makeOutputBuffer();

    const fromStep = physics.step(state, motors, DT);
    // Reset motor model so stepInto starts from same state
    const physics2 = new DronePhysics(DEFAULT_DRONE_CONFIG);
    physics2.stepInto(state, motors, DT, 0, out);

    expect(out.position.x).toBeCloseTo(fromStep.position.x);
    expect(out.position.y).toBeCloseTo(fromStep.position.y);
    expect(out.position.z).toBeCloseTo(fromStep.position.z);
    expect(out.velocity.z).toBeCloseTo(fromStep.velocity.z, 3);
  });

  it("ping-pong pattern works correctly (no corruption)", () => {
    const physics = new DronePhysics(DEFAULT_DRONE_CONFIG);
    let bufA = createDefaultDroneState(10);
    let bufB = makeOutputBuffer();
    const motors: MotorCommands = { m1: 0.35, m2: 0.35, m3: 0.35, m4: 0.35 };

    // Simulate 100 steps with ping-pong
    for (let i = 0; i < 100; i++) {
      physics.stepInto(bufA, motors, DT, 0, bufB);
      const tmp = bufA;
      bufA = bufB;
      bufB = tmp;
    }

    // Drone should still be roughly at hover altitude
    expect(bufA.position.z).toBeGreaterThan(5);
    expect(bufA.position.z).toBeLessThan(15);
    // Should not have NaN
    expect(Number.isFinite(bufA.position.z)).toBe(true);
    expect(Number.isFinite(bufA.velocity.z)).toBe(true);
  });

  it("respects dynamic groundHeight parameter", () => {
    const physics = new DronePhysics(DEFAULT_DRONE_CONFIG);
    let state = createDefaultDroneState(5);
    const zeroMotors: MotorCommands = { m1: 0, m2: 0, m3: 0, m4: 0 };
    const out = makeOutputBuffer();

    // Ground at 3m — drone should land there, not at 0
    for (let i = 0; i < 1000; i++) {
      physics.stepInto(state, zeroMotors, DT, 3, out);
      const tmp = state;
      state = out;
      out.position = tmp.position;
      out.velocity = tmp.velocity;
      out.quaternion = tmp.quaternion;
      out.angularVelocity = tmp.angularVelocity;
    }

    expect(state.position.z).toBeCloseTo(3, 0);
  });

  it("gravity causes downward acceleration", () => {
    const physics = new DronePhysics(DEFAULT_DRONE_CONFIG);
    const state = createDefaultDroneState(100);
    const zeroMotors: MotorCommands = { m1: 0, m2: 0, m3: 0, m4: 0 };
    const out = makeOutputBuffer();

    physics.stepInto(state, zeroMotors, DT, 0, out);

    // After one step, velocity.z should be negative (falling)
    expect(out.velocity.z).toBeLessThan(0);
    // Expected: v ≈ -g * dt ≈ -0.0196
    expect(out.velocity.z).toBeCloseTo(-9.81 * DT, 2);
  });
});
