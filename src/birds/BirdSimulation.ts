import type { Point3, BirdPose, BirdState, BirdFrame } from './BirdTypes';
import { SPECIES_CONFIGS, BIRDS_CONFIG } from './BirdConfig';

function distSq(a: Point3, b: Point3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function dist(a: Point3, b: Point3): number {
  return Math.sqrt(distSq(a, b));
}

function normalizeAngle(rad: number): number {
  let a = rad % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  return a;
}

function angleDiff(target: number, current: number): number {
  let diff = (target - current) % (2 * Math.PI);
  if (diff > Math.PI) diff -= 2 * Math.PI;
  if (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}

export class BirdSimulation {
  private birds: BirdState[] = [];
  private previousPoses = new Map<number, BirdPose>();
  private nextId = 1;
  private baseAltitude = 0;
  private center: Point3 = { x: 0, y: 0, z: 0 };
  private eagleAngle = 0;

  constructor() {}

  spawnFlocks(center: Point3): void {
    this.birds = [];
    this.previousPoses.clear();
    this.baseAltitude = center.z;
    this.center = { ...center };

    const { pigeonFlocks, pigeonsPerFlock, gullGroups, gullsPerGroup, eagles } = BIRDS_CONFIG.flockCounts;

    // 1. Pigeon flocks
    for (let f = 0; f < pigeonFlocks; f++) {
      // Flock 0 placed directly in front of drone (+Y / North) at low altitude for immediate takeoff view
      const fx = f === 0 ? center.x : center.x + 35;
      const fy = f === 0 ? center.y + 28 : center.y + 55;
      const fz = center.z + (f === 0 ? 10 : 18);
      const baseHeading = f === 0 ? 0.1 : normalizeAngle(Math.PI / 3);

      for (let i = 0; i < pigeonsPerFlock; i++) {
        const id = this.nextId++;
        const colorIndex = i % 4; // slate, brown, black, white
        const spread = 8;
        const px = fx + (Math.random() - 0.5) * spread;
        const py = fy + (Math.random() - 0.5) * spread;
        const pz = fz + (Math.random() - 0.5) * 4;
        const heading = normalizeAngle(baseHeading + (Math.random() - 0.5) * 0.4);
        const cfg = SPECIES_CONFIGS.pigeon;
        const speed = cfg.cruiseSpeed + (Math.random() - 0.5) * 2;

        const vx = speed * Math.sin(heading);
        const vy = speed * Math.cos(heading);

        const state: BirdState = {
          id,
          species: 'pigeon',
          flockId: 10 + f,
          colorIndex,
          position: { x: px, y: py, z: pz },
          velocity: { x: vx, y: vy, z: 0 },
          heading,
          pitch: 0,
          roll: 0,
          speed,
          flapping: true,
          flapPhase: Math.random() * Math.PI * 2,
          panicTimer: 0,
        };

        this.birds.push(state);
        this.previousPoses.set(id, this.createPose(state));
      }
    }

    // 2. Seagull groups
    for (let g = 0; g < gullGroups; g++) {
      const gx = center.x + (g === 0 ? -28 : 45);
      const gy = center.y + (g === 0 ? 40 : 65);
      const gz = center.z + (g === 0 ? 22 : 30);

      for (let i = 0; i < gullsPerGroup; i++) {
        const id = this.nextId++;
        const spread = 15;
        const px = gx + (Math.random() - 0.5) * spread;
        const py = gy + (Math.random() - 0.5) * spread;
        const pz = gz + (Math.random() - 0.5) * 6;
        const heading = normalizeAngle(Math.random() * Math.PI * 2);
        const cfg = SPECIES_CONFIGS.seagull;
        const speed = cfg.cruiseSpeed + (Math.random() - 0.5) * 1.5;

        const vx = speed * Math.sin(heading);
        const vy = speed * Math.cos(heading);

        const state: BirdState = {
          id,
          species: 'seagull',
          flockId: 20 + g,
          colorIndex: 0,
          position: { x: px, y: py, z: pz },
          velocity: { x: vx, y: vy, z: 0 },
          heading,
          pitch: 0,
          roll: 0,
          speed,
          flapping: Math.random() > 0.4,
          flapPhase: Math.random() * Math.PI * 2,
          panicTimer: 0,
        };

        this.birds.push(state);
        this.previousPoses.set(id, this.createPose(state));
      }
    }

    // 3. Eagle (solitary, soaring high)
    for (let e = 0; e < eagles; e++) {
      const id = this.nextId++;
      const cfg = SPECIES_CONFIGS.eagle;
      const speed = cfg.cruiseSpeed;
      const ex = center.x + 20;
      const ey = center.y + 50;
      const ez = center.z + 65;
      const heading = normalizeAngle(Math.PI / 4);

      const state: BirdState = {
        id,
        species: 'eagle',
        flockId: 99,
        colorIndex: 0,
        position: { x: ex, y: ey, z: ez },
        velocity: { x: speed * Math.sin(heading), y: speed * Math.cos(heading), z: 0 },
        heading,
        pitch: 0,
        roll: 0.25, // bank into circular thermal
        speed,
        flapping: false, // soaring/gliding
        flapPhase: 0,
        panicTimer: 0,
      };

      this.birds.push(state);
      this.previousPoses.set(id, this.createPose(state));
    }
  }

  getBirds(): readonly BirdState[] {
    return this.birds;
  }

  step(dt: number, dronePos?: Point3): BirdFrame[] {
    if (this.birds.length === 0) return [];

    // Save previous poses for interpolation
    for (const bird of this.birds) {
      this.previousPoses.set(bird.id, this.createPose(bird));
    }

    // 1. Threat detection & panic wave
    if (dronePos) {
      this.processThreat(dronePos, dt);
    }

    // 2. Physics & flocking step per bird
    for (let i = 0; i < this.birds.length; i++) {
      const bird = this.birds[i]!;
      const cfg = SPECIES_CONFIGS[bird.species];

      if (bird.panicTimer > 0) {
        bird.panicTimer = Math.max(0, bird.panicTimer - dt);
      }

      // Compute desired acceleration vector
      let ax = 0;
      let ay = 0;
      let az = 0;

      if (bird.species === 'eagle') {
        // Solitary eagle thermal soaring in circular pattern
        this.eagleAngle += (cfg.cruiseSpeed / 85) * dt;
        const targetHeading = normalizeAngle(this.eagleAngle);
        const headingDiff = angleDiff(targetHeading, bird.heading);
        const turnRate = Math.max(-cfg.maxTurnRate, Math.min(cfg.maxTurnRate, headingDiff / dt));
        bird.heading = normalizeAngle(bird.heading + turnRate * dt);
        // Bank into the turn
        bird.roll = Math.max(-cfg.maxBankAngle, Math.min(cfg.maxBankAngle, (bird.speed * turnRate) / 9.81));
        
        // Gentle altitude wave
        const targetAlt = this.baseAltitude + 120 + Math.sin(this.eagleAngle * 0.5) * 20;
        az = (targetAlt - bird.position.z) * 0.5;

        // Flee response if drone near
        if (bird.panicTimer > 0 && dronePos) {
          const fleeX = bird.position.x - dronePos.x;
          const fleeY = bird.position.y - dronePos.y;
          const fleeDist = Math.hypot(fleeX, fleeY) || 1;
          ax += (fleeX / fleeDist) * cfg.maxAcceleration;
          ay += (fleeY / fleeDist) * cfg.maxAcceleration;
          az += 3; // climb to evade
          bird.flapping = true;
        } else {
          bird.flapping = Math.sin(this.eagleAngle * 2) > 0.85;
          // Eagle velocity follows its soaring heading
          bird.velocity.x = bird.speed * Math.sin(bird.heading);
          bird.velocity.y = bird.speed * Math.cos(bird.heading);
        }
      } else {
        // StarDisplay: topological flocking (up to 7 nearest neighbours in flock)
        const neighbors = this.findTopologicalNeighbors(i, BIRDS_CONFIG.topologicalNeighbors);

        let sepX = 0, sepY = 0, sepZ = 0;
        let alignVx = 0, alignVy = 0, alignVz = 0;
        let cohX = 0, cohY = 0, cohZ = 0;
        let count = 0;

        for (const n of neighbors) {
          const d = dist(bird.position, n.position);
          if (d > 0.001) {
            // Separation
            if (d < cfg.separationDistance) {
              const repel = (cfg.separationDistance - d) / d;
              sepX += (bird.position.x - n.position.x) * repel * 4;
              sepY += (bird.position.y - n.position.y) * repel * 4;
              sepZ += (bird.position.z - n.position.z) * repel * 2;
            }
            // Alignment
            alignVx += n.velocity.x;
            alignVy += n.velocity.y;
            alignVz += n.velocity.z;
            // Cohesion
            cohX += n.position.x;
            cohY += n.position.y;
            cohZ += n.position.z;
            count++;
          }
        }

        if (count > 0) {
          alignVx /= count; alignVy /= count; alignVz /= count;
          cohX /= count; cohY /= count; cohZ /= count;

          ax += (alignVx - bird.velocity.x) * 1.5;
          ay += (alignVy - bird.velocity.y) * 1.5;
          az += (alignVz - bird.velocity.z) * 1.0;

          ax += (cohX - bird.position.x) * 0.8;
          ay += (cohY - bird.position.y) * 0.8;
          az += (cohZ - bird.position.z) * 0.4;

          ax += sepX;
          ay += sepY;
          az += sepZ;
        }

        // Flee drone if panicked
        if (bird.panicTimer > 0 && dronePos) {
          const fleeX = bird.position.x - dronePos.x;
          const fleeY = bird.position.y - dronePos.y;
          const fleeDist = Math.hypot(fleeX, fleeY) || 1;
          ax += (fleeX / fleeDist) * cfg.maxAcceleration * 1.8;
          ay += (fleeY / fleeDist) * cfg.maxAcceleration * 1.8;
          az += ((bird.id % 2 === 0 ? 1 : -0.5) * 3); // scatter vertically
          bird.flapping = true;
        } else {
          // Normal flap-glide cycle
          bird.flapPhase += dt * 3.5;
          if (bird.species === 'pigeon') {
            bird.flapping = (Math.sin(bird.flapPhase) > -0.3);
          } else {
            bird.flapping = (Math.sin(bird.flapPhase * 0.7) > 0.2);
          }
        }
      }

      const toCenterX = this.center.x - bird.position.x;
      const toCenterY = this.center.y - bird.position.y;
      const radius = Math.hypot(toCenterX, toCenterY);
      if (radius > BIRDS_CONFIG.maxActiveRadius) {
        const acceleration = cfg.maxAcceleration * Math.min(1, (radius - BIRDS_CONFIG.maxActiveRadius) / 50);
        ax += toCenterX / radius * acceleration;
        ay += toCenterY / radius * acceleration;
      }

      // Altitude boundary confinement
      const minZ = this.baseAltitude + cfg.minAltitude;
      const maxZ = this.baseAltitude + cfg.maxAltitude;
      if (bird.position.z < minZ) {
        az += (minZ - bird.position.z) * 4;
      } else if (bird.position.z > maxZ) {
        az += (maxZ - bird.position.z) * 4;
      }

      // Integrate velocity with acceleration limits
      const aMag = Math.hypot(ax, ay, az);
      if (aMag > cfg.maxAcceleration) {
        const factor = cfg.maxAcceleration / aMag;
        ax *= factor;
        ay *= factor;
        az *= factor;
      }

      bird.velocity.x += ax * dt;
      bird.velocity.y += ay * dt;
      bird.velocity.z += az * dt;

      // Speed limits
      const targetSpeed = bird.panicTimer > 0 ? cfg.maxSpeed : cfg.cruiseSpeed;
      let currentSpeed = Math.hypot(bird.velocity.x, bird.velocity.y, bird.velocity.z) || 1;
      
      // Speed restoration toward target
      const speedDiff = targetSpeed - currentSpeed;
      const speedAdjust = Math.max(-cfg.maxAcceleration, Math.min(cfg.maxAcceleration, speedDiff * 2)) * dt;
      currentSpeed = Math.max(cfg.minSpeed, Math.min(cfg.maxSpeed, currentSpeed + speedAdjust));

      // Re-normalize velocity to currentSpeed
      const vNorm = currentSpeed / (Math.hypot(bird.velocity.x, bird.velocity.y, bird.velocity.z) || 1);
      bird.velocity.x *= vNorm;
      bird.velocity.y *= vNorm;
      bird.velocity.z *= vNorm;
      bird.speed = currentSpeed;

      // Compute heading, pitch, and roll from velocity & turn
      const hSpeed = Math.hypot(bird.velocity.x, bird.velocity.y) || 0.1;
      const newHeading = normalizeAngle(Math.atan2(bird.velocity.x, bird.velocity.y));
      const turnRate = angleDiff(newHeading, bird.heading) / dt;

      bird.heading = newHeading;
      bird.pitch = Math.atan2(bird.velocity.z, hSpeed);

      // StarDisplay banking: bank angle corresponds to turn rate
      const targetRoll = Math.max(-cfg.maxBankAngle, Math.min(cfg.maxBankAngle, (bird.speed * turnRate) / 9.81));
      bird.roll += (targetRoll - bird.roll) * Math.min(1, dt * 5);

      // Integrate position
      bird.position.x += bird.velocity.x * dt;
      bird.position.y += bird.velocity.y * dt;
      bird.position.z += bird.velocity.z * dt;
    }

    // Produce frames
    return this.birds.map(bird => ({
      id: bird.id,
      species: bird.species,
      colorIndex: bird.colorIndex,
      previous: this.previousPoses.get(bird.id) ?? this.createPose(bird),
      current: this.createPose(bird),
      flapping: bird.flapping,
    }));
  }

  private processThreat(dronePos: Point3, dt: number): void {
    const newlyPanicked: BirdState[] = [];

    // Check direct threat
    for (const bird of this.birds) {
      const cfg = SPECIES_CONFIGS[bird.species];
      const d = dist(bird.position, dronePos);
      if (d < cfg.threatRadius) {
        if (bird.panicTimer <= 0) {
          newlyPanicked.push(bird);
        }
        bird.panicTimer = BIRDS_CONFIG.panicDurationSeconds;
      }
    }

    // Agitation wave propagation to flock members within wave distance
    if (newlyPanicked.length > 0) {
      const waveDist = BIRDS_CONFIG.agitationWaveSpeed * dt * 2;
      for (const source of newlyPanicked) {
        for (const other of this.birds) {
          if (other.flockId === source.flockId && other.panicTimer <= 0) {
            if (dist(source.position, other.position) < waveDist) {
              other.panicTimer = BIRDS_CONFIG.panicDurationSeconds * 0.9;
            }
          }
        }
      }
    }
  }

  private findTopologicalNeighbors(index: number, k: number): BirdState[] {
    const bird = this.birds[index]!;
    const flockMembers = this.birds.filter((b, i) => i !== index && b.flockId === bird.flockId);

    if (flockMembers.length <= k) {
      return flockMembers;
    }

    // Sort by distance squared and take k closest
    flockMembers.sort((a, b) => distSq(bird.position, a.position) - distSq(bird.position, b.position));
    return flockMembers.slice(0, k);
  }

  private createPose(bird: BirdState): BirdPose {
    return {
      position: { x: bird.position.x, y: bird.position.y, z: bird.position.z },
      heading: bird.heading,
      pitch: bird.pitch,
      roll: bird.roll,
      speed: bird.speed,
    };
  }
}
