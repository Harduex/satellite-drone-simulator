export type BirdSpecies = 'pigeon' | 'seagull' | 'eagle';

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface BirdPose {
  position: Point3;
  heading: number; // radians clockwise from North
  pitch: number;   // radians (+ is climbing, - is diving)
  roll: number;    // radians (+ is banked right, - is banked left)
  speed: number;   // m/s
}

export interface BirdState {
  id: number;
  species: BirdSpecies;
  flockId: number;
  colorIndex: number; // for pigeons: 0=slate/grey, 1=brown, 2=black, 3=white
  position: Point3;
  velocity: Point3;
  heading: number;
  pitch: number;
  roll: number;
  speed: number;
  flapping: boolean;
  flapPhase: number;
  panicTimer: number; // > 0 if currently fleeing/panicking
}

export interface BirdFrame {
  id: number;
  species: BirdSpecies;
  colorIndex: number;
  previous: BirdPose;
  current: BirdPose;
  flapping: boolean;
}

export interface BirdSpeciesConfig {
  species: BirdSpecies;
  modelName: string;
  wingspan: number;
  cruiseSpeed: number; // m/s
  maxSpeed: number;    // m/s (sprint/flee)
  minSpeed: number;    // m/s (stall speed)
  maxAcceleration: number; // m/s^2
  maxTurnRate: number; // rad/s
  maxBankAngle: number; // rad
  threatRadius: number; // meters
  minAltitude: number; // meters above base
  maxAltitude: number; // meters above base
  separationDistance: number; // meters
}
