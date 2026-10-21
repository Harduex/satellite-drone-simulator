import { expect, it, vi } from "vitest";
import * as Cesium from "cesium";
import { interpolatePose, TrafficRenderer } from "../TrafficRenderer";
import type { VehicleFrame } from "../../../traffic/TrafficTypes";
it.each([
  [5, "sports-wedge"], [6, "sports-berlinetta"], [7, "sports-turbo"],
])("loads sports model %i with vivid body paint", async (modelIndex, name) => {
  const loader = vi.spyOn(Cesium.Model, "fromGltfAsync").mockImplementation(
    async () => ({ destroy: vi.fn() }) as unknown as Cesium.Model,
  );
  const viewer = {
    scene: { primitives: { add: vi.fn(), remove: vi.fn() } },
    creditDisplay: { addStaticCredit: vi.fn(), removeStaticCredit: vi.fn() },
  } as unknown as Cesium.Viewer;
  const renderer = new TrafficRenderer(viewer, Cesium.Matrix4.IDENTITY, () => {});
  const pose = { position: { x: 0, y: 0, z: 0 }, heading: 0, pitch: 0 };
  try {
    for (let colorIndex = 0; colorIndex < 6; colorIndex++) {
      renderer.update([{
        id: colorIndex, modelIndex, colorIndex, previous: pose, current: pose,
        speed: 0, length: 4.2, edgeId: "a", distance: 0,
      }], 0);
      await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(colorIndex + 1));
      const options = loader.mock.calls[colorIndex]![0];
      expect(options.url).toContain(`${name}.glb`);
      const expected = Cesium.Color.fromCssColorString(
        ["#ffdb00", "#ff2020", "#1677ff"][colorIndex % 3]!,
      );
      expect(options.customShader!.uniforms.u_bodyColor!.value).toEqual(
        new Cesium.Cartesian3(expected.red, expected.green, expected.blue),
      );
    }
  } finally {
    renderer.dispose();
    loader.mockRestore();
  }
});
it("uses current scene exposure for loaded and late-loading cars", async () => {
  let resolve!: (model: Cesium.Model) => void;
  const loader = vi.spyOn(Cesium.Model, "fromGltfAsync").mockImplementation(
    () => new Promise(done => { resolve = done; }),
  );
  const viewer = {
    scene: { primitives: { add: vi.fn(), remove: vi.fn() } },
    creditDisplay: { addStaticCredit: vi.fn(), removeStaticCredit: vi.fn() },
  } as unknown as Cesium.Viewer;
  const pose = { position: { x: 0, y: 0, z: 0 }, heading: 0, pitch: 0 };
  const renderer = new TrafficRenderer(viewer, Cesium.Matrix4.IDENTITY, () => {});
  try {
    renderer.setEnvironmentExposure(0.025);
    renderer.update([{
      id: 1, modelIndex: 3, colorIndex: 0, previous: pose, current: pose,
      speed: 0, length: 4.343, edgeId: "a", distance: 0,
    }], 0);
    const options = loader.mock.calls[0]![0];
    expect(options.url).toContain("audi-a3.glb");
    const shader = options.customShader!;
    const paint = Cesium.Color.fromCssColorString("#b93832");
    expect(shader.uniforms.u_bodyColor!.value).toEqual(
      new Cesium.Cartesian3(paint.red, paint.green, paint.blue),
    );
    expect(shader.uniforms.u_environmentExposure!.value).toBe(0.025);
    renderer.setEnvironmentExposure(0.4);
    resolve({ destroy: vi.fn() } as unknown as Cesium.Model);
    await vi.waitFor(() => expect(viewer.scene.primitives.add).toHaveBeenCalledOnce());
    expect(shader.uniforms.u_environmentExposure!.value).toBe(0.4);
    renderer.setEnvironmentExposure(1);
    expect(shader.uniforms.u_environmentExposure!.value).toBe(1);
    renderer.setEnvironmentExposure(NaN);
    expect(shader.uniforms.u_environmentExposure!.value).toBe(1);
  } finally {
    renderer.dispose();
    loader.mockRestore();
  }
});
it("interpolates heading through north without spinning around", () => {
  const position = { x: 0, y: 0, z: 0 };
  const value = interpolatePose(
    { position, heading: Math.PI - 0.1, pitch: 0 },
    { position: { x: 10, y: 0, z: 0 }, heading: -Math.PI + 0.1, pitch: 0.2 },
    0.5,
  );
  expect(value.position.x).toBe(5);
  expect(Math.abs(value.heading)).toBeCloseTo(Math.PI);
  expect(value.pitch).toBeCloseTo(0.1);
});
it("discards an asset that finishes loading after disposal", async () => {
  let resolve!: (model: Cesium.Model) => void;
  const loader = vi.spyOn(Cesium.Model, "fromGltfAsync").mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const add = vi.fn(),
    remove = vi.fn(),
    removeCredit = vi.fn();
  const viewer = {
    scene: { primitives: { add, remove } },
    creditDisplay: {
      addStaticCredit: vi.fn(),
      removeStaticCredit: removeCredit,
    },
  } as unknown as Cesium.Viewer;
  const pose = { position: { x: 0, y: 0, z: 0 }, heading: 0, pitch: 0 };
  const frame: VehicleFrame = {
    id: 0,
    modelIndex: 0,
    colorIndex: 0,
    previous: pose,
    current: pose,
    speed: 0,
    length: 4.3,
    edgeId: "a",
    distance: 0,
  };
  const renderer = new TrafficRenderer(
    viewer,
    Cesium.Matrix4.IDENTITY,
    () => {},
  );
  try {
    renderer.update([frame], 0);
    renderer.dispose();
    const destroy = vi.fn();
    resolve({ destroy } as unknown as Cesium.Model);
    await vi.waitFor(() => expect(destroy).toHaveBeenCalledOnce());
    expect(add).not.toHaveBeenCalled();
    expect(renderer.getExclusions()).toEqual([]);
    expect(removeCredit).toHaveBeenCalledOnce();
  } finally {
    renderer.dispose();
    loader.mockRestore();
  }
});
it("does not retry failed models every render frame", async () => {
  const loader = vi
    .spyOn(Cesium.Model, "fromGltfAsync")
    .mockRejectedValue(new Error("missing asset"));
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  const viewer = {
    scene: { primitives: { add: vi.fn(), remove: vi.fn() } },
    creditDisplay: { addStaticCredit: vi.fn(), removeStaticCredit: vi.fn() },
  } as unknown as Cesium.Viewer;
  const pose = { position: { x: 0, y: 0, z: 0 }, heading: 0, pitch: 0 };
  const frame: VehicleFrame = {
    id: 0,
    modelIndex: 0,
    colorIndex: 0,
    previous: pose,
    current: pose,
    speed: 0,
    length: 4.3,
    edgeId: "a",
    distance: 0,
  };
  const renderer = new TrafficRenderer(
    viewer,
    Cesium.Matrix4.IDENTITY,
    () => {},
  );
  try {
    renderer.update([frame], 0);
    await vi.waitFor(() => expect(warning).toHaveBeenCalledOnce());
    for (let i = 0; i < 100; i++) renderer.update([{ ...frame, id: i }], 0);
    expect(loader).toHaveBeenCalledOnce();
  } finally {
    renderer.dispose();
    loader.mockRestore();
    warning.mockRestore();
  }
});
it("does not publish a model that finishes loading during pause", async () => {
  let resolve!: (model: Cesium.Model) => void;
  const loader = vi.spyOn(Cesium.Model, "fromGltfAsync").mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const add = vi.fn();
  const viewer = {
    scene: { primitives: { add, remove: vi.fn() } },
    creditDisplay: { addStaticCredit: vi.fn(), removeStaticCredit: vi.fn() },
  } as unknown as Cesium.Viewer;
  const pose = { position: { x: 100, y: 100, z: 0 }, heading: 0, pitch: 0 };
  const frame: VehicleFrame = {
    id: 0,
    modelIndex: 0,
    colorIndex: 0,
    previous: pose,
    current: pose,
    speed: 0,
    length: 4.3,
    edgeId: "a",
    distance: 0,
  };
  const renderer = new TrafficRenderer(
    viewer,
    Cesium.Matrix4.IDENTITY,
    () => {},
  );
  try {
    renderer.update([frame], 0);
    renderer.setPaused(true);
    const destroy = vi.fn();
    resolve({ destroy } as unknown as Cesium.Model);
    await vi.waitFor(() => expect(destroy).toHaveBeenCalledOnce());
    expect(add).not.toHaveBeenCalled();
  } finally {
    renderer.dispose();
    loader.mockRestore();
  }
});
