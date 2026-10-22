import { describe, it, expect, vi } from 'vitest';
import { BirdSimulation } from '../BirdSimulation';
import { BIRDS_CONFIG, SPECIES_CONFIGS } from '../BirdConfig';

describe('BirdSimulation', () => {
  it.each([0.1, 0.5, 0.9])('keeps flocks near a stationary drone during a long flight (random=%s)', value => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(value);
    try {
      const sim = new BirdSimulation();
      const center = { x: 2000, y: -1000, z: 100 };
      sim.spawnFlocks(center);
      for (let step = 0; step < 1800; step++) {
        sim.step(.1, center);
        for (const bird of sim.getBirds()) {
          expect(Math.hypot(bird.position.x - center.x, bird.position.y - center.y))
            .toBeLessThan(BIRDS_CONFIG.despawnRadius);
        }
      }
    } finally {
      random.mockRestore();
    }
  });
  it('limits eagle climb acceleration to one integration per step', () => {
    const sim = new BirdSimulation();
    sim.spawnFlocks({ x: 0, y: 0, z: 100 });
    const eagle = sim.getBirds().find(b => b.species === 'eagle')!;
    const previousVz = eagle.velocity.z;
    sim.step(0.1);
    expect(eagle.velocity.z - previousVz).toBeLessThanOrEqual(SPECIES_CONFIGS.eagle.maxAcceleration * 0.1);
  });

  it('spawns configured counts of all three species with color variation', () => {
    const sim = new BirdSimulation();
    sim.spawnFlocks({ x: 0, y: 0, z: 100 });
    const birds = sim.getBirds();

    const expectedTotal =
      BIRDS_CONFIG.flockCounts.pigeonFlocks * BIRDS_CONFIG.flockCounts.pigeonsPerFlock +
      BIRDS_CONFIG.flockCounts.gullGroups * BIRDS_CONFIG.flockCounts.gullsPerGroup +
      BIRDS_CONFIG.flockCounts.eagles;

    expect(birds.length).toBe(expectedTotal);

    const pigeons = birds.filter(b => b.species === 'pigeon');
    const gulls = birds.filter(b => b.species === 'seagull');
    const eagles = birds.filter(b => b.species === 'eagle');

    expect(pigeons.length).toBe(24);
    expect(gulls.length).toBe(5);
    expect(eagles.length).toBe(1);

    // Color variation for pigeons (0=slate, 1=brown, 2=black, 3=white)
    const colorIndices = new Set(pigeons.map(p => p.colorIndex));
    expect(colorIndices.has(0)).toBe(true);
    expect(colorIndices.has(1)).toBe(true);
    expect(colorIndices.has(2)).toBe(true);
    expect(colorIndices.has(3)).toBe(true);
  });

  it('keeps bird speeds within aerodynamic min/max bounds', () => {
    const sim = new BirdSimulation();
    sim.spawnFlocks({ x: 0, y: 0, z: 50 });

    for (let step = 0; step < 20; step++) {
      sim.step(0.1);
      for (const bird of sim.getBirds()) {
        const cfg = SPECIES_CONFIGS[bird.species];
        expect(bird.speed).toBeGreaterThanOrEqual(cfg.minSpeed - 0.1);
        expect(bird.speed).toBeLessThanOrEqual(cfg.maxSpeed + 0.1);
      }
    }
  });

  it('confines birds within their species altitude boundaries', () => {
    const sim = new BirdSimulation();
    const baseZ = 200;
    sim.spawnFlocks({ x: 0, y: 0, z: baseZ });

    for (let step = 0; step < 30; step++) {
      sim.step(0.1);
      for (const bird of sim.getBirds()) {
        const cfg = SPECIES_CONFIGS[bird.species];
        expect(bird.position.z).toBeGreaterThanOrEqual(baseZ + cfg.minAltitude - 10);
        expect(bird.position.z).toBeLessThanOrEqual(baseZ + cfg.maxAltitude + 10);
      }
    }
  });

  it('banks into turns following StarDisplay aerodynamics', () => {
    const sim = new BirdSimulation();
    sim.spawnFlocks({ x: 0, y: 0, z: 50 });

    // Step several times and check that bank angle (roll) is bounded and non-zero during maneuvers
    for (let step = 0; step < 15; step++) {
      sim.step(0.1);
    }

    const eagle = sim.getBirds().find(b => b.species === 'eagle')!;
    const cfg = SPECIES_CONFIGS.eagle;
    expect(Math.abs(eagle.roll)).toBeGreaterThan(0.05); // eagle circles in thermal with bank
    expect(Math.abs(eagle.roll)).toBeLessThanOrEqual(cfg.maxBankAngle);
  });

  it('triggers panic response and accelerates when drone approaches threat radius', () => {
    const sim = new BirdSimulation();
    sim.spawnFlocks({ x: 0, y: 0, z: 50 });

    const targetPigeon = sim.getBirds().find(b => b.species === 'pigeon')!;
    const initialSpeed = targetPigeon.speed;

    // Place drone 15m away from target pigeon (well within threat radius of 55m)
    const dronePos = {
      x: targetPigeon.position.x + 10,
      y: targetPigeon.position.y + 10,
      z: targetPigeon.position.z,
    };

    // Step simulation with drone near
    for (let step = 0; step < 10; step++) {
      sim.step(0.1, dronePos);
    }

    expect(targetPigeon.panicTimer).toBeGreaterThan(0);
    expect(targetPigeon.speed).toBeGreaterThan(initialSpeed);
    expect(targetPigeon.flapping).toBe(true);
  });

  it('propagates agitation panic wave to nearby flock members', () => {
    const sim = new BirdSimulation();
    sim.spawnFlocks({ x: 0, y: 0, z: 50 });

    const pigeons = sim.getBirds().filter(b => b.species === 'pigeon');
    const firstPigeon = pigeons[0]!;

    const dronePos = {
      x: firstPigeon.position.x + 5,
      y: firstPigeon.position.y + 5,
      z: firstPigeon.position.z,
    };

    // First step triggers threat on first pigeon and spreads wave
    sim.step(0.1, dronePos);
    sim.step(0.1, dronePos);

    const panickedInFlock = pigeons.filter(p => p.flockId === firstPigeon.flockId && p.panicTimer > 0);
    // At least multiple birds in the same flock should be alerted by the wave
    expect(panickedInFlock.length).toBeGreaterThan(1);
  });
});
