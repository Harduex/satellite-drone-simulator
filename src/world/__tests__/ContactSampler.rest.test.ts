import { expect, it, vi } from 'vitest';
import { ContactSampler } from '../ContactSampler';
import type { SurfaceObservation, TerrainSampler } from '../TerrainSampler';
import { DronePhysics } from '../../core/physics/DronePhysics';
import { SurfaceContact } from '../../core/physics/SurfaceContact';
import { createDefaultDroneState, DEFAULT_DRONE_CONFIG, quatFromEuler, type Vector3 } from '../../core/physics/types';

it('keeps a coherent resting surface while costly footprint queries refresh separately', () => {
  let clock = 0;
  let available = true;
  const timer = vi.spyOn(performance, 'now').mockImplementation(() => clock);
  try {
    const sampler = new ContactSampler({ sampleSurfaceInto: (p: Vector3, out: SurfaceObservation) => {
      clock += 10;
      out.height = available ? 0.12 * p.x + 0.06 * p.y : NaN;
      out.source = available ? 'tiles' : 'unknown';
    } } as unknown as TerrainSampler);
    const physics = new DronePhysics(DEFAULT_DRONE_CONFIG);
    const contacts = new SurfaceContact(DEFAULT_DRONE_CONFIG);
    const radius = DEFAULT_DRONE_CONFIG.armLength + (DEFAULT_DRONE_CONFIG.rotorDiameter ?? 0.13) / 2;
    const motors = { m1: 0, m2: 0, m3: 0, m4: 0 };
    let state = createDefaultDroneState(0.12);
    state.quaternion = quatFromEuler(0.08, 0.05, 0);
    let buffer = createDefaultDroneState(0);
    let peakAngularSpeed = 0;
    let accumulator = 0;
    for (let frame = 0; frame < 600; frame++) {
      const planes = sampler.prepare(state, radius, 1 / 60, frame / 60);
      accumulator += 1 / 60;
      while (accumulator >= 0.002) {
        physics.stepInto(state, motors, 0.002, sampler.groundHeight ?? 0, buffer, undefined, false);
        contacts.resolve(state, buffer, planes, 0.002);
        const old = state; state = buffer; buffer = old;
        accumulator -= 0.002;
      }
      if (frame > 480) peakAngularSpeed = Math.max(peakAngularSpeed, Math.hypot(state.angularVelocity.x, state.angularVelocity.y));
    }
    expect(peakAngularSpeed).toBeLessThan(0.001);
    available = false;
    for (let frame = 600; frame < 660; frame++) sampler.prepare(state, radius, 1 / 60, frame / 60);
    expect(sampler.planes).toHaveLength(0);
  } finally { timer.mockRestore(); }
});
