// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as Cesium from 'cesium';
import { DronePreviewRenderer } from '../DronePreviewRenderer';

const backend = vi.hoisted(() => ({ render: () => {}, destroy: vi.fn(), lookAt: vi.fn() }));
vi.mock('cesium', async importOriginal => {
  const actual = await importOriginal<typeof import('cesium')>();
  return { ...actual, CesiumWidget: class {
    scene = {
      canvas: document.createElement('canvas'),
      screenSpaceCameraController: { enableInputs: true },
      camera: { frustum: {}, lookAtTransform: backend.lookAt },
      renderError: new actual.Event(),
      primitives: { add: vi.fn() },
      requestRender: vi.fn(),
    };
    resize() {}
    render() { backend.render(); }
    isDestroyed() { return false; }
    destroy = backend.destroy;
  } };
});

let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
beforeEach(() => {
  frames = new Map(); nextFrame = 0;
  backend.lookAt.mockClear();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback); return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});

it.each([false, true])('retains orbit rotation, clamps vertical travel, and resets (reduced motion: %s)', async reducedMotion => {
  const model = createModel();
  vi.spyOn(Cesium.Model, 'fromGltfAsync').mockResolvedValue(model as unknown as Cesium.Model);
  let ready = false;
  backend.render = () => { if (!ready) { ready = true; model.readyEvent.raiseEvent(model); } };
  const renderer = new DronePreviewRenderer(document.createElement('div'), vi.fn());
  const flush = () => {
    for (let count = 0; frames.size && count < 80; count++) {
      const pending = [...frames.values()]; frames.clear();
      pending.forEach(callback => callback(count * 16));
    }
  };
  try {
    renderer.setReducedMotion(reducedMotion);
    const loading = renderer.load(); await Promise.resolve(); flush(); await loading;
    renderer.rotateBy(Math.PI / 2, -10);
    flush();
    let orbit = backend.lookAt.mock.calls.at(-1)![1] as Cesium.HeadingPitchRange;
    expect(orbit.heading).toBeCloseTo(0.6 + Math.PI / 2, 2);
    expect(orbit.pitch).toBeCloseTo(-1.45, 2);
    expect(frames.size).toBe(0);
    renderer.resetView(); flush();
    orbit = backend.lookAt.mock.calls.at(-1)![1] as Cesium.HeadingPitchRange;
    expect(orbit.heading).toBeCloseTo(0.6, 2);
    expect(orbit.pitch).toBeCloseTo(-0.5, 2);
  } finally { renderer.destroy(); }
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function createModel() {
  return {
    readyEvent: new Cesium.Event(), errorEvent: new Cesium.Event(),
    imageBasedLighting: new Cesium.ImageBasedLighting(),
    boundingSphere: new Cesium.BoundingSphere(Cesium.Cartesian3.ZERO, 1),
    destroy: vi.fn(),
  };
}

it.each([false, true])('finishes textures before idling without pointer input (reduced motion: %s)', async reducedMotion => {
  const model = createModel();
  let incrementalTextures = true;
  let geometryReady = false;
  let texturesReady = false;
  let processedFrames = 0;
  vi.spyOn(Cesium.Model, 'fromGltfAsync').mockImplementation(async options => {
    incrementalTextures = options.incrementallyLoadTextures ?? true;
    return model as unknown as Cesium.Model;
  });
  // Cesium processes textures across frames and can raise readyEvent before them.
  backend.render = () => {
    processedFrames++;
    texturesReady = processedFrames >= 4;
    if (!geometryReady && (incrementalTextures || texturesReady)) {
      geometryReady = true;
      model.readyEvent.raiseEvent(model);
    }
  };
  const renderer = new DronePreviewRenderer(document.createElement('div'), vi.fn());
  try {
    renderer.setReducedMotion(reducedMotion);
    const loading = renderer.load();
    await Promise.resolve();
    for (let count = 0; frames.size && count < 20; count++) {
      const pending = [...frames.values()]; frames.clear();
      pending.forEach(callback => callback(count * 16));
    }
    expect(texturesReady).toBe(true);
    expect(frames.size).toBe(0);
    await loading;
  } finally { renderer.destroy(); }
});

it('supplies complete studio lighting without asynchronous atmospheric maps', async () => {
  const model = createModel();
  const loadModel = vi.spyOn(Cesium.Model, 'fromGltfAsync').mockResolvedValue(model as unknown as Cesium.Model);
  const renderer = new DronePreviewRenderer(document.createElement('div'), vi.fn());
  try {
    void renderer.load();
    await Promise.resolve();
    const options = loadModel.mock.calls[0]![0];
    expect(options.environmentMapOptions?.enabled).toBe(false);
    expect(model.imageBasedLighting.sphericalHarmonicCoefficients[0]?.x).toBeGreaterThan(0);
    expect(model.imageBasedLighting.imageBasedLightingFactor.y).toBe(0);
  } finally { renderer.destroy(); }
});

it('settles pending loading and cancels frames when disposed', async () => {
  const model = createModel();
  vi.spyOn(Cesium.Model, 'fromGltfAsync').mockResolvedValue(model as unknown as Cesium.Model);
  backend.render = () => {};
  const renderer = new DronePreviewRenderer(document.createElement('div'), vi.fn());
  let complete = false;
  const loading = renderer.load().then(() => { complete = true; });
  try {
    await Promise.resolve(); await Promise.resolve();
    expect(complete).toBe(false);
    renderer.destroy();
    await loading;
    expect(frames.size).toBe(0);
  } finally { renderer.destroy(); }
});

it('does not report ready until the model has been drawn with its camera framing', async () => {
  const model = createModel();
  vi.spyOn(Cesium.Model, 'fromGltfAsync').mockResolvedValue(model as unknown as Cesium.Model);
  let firstFrame = true;
  backend.render = () => {
    if (firstFrame) { firstFrame = false; model.readyEvent.raiseEvent(model); }
  };
  const renderer = new DronePreviewRenderer(document.createElement('div'), vi.fn());
  let complete = false;
  const loading = renderer.load().then(() => { complete = true; });
  try {
    await Promise.resolve();
    const initial = [...frames.values()]; frames.clear();
    initial.forEach(callback => callback(0));
    await Promise.resolve(); await Promise.resolve();
    expect(complete).toBe(false);
    const framed = [...frames.values()]; frames.clear();
    framed.forEach(callback => callback(16));
    await loading;
    expect(complete).toBe(true);
    expect(frames.size).toBe(0);
  } finally { renderer.destroy(); }
});
