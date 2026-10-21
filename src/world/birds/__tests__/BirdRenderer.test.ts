import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Cesium from 'cesium';
import { BirdRenderer } from '../BirdRenderer';
import type { BirdFrame, BirdSpecies } from '../../../birds/BirdTypes';

afterEach(() => vi.restoreAllMocks());

describe('BirdRenderer animation', () => {
  it.each<BirdSpecies>(['pigeon', 'seagull', 'eagle'])(
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
});
