import { describe, expect, it } from "vitest";
import { DronePhysics } from "../DronePhysics";
import { MotorModel } from "../MotorModel";
import { DEFAULT_DRONE_CONFIG } from "../droneConfig";
import { createDefaultDroneState, type DroneState, type PhysicsConfig } from "../types";

const DT = 0.002;
const FULL = { m1: 1, m2: 1, m3: 1, m4: 1 };

/** Full throttle at a held nose-down attitude; returns final state after `seconds`. */
function holdAttitude(config: PhysicsConfig, pitchDeg: number, seconds: number): DroneState {
  const half = -pitchDeg * Math.PI / 360;
  const physics = new DronePhysics({ ...config });
  let state = createDefaultDroneState(1000);
  for (let step = 0; step < seconds / DT; step++) {
    state.quaternion = { w: Math.cos(half), x: Math.sin(half), y: 0, z: 0 };
    state.angularVelocity = { x: 0, y: 0, z: 0 };
    state = physics.step(state, FULL, DT, -1e9);
  }
  return state;
}

describe("reference 5-inch flight envelope", () => {
  // F60 Pro V 1750KV / T5147-3, manufacturer's 24.8–25.2 V static bench data:
  // https://www.ligpower.com/cn/product/f60prov-fpv-motor.html
  it.each([
    [0.2, 11132, 227.0],
    [0.4, 16928, 558.6],
    [0.6, 21409, 910.7],
    [0.8, 26122, 1403.4],
    [1.0, 30527, 1882.5],
  ])("matches bench RPM within 6%% and thrust within 10%% at command %f", (command, rpm, grams) => {
    const motor = new MotorModel({ ...DEFAULT_DRONE_CONFIG });
    const commands = [command, command, command, command];
    for (let step = 0; step < 500; step++) motor.update(commands, DT);
    const thrust = motor.update(commands, DT)[0]!;
    expect(Math.abs(motor.state.rpm[0]! / rpm! - 1)).toBeLessThan(0.06);
    expect(Math.abs(thrust / (grams! * 9.81 / 1000) - 1)).toBeLessThan(0.10);
  });

  it("hovers near 15% raw command with ~11:1 static thrust-to-weight", () => {
    const c = DEFAULT_DRONE_CONFIG;
    const hoverFraction = Math.sqrt(c.mass * 9.81 / (4 * c.kT)) / c.maxThrottleRpm;
    expect(Math.pow(hoverFraction, 1 / c.motorResponseExponent!)).toBeCloseTo(0.153, 2);
    expect(4 * c.kT * c.maxThrottleRpm ** 2 / (c.mass * 9.81)).toBeCloseTo(11.45, 1);
  });

  it("reaches roughly the advertised 190 km/h in sustained level flight", () => {
    let best = 0;
    for (const deg of [50, 55, 60, 65, 70]) {
      const state = holdAttitude(DEFAULT_DRONE_CONFIG, deg, 30);
      if (state.velocity.z > -2) best = Math.max(best, Math.hypot(state.velocity.x, state.velocity.y) * 3.6);
    }
    expect(best).toBeGreaterThan(170);
    expect(best).toBeLessThan(210);
  });

  it("loses thrust in axial climb but keeps static thrust when descending", () => {
    const physics = new DronePhysics({ ...DEFAULT_DRONE_CONFIG });
    const state = createDefaultDroneState(1000);
    const out = createDefaultDroneState(0);
    for (let step = 0; step < 500; step++) physics.getMotorModel().update([1, 1, 1, 1], DT);
    const accelAt = (vz: number) => {
      state.velocity = { x: 0, y: 0, z: vz };
      physics.stepInto(state, FULL, DT, -1e9, out);
      return (out.velocity.z - vz) / DT;
    };
    const descending = accelAt(-10);
    const hovering = accelAt(0);
    const climbing = accelAt(30);
    expect(climbing).toBeLessThan(hovering * 0.6);
    // Descent differs from hover only by drag, never by thrust loss.
    expect(descending).toBeGreaterThan(hovering);
  });

  it("keeps legacy static thrust when propeller pitch is omitted", () => {
    const { propellerPitch: _omit, ...legacy } = DEFAULT_DRONE_CONFIG;
    const withLoss = holdAttitude(DEFAULT_DRONE_CONFIG, 0, 3).velocity.z;
    const without = holdAttitude(legacy, 0, 3).velocity.z;
    expect(without).toBeGreaterThan(withLoss);
  });
});
