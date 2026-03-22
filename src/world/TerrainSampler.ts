import * as Cesium from "cesium";

export class TerrainSampler {
  private cache = new Map<string, number>();
  private terrainProvider: Cesium.TerrainProvider | null = null;
  private defaultHeight = 0;

  async init(
    viewer: Cesium.Viewer,
    spawnLon: number,
    spawnLat: number,
  ): Promise<void> {
    this.terrainProvider = viewer.terrainProvider;

    // Pre-cache a grid around the spawn point (100m × 100m at ~10m resolution)
    const gridSize = 11; // 11×11 = 121 sample points
    const spacing = 0.0001; // ~11m at equator in degrees

    const positions: Cesium.Cartographic[] = [];
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const lon = spawnLon + (i - Math.floor(gridSize / 2)) * spacing;
        const lat = spawnLat + (j - Math.floor(gridSize / 2)) * spacing;
        positions.push(Cesium.Cartographic.fromDegrees(lon, lat));
      }
    }

    try {
      const sampled = await Cesium.sampleTerrainMostDetailed(
        this.terrainProvider,
        positions,
      );
      for (const pos of sampled) {
        const key = this.cacheKey(
          Cesium.Math.toDegrees(pos.longitude),
          Cesium.Math.toDegrees(pos.latitude),
        );
        this.cache.set(key, pos.height);
      }

      // Set the default height from spawn point
      const spawnPos = Cesium.Cartographic.fromDegrees(spawnLon, spawnLat);
      const [spawnSampled] = await Cesium.sampleTerrainMostDetailed(
        this.terrainProvider,
        [spawnPos],
      );
      if (spawnSampled) {
        this.defaultHeight = spawnSampled.height;
      }
    } catch {
      // Terrain sampling may fail without Ion token; fall back to 0
      this.defaultHeight = 0;
    }
  }

  async sampleHeight(lon: number, lat: number): Promise<number> {
    // Check cache first (snap to grid)
    const key = this.cacheKey(lon, lat);
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    // Async sample
    if (!this.terrainProvider) return this.defaultHeight;

    try {
      const position = Cesium.Cartographic.fromDegrees(lon, lat);
      const [sampled] = await Cesium.sampleTerrainMostDetailed(
        this.terrainProvider,
        [position],
      );
      const height = sampled?.height ?? this.defaultHeight;
      this.cache.set(key, height);
      return height;
    } catch {
      return this.defaultHeight;
    }
  }

  getDefaultHeight(): number {
    return this.defaultHeight;
  }

  getAGL(enuZ: number, terrainHeight: number): number {
    return enuZ - terrainHeight;
  }

  private cacheKey(lon: number, lat: number): string {
    // Snap to ~10m grid for cache lookup
    return `${(lon * 10000).toFixed(0)},${(lat * 10000).toFixed(0)}`;
  }
}
