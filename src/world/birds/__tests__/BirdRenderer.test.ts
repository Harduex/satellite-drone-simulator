import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Cesium from 'cesium';
import { BirdRenderer } from '../BirdRenderer';
import type { BirdFrame, BirdSpecies } from '../../../birds/BirdTypes';

afterEach(() => vi.restoreAllMocks());

describe('BirdRenderer animation', () => {
  it.each<BirdSpecies>(['pigeon', 'seagull', 'eagle', 'swallow'])('updates exposure for a late-loading %s', async species => {
    let resolve!: (model: Cesium.Model) => void;
    const loader = vi.spyOn(Cesium.Model, 'fromGltfAsync').mockImplementation(() => new Promise(done => { resolve = done; }));
    const viewer = { scene: { primitives: { add: vi.fn(), remove: vi.fn() } } } as unknown as Cesium.Viewer;
    const renderer = new BirdRenderer(viewer, Cesium.Matrix4.IDENTITY, () => {});
    const pose = { position: { x: 0, y: 0, z: 20 }, heading: 0, pitch: 0, roll: 0, speed: 14 };
    try {
      renderer.setEnvironmentExposure(.1);
      renderer.update([{ id: 1, species, colorIndex: 0, previous: pose, current: pose, flapping: true }], 0, 0);
      const shader = loader.mock.calls[0]![0].customShader;
      expect(loader.mock.calls[0]![0].credit).toContain('dudecon');
      expect(loader.mock.calls[0]![0].credit).toContain('simonaskLDE');
      expect(loader.mock.calls[0]![0].credit).toContain('Nikola1998');
      expect(loader.mock.calls[0]![0].credit).toContain('creativecommons.org/licenses/by/4.0/');
      expect(loader.mock.calls[0]![0].showCreditsOnScreen).toBe(true);
      expect(shader?.uniforms.u_environmentExposure?.value).toBe(.1);
      renderer.setEnvironmentExposure(.4);
      resolve({ destroy: vi.fn() } as unknown as Cesium.Model);
      await vi.waitFor(() => expect(viewer.scene.primitives.add).toHaveBeenCalledOnce());
      expect(shader?.uniforms.u_environmentExposure?.value).toBe(.4);
    } finally { renderer.dispose(); }
  });
  it.each<BirdSpecies>(['pigeon', 'seagull', 'eagle', 'swallow'])(
    'advances %s wings independently of daylight and freezes them while paused',
    async species => {
      const add = vi.fn();
      const model = {
        ready: true,
        activeAnimations: { add, animateWhilePaused: false },
        modelMatrix: new Cesium.Matrix4(),
      } as unknown as Cesium.Model;
      vi.spyOn(Cesium.Model, 'fromGltfAsync').mockResolvedValue(model);
      const viewer = {
        scene: { primitives: { add: vi.fn(), remove: vi.fn() } },
      } as unknown as Cesium.Viewer;
      const renderer = new BirdRenderer(viewer, Cesium.Matrix4.IDENTITY, () => {});
      const pose = { position: { x: 0, y: 0, z: 20 }, heading: 0, pitch: 0, roll: 0, speed: 14 };
      const frame: BirdFrame = { id: 1, species, colorIndex: 0, previous: pose, current: pose, flapping: true };

      renderer.update([frame], 0, 0);
      await vi.waitFor(() => expect(viewer.scene.primitives.add).toHaveBeenCalled());
      renderer.update([frame], 0, 0);
      const options = add.mock.calls[0]![0];
      expect(options.animationTime).toBeTypeOf('function');
      // The second argument stays zero when the environment clock stays at noon.
      const atStart = options.animationTime(2, 0);
      renderer.update([frame], 0, 0.2);
      expect(options.animationTime(2, 0) - atStart).toBeCloseTo(0.1);
      renderer.setPaused(true);
      const pausedTime = options.animationTime(2, 0);
      renderer.update([frame], 0, 0.4);
      expect(options.animationTime(2, 0)).toBe(pausedTime);
      renderer.setPaused(false);
      renderer.update([frame], 0, 0.3);
      expect(options.animationTime(2, 0) - pausedTime).toBeCloseTo(0.05);
      renderer.dispose();
    },
  );
  it('settles wings into the glide pose and resumes flapping on escape', async () => {
    const add = vi.fn();
    const model = { ready: true, activeAnimations: { add, animateWhilePaused: false }, modelMatrix: new Cesium.Matrix4() } as unknown as Cesium.Model;
    vi.spyOn(Cesium.Model, 'fromGltfAsync').mockResolvedValue(model);
    const viewer = { scene: { primitives: { add: vi.fn(), remove: vi.fn() } } } as unknown as Cesium.Viewer;
    const renderer = new BirdRenderer(viewer, Cesium.Matrix4.IDENTITY, () => {});
    const pose = { position: { x: 0, y: 0, z: 30 }, heading: 0, pitch: 0, roll: 0, speed: 16 };
    const frame: BirdFrame = { id: 2, species: 'swallow', colorIndex: 0, previous: pose, current: pose, flapping: true };
    try {
      renderer.update([frame], 0, 0);
      await vi.waitFor(() => expect(viewer.scene.primitives.add).toHaveBeenCalledOnce());
      renderer.update([frame], 0, 0);
      const time = add.mock.calls[0]![0].animationTime;
      time(1, 0);
      renderer.update([{ ...frame, flapping: false }], 0, 1);
      expect(time(1, 0)).toBeCloseTo(0);
      renderer.update([{ ...frame, flapping: false }], 0, 2);
      expect(time(1, 0)).toBeCloseTo(0);
      renderer.update([frame], 0, 2.1);
      expect(time(1, 0)).toBeCloseTo(.1);
    } finally { renderer.dispose(); }
  });
});
