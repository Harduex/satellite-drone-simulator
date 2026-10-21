import { describe, it, expect, vi } from 'vitest';
import * as Cesium from 'cesium';
import { BirdController } from '../BirdController';
import { BirdRenderer } from '../../world/birds/BirdRenderer';

describe('BirdController', () => {
  it('advances wing time only during active flight and resets it for a new session', () => {
    let now = 0;
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
    const update = vi.spyOn(BirdRenderer.prototype, 'update').mockImplementation(() => {});
    const preUpdate = new Cesium.Event();
    const viewer = { scene: { preUpdate } } as unknown as Cesium.Viewer;
    const controller = new BirdController({
      viewer,
      enuFrame: Cesium.Matrix4.IDENTITY,
      spawn: { x: 0, y: 0, z: 100 },
      readDronePosition: () => ({ x: 0, y: 0, z: 100 }),
      exclusionsChanged: () => {},
    });
    try {
      controller.start();
      controller.setEnabled(true);
      now = 100;
      preUpdate.raiseEvent();
      expect(update.mock.lastCall?.[2]).toBeCloseTo(0.1);
      controller.pause();
      now = 10_000;
      preUpdate.raiseEvent();
      expect(update).toHaveBeenCalledTimes(1);
      controller.resume();
      now = 10_100;
      preUpdate.raiseEvent();
      expect(update.mock.lastCall?.[2]).toBeCloseTo(0.2);
      controller.reset();
      preUpdate.raiseEvent();
      expect(update.mock.lastCall?.[2]).toBe(0);
    } finally {
      controller.dispose();
      update.mockRestore();
      clock.mockRestore();
    }
  });

  it('manages lifecycle: starts when enabled, pauses, resumes, and disposes cleanly', () => {
    const preUpdateEvent = new Cesium.Event();
    const primitives = {
      add: vi.fn(),
      remove: vi.fn(),
    };
    const viewer = {
      scene: {
        preUpdate: preUpdateEvent,
        primitives,
      },
    } as unknown as Cesium.Viewer;

    const dronePos = { x: 0, y: 0, z: 100 };
    const exclusionsChanged = vi.fn();

    const controller = new BirdController({
      viewer,
      enuFrame: Cesium.Matrix4.IDENTITY,
      spawn: { x: 0, y: 0, z: 100 },
      readDronePosition: () => dronePos,
      exclusionsChanged,
    });

    controller.start();
    // Initially disabled, so no preUpdate tick work
    expect(exclusionsChanged).not.toHaveBeenCalled();

    // Enable birds
    controller.setEnabled(true);
    preUpdateEvent.raiseEvent();

    // Pause
    controller.pause();
    // Resume
    controller.resume();

    // Disable
    controller.setEnabled(false);
    expect(exclusionsChanged).toHaveBeenCalledWith([]);

    // Dispose
    controller.dispose();
  });
});
