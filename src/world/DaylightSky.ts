import * as Cesium from "cesium";

const FACE_SIZE = 128;
const FACE_DIRECTIONS = {
  positiveX: (u: number, v: number) => new Cesium.Cartesian3(1, -v, -u),
  negativeX: (u: number, v: number) => new Cesium.Cartesian3(-1, -v, u),
  positiveY: (u: number, v: number) => new Cesium.Cartesian3(u, 1, v),
  negativeY: (u: number, v: number) => new Cesium.Cartesian3(u, -1, -v),
  positiveZ: (u: number, v: number) => new Cesium.Cartesian3(u, -v, 1),
  negativeZ: (u: number, v: number) => new Cesium.Cartesian3(-u, -v, -1),
};

/** The atmosphere shell lies beyond the short FPV frustum; a local sky needs no distant tiles. */
export function createDaylightPanorama(
  longitude: number,
  latitude: number,
): Cesium.CubeMapPanorama {
  const surface = Cesium.Cartesian3.fromDegrees(longitude, latitude);
  const rotation = Cesium.Matrix4.getMatrix3(
    Cesium.Transforms.eastNorthUpToFixedFrame(surface), new Cesium.Matrix3(),
  );
  // Keep even cube corners inside the FPV far plane in every viewing direction.
  Cesium.Matrix3.multiplyByScalar(rotation, 0.5, rotation);

  const sources = Object.fromEntries(Object.entries(FACE_DIRECTIONS).map(([face, direction]) => {
    const pixels = new Uint8Array(FACE_SIZE * FACE_SIZE * 4);
    for (let y = 0; y < FACE_SIZE; y++) {
      for (let x = 0; x < FACE_SIZE; x++) {
        const ray = direction(2 * (x + 0.5) / FACE_SIZE - 1, 1 - 2 * (y + 0.5) / FACE_SIZE);
        Cesium.Cartesian3.normalize(ray, ray);
        const elevation = Math.max(0, ray.z);
        const blend = Math.pow(elevation, 0.45);
        const offset = (y * FACE_SIZE + x) * 4;
        pixels[offset] = Math.round(195 + (57 - 195) * blend);
        pixels[offset + 1] = Math.round(216 + (117 - 216) * blend);
        pixels[offset + 2] = Math.round(230 + (180 - 230) * blend);
        pixels[offset + 3] = 255;
      }
    }
    return [face, { width: FACE_SIZE, height: FACE_SIZE, arrayBufferView: pixels }];
  }));
  return new Cesium.CubeMapPanorama({ sources, transform: rotation });
}
