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

describe("TerrainSampler overhead surface guard", () => {
  it("tracks normal ground and roof surfaces at or below the drone", () => {
    let surfaceHeight = 0;
    const sampler = createSampler({
      sceneHeight: () => surfaceHeight,
      globeHeight: () => 0,
    });

    sampler.sampleAtPosition({ x: 0, y: 0, z: 10 });
    expect(sampler.getGroundHeight()).toBeCloseTo(0, 2);

    // Flying at 30m over a 20m building roof updates ground floor to 20m
    surfaceHeight = 20;
    sampler.sampleAtPosition({ x: 10, y: 0, z: 30 });
    expect(sampler.getGroundHeight()).toBeCloseTo(20, 2);
  });

  it("ignores sudden overhead bridge/arch surfaces above the drone and keeps the lower floor", () => {
    let sceneSurface = 0;
    const sampler = createSampler({
      sceneHeight: () => sceneSurface,
      globeHeight: () => 0,
    });

    // Establish street-level floor (0m) while flying at 5m altitude
    sampler.sampleAtPosition({ x: 0, y: 0, z: 5 });
    expect(sampler.getGroundHeight()).toBeCloseTo(0, 2);

    // Fly under a 22m bridge deck while still at 5m altitude
    sceneSurface = 22;
    sampler.sampleAtPosition({ x: 5, y: 0, z: 5 });
    expect(sampler.getGroundHeight()).toBeCloseTo(0, 2);
  });
});
