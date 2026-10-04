import { describe, expect, it } from "vitest";
import { DronePhysics } from "../DronePhysics";
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
