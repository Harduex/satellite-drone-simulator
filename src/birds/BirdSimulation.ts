import type { Point3, BirdPose, BirdState, BirdFrame, BirdSpecies } from './BirdTypes';
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
  private origins = new Map<number, Point3>();
  private alarms = new Map<number, number>();
  private elapsed = 0;
  private eagleAngle = 0;

  constructor() {}

  spawnFlocks(center: Point3): void {
    this.birds = [];
    this.previousPoses.clear();
    this.origins.clear();
    this.alarms.clear();
    this.elapsed = 0;
    this.eagleAngle = 0;
    const counts = BIRDS_CONFIG.flockCounts;
    const groups: [BirdSpecies, number][] = [
      ...Array.from({ length: counts.pigeonFlocks }, (): [BirdSpecies, number] => ['pigeon', counts.pigeonsPerFlock]),
      ...Array.from({ length: counts.gullGroups }, (): [BirdSpecies, number] => ['seagull', counts.gullsPerGroup]),
      ...Array.from({ length: counts.swallowFlocks }, (): [BirdSpecies, number] => ['swallow', counts.swallowsPerFlock]),
      ['pigeon', 1], ['seagull', 1], ['swallow', 1], ['eagle', counts.eagles],
    ];
    for (const [index, [species, count]] of groups.entries()) {
      const origin = this.encounterOrigin(center, 40, 140);
      this.addGroup(this.makeGroup(species, count, index, origin), origin);
    }
  }

  private encounterOrigin(center: Point3, minRadius: number, maxRadius: number): Point3 {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(minRadius * minRadius + Math.random() * (maxRadius * maxRadius - minRadius * minRadius));
    return { x: center.x + Math.sin(angle) * radius, y: center.y + Math.cos(angle) * radius, z: center.z };
  }

  private makeGroup(species: BirdSpecies, count: number, flockId: number, origin: Point3): BirdState[] {
    const cfg = SPECIES_CONFIGS[species];
    const heading = Math.random() * Math.PI * 2;
    const altitude = origin.z + (species === 'eagle' ? 65 : cfg.minAltitude + 8 + Math.random() * 14);
    return Array.from({ length: count }, (_, i) => {
      const direction = normalizeAngle(heading + (Math.random() - .5) * .3);
      const speed = cfg.cruiseSpeed + (species === 'eagle' ? 0 : Math.random() - .5);
      return {
        id: this.nextId++, species, flockId, colorIndex: species === 'pigeon' ? i % 4 : 0,
        position: { x: origin.x + (Math.random() - .5) * 8, y: origin.y + (Math.random() - .5) * 8, z: altitude + (Math.random() - .5) * 3 },
        velocity: { x: speed * Math.sin(direction), y: speed * Math.cos(direction), z: 0 },
        heading: direction, pitch: 0, roll: 0, speed,
        flapping: species !== 'eagle', flapPhase: Math.random() * Math.PI * 2, panicTimer: 0,
      };
    });
  }

  private addGroup(group: BirdState[], origin: Point3): void {
    for (const bird of group) {
      this.birds.push(bird);
      this.previousPoses.set(bird.id, this.createPose(bird));
      this.origins.set(bird.flockId, { ...origin });
    }
  }

  maintainPopulation(center: Point3, isVisible: (point: Point3) => boolean): void {
    for (const [flockId] of this.origins) {
      const group = this.birds.filter(b => b.flockId === flockId);
      if (!group.length || group.some(b => dist(b.position, center) <= BIRDS_CONFIG.despawnRadius || isVisible(b.position))) continue;
      for (let attempt = 0; attempt < BIRDS_CONFIG.spawnAttempts; attempt++) {
        const origin = this.encounterOrigin(center, BIRDS_CONFIG.spawnMinRadius, BIRDS_CONFIG.spawnMaxRadius);
        const replacement = this.makeGroup(group[0]!.species, group.length, flockId, origin);
        if (replacement.some(b => isVisible(b.position))) continue;
        const retired = new Set(group.map(b => b.id));
        this.birds = this.birds.filter(b => !retired.has(b.id));
        for (const id of retired) { this.previousPoses.delete(id); this.alarms.delete(id); }
        this.addGroup(replacement, origin);
        return;
      }
      return;
    }
  }

  getFrames(): BirdFrame[] {
    return this.birds.map(bird => ({
      id: bird.id, species: bird.species, colorIndex: bird.colorIndex,
      previous: this.previousPoses.get(bird.id) ?? this.createPose(bird),
      current: this.createPose(bird), flapping: bird.flapping,
    }));
  }

  getBirds(): readonly BirdState[] {
    return this.birds;
  }

  step(dt: number, dronePos?: Point3): BirdFrame[] {
    if (!Number.isFinite(dt) || dt <= 0 || this.birds.length === 0) return this.getFrames();
    dt = Math.min(dt, BIRDS_CONFIG.updateDt);
    this.elapsed += dt;

    // Save previous poses for interpolation
    for (const bird of this.birds) {
      this.previousPoses.set(bird.id, this.createPose(bird));
    }

    // 1. Threat detection & panic wave
    if (dronePos) {
      this.processThreat(dronePos);
    }

    // 2. Physics & flocking step per bird
    for (let i = 0; i < this.birds.length; i++) {
      const bird = this.birds[i]!;
      const cfg = SPECIES_CONFIGS[bird.species];
      const previousHeading = bird.heading;
      const origin = this.origins.get(bird.flockId)!;

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
        const targetAlt = origin.z + 120 + Math.sin(this.eagleAngle * 0.5) * 20;
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
          ax += (fleeX / fleeDist) * cfg.maxAcceleration * (0.35 + 1.45 * Math.max(0, 1 - dist(bird.position, dronePos) / cfg.threatRadius));
          ay += (fleeY / fleeDist) * cfg.maxAcceleration * (0.35 + 1.45 * Math.max(0, 1 - dist(bird.position, dronePos) / cfg.threatRadius));
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

      const toCenterX = origin.x - bird.position.x;
      const toCenterY = origin.y - bird.position.y;
      const radius = Math.hypot(toCenterX, toCenterY);
      if (radius > BIRDS_CONFIG.encounterRoamRadius) {
        const acceleration = cfg.maxAcceleration * Math.min(1, (radius - BIRDS_CONFIG.encounterRoamRadius) / 50);
        ax += toCenterX / radius * acceleration;
        ay += toCenterY / radius * acceleration;
      }

      // Altitude boundary confinement
      const minZ = origin.z + cfg.minAltitude;
      const maxZ = origin.z + cfg.maxAltitude;
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
      const urgency = bird.panicTimer > 0 ? Math.max(bird.panicTimer / BIRDS_CONFIG.panicDurationSeconds, dronePos ? 1 - dist(bird.position, dronePos) / cfg.threatRadius : 0) : 0;
      const targetSpeed = cfg.cruiseSpeed + (cfg.maxSpeed - cfg.cruiseSpeed) * Math.min(1, urgency);
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
      const desiredHeading = normalizeAngle(
        radius > BIRDS_CONFIG.encounterRoamRadius && bird.panicTimer === 0
          ? Math.atan2(toCenterX, toCenterY)
          : Math.atan2(bird.velocity.x, bird.velocity.y),
      );
      const headingChange = Math.max(-cfg.maxTurnRate * dt, Math.min(cfg.maxTurnRate * dt, angleDiff(desiredHeading, previousHeading)));
      const newHeading = normalizeAngle(previousHeading + headingChange);
      const turnRate = headingChange / dt;
      bird.velocity.x = hSpeed * Math.sin(newHeading);
      bird.velocity.y = hSpeed * Math.cos(newHeading);

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

    return this.getFrames();
  }

  private processThreat(dronePos: Point3): void {
    const newlyPanicked: BirdState[] = [];
    for (const bird of this.birds) {
      const alarmAt = this.alarms.get(bird.id);
      if (alarmAt !== undefined && alarmAt <= this.elapsed) {
        this.alarms.delete(bird.id);
        if (bird.panicTimer <= 0) {
          bird.panicTimer = BIRDS_CONFIG.panicDurationSeconds * .9;
          newlyPanicked.push(bird);
        }
      }
      if (dist(bird.position, dronePos) < SPECIES_CONFIGS[bird.species].threatRadius) {
        if (bird.panicTimer <= 0) newlyPanicked.push(bird);
        bird.panicTimer = BIRDS_CONFIG.panicDurationSeconds;
      }
    }
    for (const source of newlyPanicked) {
      for (const other of this.birds) {
        if (other.flockId !== source.flockId || other.panicTimer > 0) continue;
        const distance = dist(source.position, other.position);
        if (distance > BIRDS_CONFIG.alarmRadius) continue;
        const at = this.elapsed + distance / BIRDS_CONFIG.agitationWaveSpeed;
        this.alarms.set(other.id, Math.min(this.alarms.get(other.id) ?? Infinity, at));
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
