import * as Cesium from 'cesium';

const MAX_GEOMETRIC_ERROR_METERS = 5;
const MAX_TILE_RADIUS_METERS = 2000;
const SPAWN_PROXIMITY_METERS = 100;

/** A bounded local detail heuristic; bounds cannot certify every surface in a flight area. */
export function waitForDetailedTileCoverage(tileset: Cesium.Cesium3DTileset, position: Cesium.Cartesian3): Promise<boolean> {
  const target = Cesium.Cartesian3.clone(position);
  return new Promise(resolve => {
    const finish = (found: boolean) => { clearTimeout(timer); removeListener(); resolve(found); };
    const removeListener = tileset.tileVisible.addEventListener((tile: Cesium.Cesium3DTile) => {
      const content = tile.content;
      const sphere = tile.boundingSphere;
      if (tile.geometricError <= MAX_GEOMETRIC_ERROR_METERS && sphere.radius <= MAX_TILE_RADIUS_METERS
        && content.trianglesLength >= 100 && content.texturesByteLength > 0
        && Cesium.Cartesian3.distance(target, sphere.center) <= sphere.radius + SPAWN_PROXIMITY_METERS) finish(true);
    });
    const timer = setTimeout(() => finish(false), 1500);
  });
}
