// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as Cesium from 'cesium';
import { DronePreviewRenderer } from '../DronePreviewRenderer';

const backend = vi.hoisted(() => ({ render: () => {}, destroy: vi.fn() }));
vi.mock('cesium', async importOriginal => {
  const actual = await importOriginal<typeof import('cesium')>();
  return { ...actual, CesiumWidget: class {
    scene = {
      canvas: document.createElement('canvas'),
      screenSpaceCameraController: { enableInputs: true },
      camera: { frustum: {}, lookAtTransform: vi.fn() },
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
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback); return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each([false, true])('finishes textures before idling without pointer input (reduced motion: %s)', async reducedMotion => {
  const model = {
    readyEvent: new Cesium.Event(),
    boundingSphere: new Cesium.BoundingSphere(Cesium.Cartesian3.ZERO, 1),
  };
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
    await renderer.load();
    for (let count = 0; frames.size && count < 20; count++) {
      const pending = [...frames.values()]; frames.clear();
      pending.forEach(callback => callback(count * 16));
    }
    expect(texturesReady).toBe(true);
    expect(frames.size).toBe(0);
  } finally { renderer.destroy(); }
});
