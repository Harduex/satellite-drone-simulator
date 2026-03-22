import * as Cesium from "cesium";

export class TileLoader {
  private tileset: Cesium.Cesium3DTileset | null = null;

  /** Load Google Photorealistic 3D Tiles */
  async loadGoogleTiles(
    viewer: Cesium.Viewer,
    apiKey: string,
  ): Promise<Cesium.Cesium3DTileset> {
    const tileset = await Cesium.Cesium3DTileset.fromUrl(
      `https://tile.googleapis.com/v1/3dtiles/root.json?key=${apiKey}`,
    );
    viewer.scene.primitives.add(tileset);
    this.tileset = tileset;
    return tileset;
  }

  getTileset(): Cesium.Cesium3DTileset | null {
    return this.tileset;
  }
}
