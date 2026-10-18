import * as Cesium from "cesium";
import { describe, expect, it } from "vitest";
import { TerrainSampler } from "../TerrainSampler";

function createSampler(opts: {
  sceneHeight: (carto: Cesium.Cartographic) => number | undefined;
  globeHeight: (carto: Cesium.Cartographic) => number | undefined;
}) {
  const origin = Cesium.Cartesian3.fromDegrees(24.952, 60.169, 0);
  const enuFrame = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
  const scene = {
    sampleHeightSupported: true,
    sampleHeight: (carto: Cesium.Cartographic) => opts.sceneHeight(carto),
    globe: {
      getHeight: (carto: Cesium.Cartographic) => opts.globeHeight(carto),
    },
  } as unknown as Cesium.Scene;
  return new TerrainSampler(scene, enuFrame);
}

describe("TerrainSampler surface height tracking", () => {
  it("updates ground height to building roofs even when the roof is above the drone", () => {
    let sceneSurface = 0;
    const sampler = createSampler({
      sceneHeight: () => sceneSurface,
      globeHeight: () => 0,
    });

    sampler.sampleAtPosition({ x: 0, y: 0, z: 5 });
    expect(sampler.getGroundHeight()).toBeCloseTo(0, 2);

    // Flying at 5m into a 22m building updates ground height to 22m so collision triggers
    sceneSurface = 22;
    sampler.sampleAtPosition({ x: 5, y: 0, z: 5 });
    expect(sampler.getGroundHeight()).toBeCloseTo(22, 2);
  });
});
