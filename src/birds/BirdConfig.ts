import type { BirdSpecies, BirdSpeciesConfig } from './BirdTypes';

export const PIGEON_COLORS = [
  '#5f6c77', // 0: Classic Slate Blue/Grey
  '#7b4628', // 1: Brown / Red-brown
  '#222326', // 2: Black / Dark Charcoal
  '#f0eef2', // 3: White / Light Cream
] as const;

export const SPECIES_CONFIGS: Record<BirdSpecies, BirdSpeciesConfig> = {
  swallow: {
    species: 'swallow', modelName: 'swallow', wingspan: .34, scale: 1.8,
    upAxis: 'Z', forwardAxis: 'Y', cruiseSpeed: 16, maxSpeed: 28, minSpeed: 8,
    maxAcceleration: 16, maxTurnRate: 2.6, maxBankAngle: 1.05,
    threatRadius: 40, minAltitude: 8, maxAltitude: 70, separationDistance: 1.8,
  },
  pigeon: {
    species: 'pigeon',
    modelName: 'pigeon',
    wingspan: 1.25,
    scale: 2.5,
    upAxis: 'Y',
    forwardAxis: 'Z',
    cruiseSpeed: 14,
    maxSpeed: 24,
    minSpeed: 7,
    maxAcceleration: 12,
    maxTurnRate: 1.8,
    maxBankAngle: 0.9,
    threatRadius: 55,
    minAltitude: 8,
    maxAltitude: 60,
    separationDistance: 2.5,
  },
  seagull: {
    species: 'seagull',
    modelName: 'seagull',
    wingspan: 2.5,
    scale: 1.8,
    upAxis: 'Z',
    forwardAxis: 'Y',
    cruiseSpeed: 12,
    maxSpeed: 21,
    minSpeed: 6,
    maxAcceleration: 8,
    maxTurnRate: 1.2,
    maxBankAngle: 0.7,
    threatRadius: 45,
    minAltitude: 14,
    maxAltitude: 100,
    separationDistance: 3.5,
  },
  eagle: {
    species: 'eagle',
    modelName: 'eagle',
    wingspan: 4.2,
    scale: 2.0,
    upAxis: 'Z',
    forwardAxis: 'Y',
    cruiseSpeed: 18,
    maxSpeed: 32,
    minSpeed: 10,
    maxAcceleration: 14,
    maxTurnRate: 1.0,
    maxBankAngle: 0.8,
    threatRadius: 65,
    minAltitude: 35,
    maxAltitude: 180,
    separationDistance: 10,
  },
};

export const BIRDS_CONFIG = {
  updateRateHz: 10,
  updateDt: 0.1, // 100ms per simulation step
  despawnRadius: 650,   // meters
  topologicalNeighbors: 7, // StarDisplay rule
  panicDurationSeconds: 4.5,
  agitationWaveSpeed: 30, // m/s propagation speed to flock neighbours
  alarmRadius: 60,
  encounterRoamRadius: 180,
  spawnMinRadius: 120,
  spawnMaxRadius: 280,
  spawnAttempts: 8,
  flockCounts: {
    pigeonFlocks: 2,
    pigeonsPerFlock: 6,
    gullGroups: 1,
    gullsPerGroup: 5,
    swallowFlocks: 1,
    swallowsPerFlock: 9,
    soloFlyers: 3,
    eagles: 1,
  },
} as const;
