import { describe, expect, it } from 'vitest';
import { SurfaceContact, createContactPlane } from '../SurfaceContact';
import { createDefaultDroneState, DEFAULT_DRONE_CONFIG, quatFromEuler } from '../types';
import { DronePhysics } from '../DronePhysics';

describe('SurfaceContact', () => {
  it.each([[5, 0, true], [13, 0, false], [-1, 0, false], [5, 2, false]])(
    'bounds a facade vertically and laterally at z=%s y=%s', (height, y, blocked) => {
      const solver = new SurfaceContact(DEFAULT_DRONE_CONFIG);
      const wall = createContactPlane(1, 0, 11, -1, 0, 0, 1);
      wall.minZ = 0; wall.maxZ = 12;
      const before = createDefaultDroneState({ x: 0, y, z: height });
      const after = createDefaultDroneState({ x: 2, y, z: height });
      after.velocity.x = 20;
      expect(solver.resolve(before, after, [wall], 0.1).touching).toBe(blocked);
      if (blocked) expect(after.position.x).toBeLessThan(1);
      else expect(after.position.x).toBe(2);
    });

  it('produces a realistic bounded rotational kick on a 28 m/s wall hit without flipping onto the top face', () => {
    const solver = new SurfaceContact(DEFAULT_DRONE_CONFIG);
    const physics = new DronePhysics(DEFAULT_DRONE_CONFIG);
    const wall = createContactPlane(1, 0, 5, -1, 0, 0, 5);
    wall.minZ = 0; wall.maxZ = 12;
    let state = createDefaultDroneState({ x: 0.78, y: 0, z: 5 });
    state.quaternion = quatFromEuler(0, -30 * Math.PI / 180, 0);
    state.velocity = { x: 28, y: 4, z: 6 };
    let buffer = createDefaultDroneState(0);
    const motors = { m1: 0.45, m2: 0.45, m3: 0.45, m4: 0.45 };
    let maxOmega = 0;
    for (let i = 0; i < 500; i++) {
      physics.stepInto(state, motors, 0.002, 0, buffer, undefined, false);
      solver.resolve(state, buffer, [wall], 0.002);
      const tmp = state; state = buffer; buffer = tmp;
      maxOmega = Math.max(maxOmega, Math.hypot(
        state.angularVelocity.x, state.angularVelocity.y, state.angularVelocity.z));
    }
    expect(state.position.x).toBeLessThan(1);
    expect(maxOmega).toBeGreaterThan(2);
    expect(maxOmega).toBeLessThan(15);
    // Top face (+Z) must not lock flat into the +X wall (bodyZ.x < 0.9) and drone must rebound/fall
    const q = state.quaternion;
    const bodyZx = 2 * (q.x * q.z + q.w * q.y);
    expect(Math.abs(bodyZx)).toBeLessThan(0.9);
  });

  it.each([[0, 0], [0, 1.5], [0.1, 0], [0.1, 1.5]])('settles on a %s slope with %s m/s wind at zero throttle', (slope, windSpeed) => {
    const solver = new SurfaceContact(DEFAULT_DRONE_CONFIG);
    const physics = new DronePhysics(DEFAULT_DRONE_CONFIG);
    let state = createDefaultDroneState(0.15);
    state.quaternion = quatFromEuler(0.08, 0.05, 0);
    let buffer = createDefaultDroneState(0);
    const length = Math.hypot(slope, 1);
    const plane = createContactPlane(0, 0, 0, -slope / length, 0, 1 / length, 10);
    const motors = { m1: 0, m2: 0, m3: 0, m4: 0 };
    const wind = { x: 0.8 * windSpeed, y: 0.6 * windSpeed, z: 0 };
    let angularPeak = 0;
    for (let i = 0; i < 5000; i++) {
      physics.stepInto(state, motors, 0.002, 0, buffer, wind, false);
      solver.resolve(state, buffer, [plane], 0.002);
      const old = state; state = buffer; buffer = old;
      if (i > 4000) angularPeak = Math.max(angularPeak, Math.hypot(state.angularVelocity.x, state.angularVelocity.y));
    }
    expect(angularPeak).toBeLessThan(0.001);
  });
  it('rests on a shallow slope instead of creeping indefinitely', () => {
    const solver = new SurfaceContact(DEFAULT_DRONE_CONFIG);
    const physics = new DronePhysics(DEFAULT_DRONE_CONFIG);
    const angle = -Math.atan(0.1);
    let state = createDefaultDroneState(0.05 * Math.hypot(0.1, 1));
    state.quaternion = { w: Math.cos(angle / 2), x: 0, y: Math.sin(angle / 2), z: 0 };
    let buffer = createDefaultDroneState(0);
    const plane = createContactPlane(0, 0, 0, -0.1 / Math.hypot(0.1, 1), 0, 1 / Math.hypot(0.1, 1), 10);
    const motors = { m1: 0, m2: 0, m3: 0, m4: 0 };
    for (let i = 0; i < 1000; i++) {
      physics.stepInto(state, motors, 0.002, 0, buffer, undefined, false);
      solver.resolve(state, buffer, [plane], 0.002);
      const old = state; state = buffer; buffer = old;
    }
    expect(Math.abs(state.position.x)).toBeLessThan(0.02);
  });
  const floor = () => createContactPlane(0, 0, 0, 0, 0, 1, 10);
  it('supports a gentle touchdown without destroying tangential motion instantly', () => {
    const solver = new SurfaceContact(DEFAULT_DRONE_CONFIG);
    const before = createDefaultDroneState(0.06);
    before.velocity = { x: 1, y: 0, z: -0.3 };
    const after = createDefaultDroneState(0.04);
    after.velocity = { ...before.velocity };
    const result = solver.resolve(before, after, [floor()], 0.002);
    expect(result.supported).toBe(true);
    expect(result.impactSpeed).toBeLessThan(1);
    expect(after.position.z).toBeGreaterThanOrEqual(0.05);
    expect(after.velocity.x).toBeGreaterThan(0);
  });
  it('measures incoming speed before stopping a hard impact', () => {
    const solver = new SurfaceContact(DEFAULT_DRONE_CONFIG);
    const before = createDefaultDroneState(0.06);
    before.velocity.z = -10;
    const after = createDefaultDroneState(0.04);
    after.velocity.z = -10;
    expect(solver.resolve(before, after, [floor()], 0.002).impactSpeed).toBeGreaterThan(9);
    expect(after.velocity.z).toBeGreaterThanOrEqual(0);
  });
  it('blocks a swept wall hit while preserving falling and sliding', () => {
    const solver = new SurfaceContact(DEFAULT_DRONE_CONFIG);
    const before = createDefaultDroneState({ x: 0, y: 0, z: 3 });
    before.velocity = { x: 20, y: 2, z: -3 };
    const after = createDefaultDroneState({ x: 2, y: 0.2, z: 2.7 });
    after.velocity = { ...before.velocity };
    const wall = createContactPlane(1, 0, 0, -1, 0, 0, 10);
    const result = solver.resolve(before, after, [wall], 0.1);
    expect(result.impactSpeed).toBeGreaterThan(10);
    expect(after.position.x).toBeLessThan(1);
    expect(after.position.z).toBeCloseTo(2.7);
    expect(after.velocity.z).toBeLessThan(0);
  });
  it('leaves motion unchanged when geometry is absent', () => {
    const solver = new SurfaceContact(DEFAULT_DRONE_CONFIG);
    const before = createDefaultDroneState(2);
    const after = createDefaultDroneState(1);
    after.velocity.z = -4;
    expect(solver.resolve(before, after, [], 0.002).touching).toBe(false);
    expect(after.position.z).toBe(1);
    expect(after.velocity.z).toBe(-4);
  });
  it('allows takeoff from a supported surface', () => {
    const solver = new SurfaceContact(DEFAULT_DRONE_CONFIG);
    const before = createDefaultDroneState(0.05);
    const after = createDefaultDroneState(0.06);
    after.velocity.z = 1;
    solver.resolve(before, after, [floor()], 0.002);
    expect(after.position.z).toBe(0.06);
    expect(after.velocity.z).toBe(1);
  });
  it('does not push a body already enclosed by newly loaded geometry onto a roof', () => {
    const solver = new SurfaceContact(DEFAULT_DRONE_CONFIG);
    const before = createDefaultDroneState(3);
    const after = createDefaultDroneState(2.99);
    const roof = createContactPlane(0, 0, 20, 0, 0, 1, 10);
    solver.resolve(before, after, [roof], 0.002);
    expect(after.position.z).toBe(2.99);
  });
});
