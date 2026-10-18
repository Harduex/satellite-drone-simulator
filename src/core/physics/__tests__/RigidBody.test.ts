import { describe, expect, it } from "vitest";
import { DronePhysics } from "../DronePhysics";
import { DEFAULT_DRONE_CONFIG, createDefaultDroneState } from "../types";

const DT = 0.002;

describe("motor forces obey rigid-body mechanics", () => {
  // Independent physical geometry: x right, y forward, z up; spin viewed from above.
  it.each([
    ["m1", -1, 1, 1],
    ["m2", 1, 1, -1],
    ["m3", 1, -1, 1],
    ["m4", -1, -1, -1],
  ] as const)("%s applies r cross F and opposite rotor reaction", (key, x, y, spin) => {
    const config = { ...DEFAULT_DRONE_CONFIG };
    const physics = new DronePhysics(config);
    const commands = { m1: 0, m2: 0, m3: 0, m4: 0, [key]: 0.4 };
    const out = physics.step(createDefaultDroneState(100), commands, DT);
    const rpm = Math.max(...physics.getMotorModel().state.rpm);
    const thrust = config.kT * rpm ** 2;
    const offset = config.armLength / Math.sqrt(2);
    expect(out.angularVelocity.x / DT).toBeCloseTo(y * offset * thrust / config.inertia.xx, 10);
    expect.soft(out.angularVelocity.y / DT).toBeCloseTo(-x * offset * thrust / config.inertia.yy, 10);
    expect.soft(out.angularVelocity.z / DT).toBeCloseTo(-spin * config.kQ * rpm ** 2 / config.inertia.zz, 10);
  });

  it("uses the current arm length after a configuration update", () => {
    const physics = new DronePhysics({ ...DEFAULT_DRONE_CONFIG });
    const expected = new DronePhysics({ ...DEFAULT_DRONE_CONFIG, armLength: 0.15 });
    physics.updateConfig({ armLength: 0.15 });
    const commands = { m1: 0.4, m2: 0.4, m3: 0, m4: 0 };
    const state = createDefaultDroneState(100);
    expect(physics.step(state, commands, DT).angularVelocity.x)
      .toBeCloseTo(expected.step(state, commands, DT).angularVelocity.x, 10);
  });
});
