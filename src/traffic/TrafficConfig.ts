export const TRAFFIC_MODELS = [
  { name: "sedan", length: 4.3, paint: "standard", driving: "standard" },
  { name: "hatchback-sports", length: 4.1, paint: "standard", driving: "standard" },
  { name: "suv", length: 4.6, paint: "standard", driving: "standard" },
  { name: "audi-a3", length: 4.343, paint: "standard", driving: "standard" },
  { name: "mazda-cx5", length: 4.55, paint: "standard", driving: "standard" },
  { name: "sports-wedge", length: 4.14, paint: "sports", driving: "sports" },
  { name: "sports-berlinetta", length: 4.23, paint: "sports", driving: "sports" },
  { name: "sports-turbo", length: 4.36, paint: "sports", driving: "sports" },
] as const;

export const TRAFFIC_DRIVING = {
  standard: { speedMultiplier: 1, acceleration: 2 },
  sports: { speedMultiplier: 1.6, acceleration: 4 },
} as const;

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
  cars: 300,
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
  motorway: 28,
  trunk: 24,
  primary: 20,
  secondary: 16,
  tertiary: 12,
  minor: 8,
};
