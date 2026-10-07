export const PEDESTRIANS = {
    people: 160, spacing: 7.5, radius: 400, preload: 700, refreshDistance: 150, debounceMs: 300,
    zoom: 14, tilesPerRefresh: 9, concurrentRequests: 2, cacheTiles: 16,
    cacheBytes: 12 * 1024 * 1024, edges: 800, candidateSpans: 10000,
    surfaceSamples: 16, surfaceMs: 2, step: 0.1, roadClearance: 4,
} as const;
export const PEDESTRIAN_MODELS = [
    { name: 'male-a', height: 1.75, nativeHeight: 0.671325, shirtU: 0.21875 },
    { name: 'male-b', height: 1.72, nativeHeight: 0.661325, shirtU: 0.59375 },
    { name: 'female-a', height: 1.68, nativeHeight: 0.723353, shirtU: 0.34375 },
    { name: 'female-b', height: 1.65, nativeHeight: 0.775528, shirtU: 0.71875 },
] as const;
