import { describe, expect, it, vi } from 'vitest';
import { ContactSampler } from '../ContactSampler';
import type { TerrainSampler, SurfaceObservation } from '../TerrainSampler';
import { createDefaultDroneState, type Vector3 } from '../../core/physics/types';
import { SurfaceContact } from '../../core/physics/SurfaceContact';
import { DEFAULT_DRONE_CONFIG } from '../../core/physics/types';

function makeSampler(height: (position: Vector3) => number | null) {
  const query = vi.fn((position: Vector3, out: SurfaceObservation) => {
    const value = height(position);
    out.height = value ?? NaN;
    out.source = value === null ? 'unknown' : 'tiles';
  });
  return { sampler: new ContactSampler({ sampleSurfaceInto: query } as unknown as TerrainSampler), query };
}

describe('ContactSampler', () => {
  it.each([0, 10])('keeps a facade solid while sliding down below a high impact with %s ms queries', cost => {
    let clock = 0;
    const timer = vi.spyOn(performance, 'now').mockImplementation(() => clock);
    try {
      const { sampler, query } = makeSampler(p => { clock += cost; return p.x >= 1 ? 12 : 0; });
      const solver = new SurfaceContact(DEFAULT_DRONE_CONFIG);
      let state = createDefaultDroneState(11);
      state.velocity.x = 5;
      for (let frame = 0; frame < 30; frame++) sampler.prepare(state, 0.18, 1 / 60, frame / 60);
      expect(sampler.planes.some(p => p.normal.z === 0)).toBe(true);
      for (let frame = 30; frame < 210; frame++) {
        query.mockClear();
        state.velocity.x = 1; state.velocity.z = -3;
        const next = createDefaultDroneState({ x: state.position.x + 1 / 60, y: 0, z: state.position.z - 3 / 60 });
        next.velocity = { ...state.velocity };
        solver.resolve(state, next, sampler.prepare(state, 0.18, 1 / 60, frame / 60), 1 / 60);
        expect(query.mock.calls.length).toBeLessThanOrEqual(cost > 3 ? 1 : 2);
        expect(next.position.x).toBeLessThan(1);
        state = next;
      }
      expect(state.position.z).toBeLessThan(3);
    } finally { timer.mockRestore(); }
  });

  it('blocks an oblique approach after glancing along a wall instead of breaching and falling below the map', () => {
    const { sampler } = makeSampler(p => p.x >= 1 ? 12 : 0);
    const solver = new SurfaceContact(DEFAULT_DRONE_CONFIG);
    let state = createDefaultDroneState(5);
    state.velocity = { x: 8, y: 2, z: 0 };
    for (let frame = 0; frame < 15; frame++) sampler.prepare(state, 0.18, 1 / 60, frame / 60);
    // Glancing deflection briefly turns velocity away/along the wall, then thrust pushes back into the wall
    state.velocity = { x: -1.5, y: 2, z: -1 };
    sampler.prepare(state, 0.18, 1 / 60, 15 / 60);
    for (let frame = 16; frame < 90; frame++) {
      state.velocity = { x: 6, y: 2, z: -2 };
      const next = createDefaultDroneState({
        x: state.position.x + state.velocity.x / 60,
        y: state.position.y + state.velocity.y / 60,
        z: state.position.z + state.velocity.z / 60,
      });
      next.velocity = { ...state.velocity };
      solver.resolve(state, next, sampler.prepare(state, 0.18, 1 / 60, frame / 60), 1 / 60);
      state = next;
    }
    expect(state.position.x).toBeLessThan(1);
    expect(state.position.z).toBeGreaterThanOrEqual(0);
  });

  it('never drops below ground level even if a fast step enters a building interior', () => {
    const { sampler } = makeSampler(p => p.x >= 1 ? 12 : 0);
    const solver = new SurfaceContact(DEFAULT_DRONE_CONFIG);
    let state = createDefaultDroneState(1);
    state.velocity = { x: 10, y: 0, z: -5 };
    sampler.prepare(state, 0.18, 1 / 60, 0);
    // Simulate a frame stall / tunneling step inside x >= 1
    state.position = { x: 1.5, y: 0, z: 0.2 };
    for (let frame = 1; frame < 60; frame++) {
      state.velocity = { x: 0, y: 0, z: -5 };
      const next = createDefaultDroneState({
        x: state.position.x,
        y: state.position.y,
        z: state.position.z - 5 / 60,
      });
      next.velocity = { ...state.velocity };
      solver.resolve(state, next, sampler.prepare(state, 0.18, 1 / 60, frame / 60), 1 / 60);
      state = next;
    }
    expect(state.position.z).toBeGreaterThanOrEqual(0);
  });

  it('keeps the camera outside a facade lying before the coarse bracket midpoint', () => {
    const { sampler } = makeSampler(p => p.x >= 0.5 ? 12 : 0);
    const solver = new SurfaceContact(DEFAULT_DRONE_CONFIG);
    let state = createDefaultDroneState(2);
    for (let frame = 0; frame < 60; frame++) {
      state.velocity.x = 10;
      const next = createDefaultDroneState({ x: state.position.x + 10 / 60, y: 0, z: 2 });
      next.velocity.x = 10;
      solver.resolve(state, next, sampler.prepare(state, 0.18, 1 / 60, frame / 60), 1 / 60);
      expect(next.position.x).toBeLessThan(0.5);
      state = next;
    }
  });

  it.each([0, 10])('refines an uncertain wall within the query budget with %s ms queries', cost => {
    let clock = 0;
    const timer = vi.spyOn(performance, 'now').mockImplementation(() => clock);
    try {
      const { sampler, query } = makeSampler(p => { clock += cost; return p.x >= 1 ? 12 : 0; });
      const state = createDefaultDroneState(2);
      state.velocity.x = 10;
      for (let frame = 0; frame < 90; frame++) {
        query.mockClear();
        sampler.prepare(state, 0.18, 1 / 60, frame / 60);
        expect(query.mock.calls.length).toBeLessThanOrEqual(cost > 3 ? 1 : 2);
      }
      const wall = sampler.planes.find(p => p.normal.z === 0)!;
      expect(wall.point.x).toBeGreaterThanOrEqual(0.75);
      expect(wall.point.x).toBeLessThan(1);
    } finally { timer.mockRestore(); }
  });

  it('retains a resting roof briefly when tile queries fall back to globe terrain', () => {
    let tiles = true;
    const sampler = new ContactSampler({ sampleSurfaceInto: (_p: Vector3, out: SurfaceObservation) => {
      out.height = tiles ? 20 : 0; out.source = tiles ? 'tiles' : 'terrain';
    } } as unknown as TerrainSampler);
    const state = createDefaultDroneState(20.05);
    sampler.prepare(state, 0.18, 0.02, 0);
    tiles = false;
    expect(sampler.prepare(state, 0.18, 0.02, 0.3).some(p => p.point.z === 20)).toBe(true);
    expect(sampler.prepare(state, 0.18, 0.02, 0.8).some(p => p.point.z === 20)).toBe(false);
  });
  it('supports a fast touchdown at the observed endpoint', () => {
    const { sampler } = makeSampler(() => 0);
    const solver = new SurfaceContact(DEFAULT_DRONE_CONFIG);
    const before = createDefaultDroneState(0.06);
    before.velocity = { x: 50, y: 0, z: -0.3 };
    const planes = sampler.prepare(before, 0.18, 0.02, 0);
    const after = createDefaultDroneState({ x: 1, y: 0, z: 0.04 });
    after.velocity = { ...before.velocity };
    expect(solver.resolve(before, after, planes, 0.02).supported).toBe(true);
  });

  it('catches a steep high-speed ground dive even when touchdown falls between 50ms query refreshes', () => {
    const { sampler } = makeSampler(() => 0);
    const solver = new SurfaceContact(DEFAULT_DRONE_CONFIG);
    let state = createDefaultDroneState({ x: 0, y: 0, z: 0.8 });
    state.velocity = { x: 0, y: 22.7, z: -25.8 };
    for (let frame = 0; frame < 20; frame++) {
      const planes = sampler.prepare(state, 0.18, 1 / 60, frame / 60);
      for (let step = 0; step < 8; step++) {
        const next = createDefaultDroneState({
          x: state.position.x + state.velocity.x * 0.002,
          y: state.position.y + state.velocity.y * 0.002,
          z: state.position.z + state.velocity.z * 0.002,
        });
        next.velocity = { ...state.velocity };
        solver.resolve(state, next, planes, 0.002);
        state = next;
      }
    }
    expect(state.position.z).toBeGreaterThanOrEqual(0);
  });
  it.each([0, 0.2])('stabilizes every support point during refinement at %sm/s', speed => {
    let height = 0;
    const { sampler } = makeSampler(() => height);
    const state = createDefaultDroneState(0.05);
    state.velocity.x = speed;
    sampler.prepare(state, 0.18, 0.02, 0);
    height = 0.29;
    const planes = sampler.prepare(state, 0.18, 0.02, 0.3);
    expect(Math.max(...planes.map(p => p.point.z))).toBeLessThan(0.01);
  });
  it('does not certify recovery using terrain without building geometry', () => {
    const sampler = new ContactSampler({ sampleSurfaceInto: (_p: Vector3, out: SurfaceObservation) => {
      out.height = 0; out.source = 'terrain';
    } } as unknown as TerrainSampler);
    expect(sampler.findClearPosition({ x: 0, y: 0, z: 2 }, 0.18, { x: 0, y: 0, z: 0 })).toBe(false);
  });
  it('does not invent a floor or wall from absent geometry', () => {
    const { sampler } = makeSampler(() => null);
    const state = createDefaultDroneState(2);
    state.velocity.x = 10;
    expect(sampler.prepare(state, 0.18, 0.1, 0)).toHaveLength(0);
    expect(sampler.groundHeight).toBeNull();
  });
  it('requires observations across the entire recovery footprint', () => {
    const { sampler } = makeSampler(p => p.x > 0 ? null : 0);
    expect(sampler.findClearPosition({ x: 0, y: 0, z: 2 }, 0.18, { x: 0, y: 0, z: 0 })).toBe(false);
  });
  it('ignores a roof loaded around an already enclosed drone', () => {
    const { sampler } = makeSampler(() => 20);
    const state = createDefaultDroneState(3);
    state.velocity.x = 10;
    expect(sampler.prepare(state, 0.18, 0.1, 0)).toHaveLength(0);
    expect(sampler.overlap).toBe(true);
  });
  it('stops querying after a single height query exceeds the time budget', () => {
    let clock = 0;
    const timer = vi.spyOn(performance, 'now').mockImplementation(() => clock);
    try {
      const { sampler, query } = makeSampler(() => { clock += 10; return 0; });
      const state = createDefaultDroneState(0.06);
      state.velocity.x = 50;
      const planes = sampler.prepare(state, 0.18, 0.1, 0);
      expect(query).toHaveBeenCalledTimes(1);
      expect(planes.some(p => p.normal.z > 0.5)).toBe(true);
    } finally { timer.mockRestore(); }
  });

  it.each([1 / 60, 1 / 30, 0.1])('bounds landing queries at a %s second frame horizon', horizon => {
    const { sampler, query } = makeSampler(() => 0);
    const state = createDefaultDroneState(0.06);
    state.velocity.x = 50;
    for (let frame = 0; frame < 30; frame++) {
      query.mockClear();
      state.position.x = 50 * frame * horizon;
      sampler.prepare(state, 0.18, horizon, frame * horizon);
      expect(query.mock.calls.length).toBeLessThanOrEqual(2);
    }
  });

  it('bounds new queries during high airborne travel', () => {
    const { sampler, query } = makeSampler(() => 0);
    const state = createDefaultDroneState(10);
    state.velocity.x = 36;
    sampler.prepare(state, 0.18, 0.1, 0);
    expect(query.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('bounds wall and center refreshes while moving', () => {
    const { sampler, query } = makeSampler(() => 0);
    const state = createDefaultDroneState(10);
    state.velocity.x = 36;
    for (let frame = 0; frame < 60; frame++) {
      state.position.x = 36 * frame / 60;
      sampler.prepare(state, 0.18, 1 / 60, frame / 60);
    }
    expect(query.mock.calls.length).toBeLessThanOrEqual(40);
  });

  it('keeps a recently observed nearby floor between refreshes', () => {
    const { sampler } = makeSampler(() => 0);
    const before = createDefaultDroneState(0.06);
    sampler.prepare(before, 0.18, 0.02, 0);
    before.position.x = 0.2;
    const after = createDefaultDroneState({ x: 0.2, y: 0, z: 0.04 });
    after.velocity.z = -0.3;
    expect(new SurfaceContact(DEFAULT_DRONE_CONFIG).resolve(before, after,
      sampler.prepare(before, 0.18, 0.02, 0.02), 0.002).supported).toBe(true);
  });

  it.each([0, 10])('keeps an observed wall solid under pressure with %s ms height queries', cost => {
    let clock = 0;
    const timer = vi.spyOn(performance, 'now').mockImplementation(() => clock);
    try {
      const { sampler, query } = makeSampler(p => { clock += cost; return p.x >= 3 ? 12 : 0; });
      const solver = new SurfaceContact(DEFAULT_DRONE_CONFIG);
      let state = createDefaultDroneState(2);
      let contacts = 0;
      for (let frame = 0; frame < 180; frame++) {
        query.mockClear();
        state.velocity.x = 10;
        const next = createDefaultDroneState({ x: state.position.x + 10 / 60, y: 0, z: 2 });
        next.velocity.x = 10;
        const contact = solver.resolve(state, next, sampler.prepare(state, 0.18, 1 / 60, frame / 60), 1 / 60);
        if (contact.touching) contacts++;
        expect(query.mock.calls.length).toBeLessThanOrEqual(cost > 3 ? 1 : 2);
        state = next;
      }
      expect(contacts).toBeGreaterThan(100);
      expect(state.position.x).toBeLessThan(3);
    } finally { timer.mockRestore(); }
  });

  it('drops a retained wall when fresh observations become clear', () => {
    let wall = true;
    const { sampler } = makeSampler(p => wall && p.x >= 1 ? 12 : 0);
    const state = createDefaultDroneState(2);
    state.velocity.x = 10;
    for (let frame = 0; frame < 20; frame++) sampler.prepare(state, 0.18, 1 / 60, frame / 60);
    expect(sampler.planes.some(p => p.normal.z === 0)).toBe(true);
    wall = false;
    for (let frame = 20; frame < 80; frame++) sampler.prepare(state, 0.18, 1 / 60, frame / 60);
    expect(sampler.planes.some(p => p.normal.z === 0)).toBe(false);
  });

  it('probes side lanes when the center stays clear', () => {
    const { sampler } = makeSampler(p => p.x >= 1 && p.y >= 0.1 ? 12 : 0);
    const state = createDefaultDroneState(2);
    state.velocity.x = 10;
    let wall = false;
    for (let frame = 0; frame < 30; frame++) {
      wall ||= sampler.prepare(state, 0.18, 1 / 60, frame / 60).some(p => p.normal.z === 0);
    }
    expect(wall).toBe(true);
  });

  it('retains a stopped contact without requiring movement to refresh it', () => {
    const { sampler } = makeSampler(p => p.x >= 1 ? 12 : 0);
    const state = createDefaultDroneState(2);
    state.velocity.x = 10;
    for (let frame = 0; frame < 20; frame++) sampler.prepare(state, 0.18, 1 / 60, frame / 60);
    state.velocity.x = 0;
    for (let frame = 20; frame < 180; frame++) {
      expect(sampler.prepare(state, 0.18, 1 / 60, frame / 60).some(p => p.normal.z === 0)).toBe(true);
    }
    sampler.reset();
    expect(sampler.prepare(state, 0.18, 1 / 60, 3).some(p => p.normal.z === 0)).toBe(false);
  });

  it('discovers another wall after leaving the old finite contact patch', () => {
    const { sampler } = makeSampler(p => p.x >= 1 ? 12 : 0);
    const state = createDefaultDroneState(2);
    state.velocity.x = 10;
    for (let frame = 0; frame < 20; frame++) sampler.prepare(state, 0.18, 1 / 60, frame / 60);
    expect(sampler.planes.some(p => p.normal.z === 0 && Math.abs(p.point.y) < 1)).toBe(true);
    state.position.y = 30;
    for (let frame = 20; frame < 100; frame++) sampler.prepare(state, 0.18, 1 / 60, frame / 60);
    expect(sampler.planes.some(p => p.normal.z === 0 && Math.abs(p.point.y - 30) < 1)).toBe(true);
  });

  it('discovers a perpendicular wall after turning along an existing wall', () => {
    const { sampler } = makeSampler(p => p.x >= 1 || p.y >= 3 ? 12 : 0);
    const state = createDefaultDroneState(2);
    state.velocity.x = 10;
    for (let frame = 0; frame < 20; frame++) sampler.prepare(state, 0.18, 1 / 60, frame / 60);
    expect(sampler.planes.some(p => p.normal.x < -0.5)).toBe(true);
    state.position.y = 2;
    state.velocity.x = 0; state.velocity.y = 10;
    for (let frame = 20; frame < 100; frame++) sampler.prepare(state, 0.18, 1 / 60, frame / 60);
    expect(sampler.planes.some(p => p.normal.y < -0.5)).toBe(true);
  });

  it.each([0, 10])('blocks a broad wall during a fast approach with %s ms queries', cost => {
    let clock = 0;
    const timer = vi.spyOn(performance, 'now').mockImplementation(() => clock);
    try {
      const { sampler } = makeSampler(p => { clock += cost; return p.x >= 8 ? 20 : 0; });
      const solver = new SurfaceContact(DEFAULT_DRONE_CONFIG);
      let state = createDefaultDroneState(2);
      let collided = false;
      for (let frame = 0; frame < 60; frame++) {
        state.velocity.x = 50;
        const next = createDefaultDroneState({ x: state.position.x + 50 / 60, y: 0, z: 2 });
        next.velocity.x = 50;
        const contact = solver.resolve(state, next,
          sampler.prepare(state, 0.18, 1 / 60, frame / 60), 1 / 60);
        collided ||= contact.touching;
        state = next;
      }
      expect(collided).toBe(true);
      expect(state.position.x).toBeLessThan(8.25);
    } finally { timer.mockRestore(); }
  });

  it('drops a retained wall when its observations become unknown', () => {
    let known = true;
    const { sampler } = makeSampler(p => known ? (p.x >= 1 ? 12 : 0) : null);
    const state = createDefaultDroneState(2);
    state.velocity.x = 10;
    for (let frame = 0; frame < 20; frame++) sampler.prepare(state, 0.18, 1 / 60, frame / 60);
    expect(sampler.planes.some(p => p.normal.z === 0)).toBe(true);
    known = false;
    for (let frame = 20; frame < 80; frame++) sampler.prepare(state, 0.18, 1 / 60, frame / 60);
    expect(sampler.planes.some(p => p.normal.z === 0)).toBe(false);
  });

  it('does not retain a wall after climbing above its roof', () => {
    const { sampler } = makeSampler(p => p.x >= 1 ? 12 : 0);
    const state = createDefaultDroneState(2);
    state.velocity.x = 10;
    for (let frame = 0; frame < 20; frame++) sampler.prepare(state, 0.18, 1 / 60, frame / 60);
    expect(sampler.planes.some(p => p.normal.z === 0)).toBe(true);
    state.position.z = 15;
    expect(sampler.prepare(state, 0.18, 1 / 60, 0.4).some(p => p.normal.z === 0)).toBe(false);
  });

  it('does not invent support across an unobserved gap', () => {
    const { sampler } = makeSampler(p => p.x < 0.5 ? 0 : null);
    const before = createDefaultDroneState(0.06);
    before.velocity.x = 50;
    const after = createDefaultDroneState({ x: 1, y: 0, z: 0.04 });
    after.velocity.x = 50;
    expect(new SurfaceContact(DEFAULT_DRONE_CONFIG).resolve(before, after,
      sampler.prepare(before, 0.18, 0.02, 0), 0.002).touching).toBe(false);
  });

  it('amortizes footprint sampling while fitting an inclined support plane', () => {
    const { sampler, query } = makeSampler(p => p.x * 0.4);
    const state = createDefaultDroneState(0.2);
    for (let frame = 0; frame < 3; frame++) {
      query.mockClear();
      sampler.prepare(state, 0.18, 0.02, frame * 0.05);
      expect(query.mock.calls.length).toBeLessThanOrEqual(2);
    }
    expect(sampler.planes).toHaveLength(1);
    expect(sampler.planes[0]!.normal.x).toBeCloseTo(-0.4 / Math.hypot(0.4, 1));
  });
});
