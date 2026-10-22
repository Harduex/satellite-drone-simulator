import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BirdSimulation } from '../BirdSimulation';
import { SPECIES_CONFIGS } from '../BirdConfig';

afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  let seed = 73;
  vi.spyOn(Math, 'random').mockImplementation(() => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296));
});
const origin = { x: 0, y: 0, z: 100 };

it('mixes swallow flocks and isolated solo flyers within thirty birds', () => {
  const sim = new BirdSimulation();
  sim.spawnFlocks(origin);
  const birds = sim.getBirds();
  expect(birds).toHaveLength(30);
  expect(birds.filter(b => b.species === 'swallow')).toHaveLength(10);
  const solos = birds.filter(b => b.species !== 'eagle' && birds.filter(n => n.flockId === b.flockId).length === 1);
  expect(solos.map(b => b.species).sort()).toEqual(['pigeon', 'seagull', 'swallow']);
  expect(new Set(solos.map(b => b.flockId)).size).toBe(3);
});

it('distributes encounters across bearings instead of placing all birds north', () => {
  let seed = 71;
  vi.spyOn(Math, 'random').mockImplementation(() => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296));
  const sim = new BirdSimulation();
  sim.spawnFlocks(origin);
  const birds = sim.getBirds();
  expect(birds.some(b => b.position.y < 0)).toBe(true);
  expect(birds.some(b => b.position.y > 0)).toBe(true);
  expect(birds.some(b => b.position.x < 0)).toBe(true);
  expect(birds.some(b => b.position.x > 0)).toBe(true);
});

it('replaces only distant hidden encounters and preserves a visible chase target', () => {
  const sim = new BirdSimulation();
  sim.spawnFlocks(origin);
  const before = [...sim.getBirds()];
  const target = before[0]!;
  const visible = (point: typeof origin) => point.x === target.position.x && point.y === target.position.y;
  const center = { x: 3000, y: 0, z: 100 };
  sim.maintainPopulation(center, visible);
  expect(sim.getBirds()).toContain(target);
  const added = sim.getBirds().filter(b => !before.includes(b));
  expect(added.length).toBeGreaterThan(0);
  expect(added.length).toBeLessThan(30);
  for (const bird of added) expect(Math.hypot(bird.position.x - center.x, bird.position.y - center.y)).toBeLessThan(500);
  expect(sim.getBirds()).toHaveLength(30);
  const frames = sim.getFrames();
  for (const bird of added) {
    const frame = frames.find(f => f.id === bird.id)!;
    expect(frame.previous).toEqual(frame.current);
  }
});

it('defers all turnover when it would remove or spawn visible birds', () => {
  const sim = new BirdSimulation();
  sim.spawnFlocks(origin);
  const ids = sim.getBirds().map(b => b.id);
  sim.maintainPopulation({ x: 4000, y: 0, z: 100 }, () => true);
  expect(sim.getBirds().map(b => b.id)).toEqual(ids);
});

it('replenishes repeatedly along the flight route without leaking population or IDs', () => {
  const sim = new BirdSimulation();
  sim.spawnFlocks(origin);
  for (let x = 1000; x <= 10000; x += 1000) {
    const center = { x, y: 0, z: 100 };
    for (let i = 0; i < 10; i++) sim.maintainPopulation(center, () => false);
    expect(sim.getBirds()).toHaveLength(30);
    expect(new Set(sim.getBirds().map(b => b.id)).size).toBe(30);
    for (const bird of sim.getBirds()) expect(Math.hypot(bird.position.x - x, bird.position.y)).toBeLessThan(650);
  }
});

it('refreshes hidden encounters after a large climb as well as horizontal travel', () => {
  const sim = new BirdSimulation();
  sim.spawnFlocks(origin);
  const center = { ...origin, z: 2100 };
  for (let i = 0; i < 10; i++) sim.maintainPopulation(center, () => false);
  for (const bird of sim.getBirds()) expect(Math.abs(bird.position.z - center.z)).toBeLessThan(200);
});

it('propagates a flock alarm over time beyond the direct threat radius', () => {
  const sim = new BirdSimulation();
  sim.spawnFlocks(origin);
  const [source, neighbor] = sim.getBirds();
  for (const bird of sim.getBirds()) bird.position = { x: 2000, y: 0, z: 100 };
  source!.position = { x: 0, y: 0, z: 100 };
  neighbor!.position = { x: 10, y: 0, z: 100 };
  const drone = { x: -54, y: 0, z: 100 };
  sim.step(.1, drone);
  expect(source!.panicTimer).toBeGreaterThan(0);
  expect(neighbor!.panicTimer).toBe(0);
  for (let i = 0; i < 5; i++) sim.step(.1, drone);
  expect(neighbor!.panicTimer).toBeGreaterThan(0);
});

it('bounds every species turning rate and recovers after a close approach', () => {
  const sim = new BirdSimulation();
  sim.spawnFlocks(origin);
  const target = sim.getBirds()[0]!;
  sim.step(.1, { ...target.position, x: target.position.x - 1 });
  expect(target.panicTimer).toBeGreaterThan(0);
  for (let i = 0; i < 100; i++) {
    const headings = sim.getBirds().map(b => b.heading);
    sim.step(.1, { x: 10000, y: 10000, z: 10000 });
    for (const [index, bird] of sim.getBirds().entries()) {
      const delta = Math.atan2(Math.sin(bird.heading - headings[index]!), Math.cos(bird.heading - headings[index]!));
      expect(Math.abs(delta)).toBeLessThanOrEqual(SPECIES_CONFIGS[bird.species].maxTurnRate * .1 + 1e-8);
    }
  }
  expect(target.panicTimer).toBe(0);
  expect(target.speed).toBeLessThan(SPECIES_CONFIGS[target.species].cruiseSpeed + 2);
});

it('retains an actively chased solo bird across sustained flight and population turnover', () => {
  const sim = new BirdSimulation();
  sim.spawnFlocks(origin);
  const birds = sim.getBirds();
  const target = birds.find(b => b.species === 'pigeon' && birds.filter(n => n.flockId === b.flockId).length === 1)!;
  let distanceFlown = 0;
  for (let i = 0; i < 1200; i++) {
    const drone = {
      x: target.position.x - Math.sin(target.heading) * 12,
      y: target.position.y - Math.cos(target.heading) * 12,
      z: target.position.z,
    };
    const previous = { ...target.position };
    sim.maintainPopulation(drone, point => Math.hypot(point.x - target.position.x, point.y - target.position.y, point.z - target.position.z) < 30);
    sim.step(.1, drone);
    distanceFlown += Math.hypot(target.position.x - previous.x, target.position.y - previous.y, target.position.z - previous.z);
    expect(sim.getBirds()).toContain(target);
    expect(sim.getBirds()).toHaveLength(30);
    expect(target.flapping).toBe(true);
    expect(target.panicTimer).toBeGreaterThan(0);
  }
  expect(distanceFlown).toBeGreaterThan(1500);
});

it('does not propagate alarms between independent solo birds', () => {
  const sim = new BirdSimulation();
  sim.spawnFlocks(origin);
  const birds = sim.getBirds();
  const solos = birds.filter(b => b.species !== 'eagle' && birds.filter(n => n.flockId === b.flockId).length === 1);
  const source = solos.find(b => b.species === 'pigeon')!;
  const other = solos.find(b => b.species === 'seagull')!;
  for (const bird of birds) bird.position = { x: 2000, y: 2000, z: 100 };
  source.position = { x: 0, y: 0, z: 100 };
  other.position = { x: 10, y: 0, z: 100 };
  sim.step(.1, { x: -54, y: 0, z: 100 });
  for (let i = 0; i < 10; i++) sim.step(.1, { x: -10000, y: 0, z: 100 });
  expect(source.panicTimer).toBeGreaterThan(0);
  expect(other.panicTimer).toBe(0);
});
