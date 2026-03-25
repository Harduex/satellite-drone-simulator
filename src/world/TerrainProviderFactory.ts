import * as Cesium from "cesium";

const ARCGIS_TERRAIN_URL =
  "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer";

const TERRARIUM_URL =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const TERRARIUM_TILE_SIZE = 256;

/**
 * Create a terrain provider: tries ArcGIS Terrain3D first (free, no token),
 * falls back to AWS Terrarium tiles via CustomHeightmapTerrainProvider.
 *
 * Fire-and-forget — assigns to viewer.terrainProvider when ready.
 */
export async function initTerrainProvider(
  viewer: Cesium.Viewer,
): Promise<void> {
  try {
    const terrain =
      await Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(
        ARCGIS_TERRAIN_URL,
      );
    viewer.terrainProvider = terrain;
    if (import.meta.env.DEV) console.log("Terrain: ArcGIS Terrain3D");
  } catch {
    viewer.terrainProvider = createTerrariumProvider();
    if (import.meta.env.DEV) console.log("Terrain: AWS Terrarium fallback");
  }
}

function createTerrariumProvider(): Cesium.CustomHeightmapTerrainProvider {
  return new Cesium.CustomHeightmapTerrainProvider({
    width: TERRARIUM_TILE_SIZE,
    height: TERRARIUM_TILE_SIZE,
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    callback: decodeTerrariumTile,
  });
}

async function decodeTerrariumTile(
  x: number,
  y: number,
  level: number,
): Promise<Float32Array> {
  const url = TERRARIUM_URL
    .replace("{z}", String(level))
    .replace("{x}", String(x))
    .replace("{y}", String(y));

  const response = await fetch(url);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(TERRARIUM_TILE_SIZE, TERRARIUM_TILE_SIZE);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const { data } = ctx.getImageData(
    0,
    0,
    TERRARIUM_TILE_SIZE,
    TERRARIUM_TILE_SIZE,
  );

  const heights = new Float32Array(TERRARIUM_TILE_SIZE * TERRARIUM_TILE_SIZE);
  for (let i = 0; i < heights.length; i++) {
    const idx = i * 4;
    const r = data[idx]!;
    const g = data[idx + 1]!;
    const b = data[idx + 2]!;
    // Terrarium encoding: height = (R * 256 + G + B / 256) - 32768
    heights[i] = (r * 256 + g + b / 256) - 32768;
  }
  return heights;
}
