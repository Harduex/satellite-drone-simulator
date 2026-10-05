export const TRAFFIC_MODELS = [
  { name: "sedan", length: 4.3 },
  { name: "hatchback-sports", length: 4.1 },
  { name: "suv", length: 4.6 },
  { name: "audi-a3", length: 4.343 },
  { name: "mazda-cx5", length: 4.55 },
] as const;

export const TRAFFIC = {
  radius: 1000,
  preload: 1500,
  refreshDistance: 300,
  debounceMs: 300,
  zoom: 14,
  tilesPerRefresh: 16,
  concurrentRequests: 4,
  cacheTiles: 32,
  cacheBytes: 24 * 1024 * 1024,
  tileBytes: 4 * 1024 * 1024,
  tileFeatures: 10000,
  tileVertices: 100000,
  edges: 2500,
  cars: 150,
  step: 0.1,
  surfaceSamples: 8,
  surfaceMs: 2,
} as const;
export const ROAD_SPEED = {
  motorway: 26,
  trunk: 21,
  primary: 16,
  secondary: 13,
  tertiary: 10,
  minor: 7,
};
export const ROAD_DENSITY = {
  motorway: 14,
  trunk: 12,
  primary: 10,
  secondary: 8,
  tertiary: 6,
  minor: 4,
};
