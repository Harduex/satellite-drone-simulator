import { expect, it } from 'vitest';
import { PedestrianSimulation } from '../PedestrianSimulation';
import { buildPedestrianGraph } from '../PedestrianGraph';
const graphAt = (x = 0) => buildPedestrianGraph(Array.from({ length: 12 }, (_, i) => ({ id: String(i), pathClass: 'footway' as const, points: [{ x, y: i * 10, z: 5 }, { x: x + 300, y: i * 10, z: 5 }] })), { x, y: 0, z: 0 });
it('populates a 300-metre path with 26 people and keeps spawn separation', () => {
    const sim = new PedestrianSimulation();
    sim.setGraph(buildPedestrianGraph([{ id: 'density', pathClass: 'footway', points: [{ x: -150, y: 0, z: 5 }, { x: 150, y: 0, z: 5 }] }], { x: 0, y: 0, z: 0 }));
    for (let i = 0; i < 10; i++) sim.step(.1);
    const people = sim.getFrames();
    expect(people).toHaveLength(26);
    sim.reset({ x: 0, y: 0, z: 0 });
    sim.setGraph(graphAt());
    const spawned = sim.getFrames();
    for (let i = 0; i < spawned.length; i++)
        for (let j = i + 1; j < spawned.length; j++)
            expect(Math.hypot(spawned[i]!.current.position.x - spawned[j]!.current.position.x, spawned[i]!.current.position.y - spawned[j]!.current.position.y)).toBeGreaterThanOrEqual(2);
});
it('bounds people, maintains height and advances walked distance deterministically', () => {
    const a = new PedestrianSimulation(), b = new PedestrianSimulation();
    for (const sim of [a, b]) {
        sim.setGraph(graphAt());
        for (let i = 0; i < 100; i++)
            sim.step(.1);
    }
    expect(a.getFrames()).toEqual(b.getFrames());
    expect(a.getFrames().length).toBeGreaterThan(0);
    expect(a.getFrames()).toHaveLength(110);
    const before = a.getFrames().map(f => ({ id: f.id, walked: f.walked }));
    a.step(.1);
    for (const f of a.getFrames()) {
        expect(f.current.position.z).toBe(5);
        expect(Math.hypot(f.current.position.x, f.current.position.y)).toBeLessThanOrEqual(400);
        const old = before.find(p => p.id === f.id);
        if (old)
            expect(f.walked - old.walked).toBeLessThanOrEqual(.161);
    }
});
it('replaces the old area with nearby people after moving beyond coverage', () => {
    const sim = new PedestrianSimulation();
    sim.setGraph(graphAt());
    for (let i = 0; i < 100; i++)
        sim.step(.1);
    const oldIds = sim.getFrames().map(f => f.id);
    sim.setCenter({ x: 2500, y: 0, z: 0 });
    sim.setGraph(graphAt(2500));
    for (let i = 0; i < 100; i++)
        sim.step(.1);
    expect(sim.getFrames().length).toBeGreaterThan(0);
    for (const f of sim.getFrames()) {
        expect(oldIds).not.toContain(f.id);
        expect(Math.abs(f.current.position.x - 2500)).toBeLessThanOrEqual(400);
    }
    sim.reset({ x: 2500, y: 0, z: 0 });
    expect(sim.getFrames()).toHaveLength(0);
});
