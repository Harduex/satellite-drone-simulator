import { describe, it, expect, vi } from 'vitest';
import * as Cesium from 'cesium';
import { BirdController } from '../BirdController';

describe('BirdController', () => {
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
