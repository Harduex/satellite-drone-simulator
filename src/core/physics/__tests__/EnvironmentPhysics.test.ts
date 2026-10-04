import { describe, expect, it } from "vitest";
import { DronePhysics } from "../DronePhysics";
import { DEFAULT_DRONE_CONFIG } from "../droneConfig";
import { createDefaultDroneState, type Vector3 } from "../types";
import { WindModel } from "../WindModel";

const DT = 0.002;
const OFF = { m1: 0, m2: 0, m3: 0, m4: 0 };

describe("air-relative physics", () => {
  it("keeps ten seconds of hands-off hover drift modest in gentle weather", () => {
    const config = { ...DEFAULT_DRONE_CONFIG };
    const physics = new DronePhysics(config);
    const wind = new WindModel();
    const air = { x: 0, y: 0, z: 0 };
    const rpm = Math.sqrt(config.mass * 9.81 / (4 * config.kT));
    const throttle = Math.pow(rpm / config.maxThrottleRpm, 1 / config.motorResponseExponent!);
    const motors = { m1: throttle, m2: throttle, m3: throttle, m4: throttle };
    for (let i = 0; i < 500; i++) physics.getMotorModel().update([throttle, throttle, throttle, throttle], DT);
    let state = createDefaultDroneState(100);
    for (let i = 0; i < 5000; i++) state = physics.step(state, motors, DT, 0, wind.updateInto(DT, air));
    const drift = Math.hypot(state.position.x, state.position.y);
    expect(drift).toBeGreaterThan(0.5);
    expect(drift).toBeLessThan(5);
    expect(Math.hypot(state.velocity.x, state.velocity.y)).toBeLessThan(1);
    expect(Math.abs(state.position.z - 100)).toBeLessThan(1);
  });

  it("slows momentum progressively, with more resistance into a headwind", () => {
    const coast = (windX: number) => {
      const physics = new DronePhysics({ ...DEFAULT_DRONE_CONFIG });
      let state = createDefaultDroneState(1000);
      state.velocity.x = 10;
      for (let i = 0; i < 2500; i++) state = physics.step(state, OFF, DT, 0, { x: windX, y: 0, z: 0 });
      return state.velocity.x;
    };
    const calm = coast(0);
    const headwind = coast(-1.5);
    const tailwind = coast(1.5);
    expect(headwind).toBeLessThan(calm);
    expect(tailwind).toBeGreaterThan(calm);
    expect(headwind).toBeGreaterThan(1);
    expect(tailwind).toBeLessThan(10);
  });

  it("has no frame drag when moving with the air", () => {
    const physics = new DronePhysics({ ...DEFAULT_DRONE_CONFIG });
    const state = createDefaultDroneState(100);
    state.velocity = { x: 6, y: -3, z: 0 };
    const next = physics.step(state, OFF, DT, 0, state.velocity);
    expect(next.velocity.x).toBe(6);
    expect(next.velocity.y).toBe(-3);
  });

  it("pushes a stationary drone downwind without arbitrary angular kicks", () => {
    const physics = new DronePhysics({ ...DEFAULT_DRONE_CONFIG });
    const next = physics.step(createDefaultDroneState(100), OFF, DT, 0, { x: 2, y: 0, z: 0 });
    expect(next.velocity.x).toBeGreaterThan(0);
    expect(next.angularVelocity).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("uses air-relative axial velocity for thrust as well as frame drag", () => {
    const config = { ...DEFAULT_DRONE_CONFIG, dragCoefficient: 0, rotorDragCoefficient: 0 };
    const full = { m1: 1, m2: 1, m3: 1, m4: 1 };
    const acceleration = (velocity: Vector3, wind: Vector3) => {
      const physics = new DronePhysics(config);
      for (let i = 0; i < 500; i++) physics.getMotorModel().update([1, 1, 1, 1], DT);
      const state = createDefaultDroneState(100);
      state.velocity = velocity;
      return (physics.step(state, full, DT, 0, wind).velocity.z - velocity.z) / DT;
    };
    const still = acceleration({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    const coMoving = acceleration({ x: 0, y: 0, z: 20 }, { x: 0, y: 0, z: 20 });
    expect(coMoving).toBeCloseTo(still, 8);
  });

  it("adds lateral rotor drag only while the propellers spin", () => {
    const config = { ...DEFAULT_DRONE_CONFIG, dragCoefficient: 0, rotorDragCoefficient: 0.025 };
    const state = createDefaultDroneState(100);
    state.velocity.x = 5;
    const physics = new DronePhysics(config);
    expect(physics.step(state, OFF, DT).velocity.x).toBe(5);
    for (let i = 0; i < 500; i++) physics.getMotorModel().update([0.15, 0.15, 0.15, 0.15], DT);
    const hover = { m1: 0.15, m2: 0.15, m3: 0.15, m4: 0.15 };
    expect(physics.step(state, hover, DT).velocity.x).toBeLessThan(5);
  });
});
