import { describe, it, expect, vi } from 'vitest';
import * as Cesium from 'cesium';
import { BirdController } from '../BirdController';
import { BirdRenderer } from '../../world/birds/BirdRenderer';
import { BirdSimulation } from '../../birds/BirdSimulation';
import { PerformanceTimings } from '../PerformanceTimings';

describe('BirdController', () => {
  it.each([0, Math.PI / 2, Math.PI, -Math.PI / 2])('uses the tilted ECEF camera frustum at heading %s', heading => {
    let now = 0;
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
    const event = new Cesium.Event();
    const frame = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(2.2945, 48.8584));
    const direction = new Cesium.Cartesian3(Math.sin(heading) * Math.cos(.4), Math.cos(heading) * Math.cos(.4), Math.sin(.4));
    const up = new Cesium.Cartesian3(-Math.sin(heading) * Math.sin(.4), -Math.cos(heading) * Math.sin(.4), Math.cos(.4));
    const frustum = new Cesium.PerspectiveFrustum({ fov: Math.PI / 2, aspectRatio: 1.5, near: .1, far: 5000 });
    const camera = {
      positionWC: Cesium.Matrix4.multiplyByPoint(frame, new Cesium.Cartesian3(0, 0, 100), new Cesium.Cartesian3()),
      directionWC: Cesium.Matrix4.multiplyByPointAsVector(frame, direction, new Cesium.Cartesian3()),
      upWC: Cesium.Matrix4.multiplyByPointAsVector(frame, up, new Cesium.Cartesian3()), frustum,
    };
    const visible = vi.spyOn(BirdSimulation.prototype, 'maintainPopulation').mockImplementation((_center, isVisible) => {
      expect(isVisible({ x: direction.x * 200, y: direction.y * 200, z: 100 + direction.z * 200 })).toBe(true);
      expect(isVisible({ x: -direction.x * 200, y: -direction.y * 200, z: 100 - direction.z * 200 })).toBe(false);
    });
    const update = vi.spyOn(BirdRenderer.prototype, 'update').mockImplementation(() => {});
    const controller = new BirdController({ viewer: { scene: { preUpdate: event, camera } } as unknown as Cesium.Viewer,
      enuFrame: frame, spawn: { x: 0, y: 0, z: 100 }, readDronePosition: () => ({ x: 0, y: 0, z: 100 }), exclusionsChanged: () => {} });
    try {
      controller.setEnabled(true); controller.start(); now = 100; event.raiseEvent();
      expect(visible).toHaveBeenCalledOnce();
    } finally { controller.dispose(); clock.mockRestore(); visible.mockRestore(); update.mockRestore(); }
  });
  it('retains visible chase targets when flight moves beyond the old reset threshold', () => {
    let now = 0;
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
    const event = new Cesium.Event();
    const position = { x: 0, y: 0, z: 100 };
    const spawn = vi.spyOn(BirdSimulation.prototype, 'spawnFlocks');
    const update = vi.spyOn(BirdRenderer.prototype, 'update').mockImplementation(() => {});
    const frame = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(0, 0));
    const viewer = { scene: { preUpdate: event, camera: {
      positionWC: new Cesium.Cartesian3(), directionWC: new Cesium.Cartesian3(1, 0, 0),
      upWC: new Cesium.Cartesian3(0, 0, 1),
      frustum: { computeCullingVolume: () => ({ computeVisibility: () => Cesium.Intersect.INTERSECTING }) },
    } } } as unknown as Cesium.Viewer;
    const controller = new BirdController({ viewer, enuFrame: frame, spawn: { ...position },
      readDronePosition: () => position, exclusionsChanged: () => {} });
    try {
      controller.setEnabled(true);
      controller.start();
      now = 100; event.raiseEvent();
      const initialIds = update.mock.lastCall![0].map(b => b.id);
      position.x = 3000;
      now = 200; event.raiseEvent();
      expect(spawn).toHaveBeenCalledOnce();
      expect(update.mock.lastCall![0].map(b => b.id)).toEqual(initialIds);
    } finally {
      controller.dispose(); clock.mockRestore(); spawn.mockRestore(); update.mockRestore();
    }
  });
  it('advances wing time only during active flight and resets it for a new session', () => {
    let now = 0;
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
    const update = vi.spyOn(BirdRenderer.prototype, 'update').mockImplementation(() => {});
    const preUpdate = new Cesium.Event();
    const timings = new PerformanceTimings();
    timings.setEnabled(true);
    const viewer = { scene: { preUpdate } } as unknown as Cesium.Viewer;
    const controller = new BirdController({
      viewer,
      enuFrame: Cesium.Matrix4.IDENTITY,
      spawn: { x: 0, y: 0, z: 100 },
      readDronePosition: () => ({ x: 0, y: 0, z: 100 }),
      exclusionsChanged: () => {},
      timings,
    });
    try {
      controller.start();
      controller.setEnabled(true);
      now = 100;
      preUpdate.raiseEvent();
      expect(update.mock.lastCall?.[2]).toBeCloseTo(0.1);
      expect(timings.snapshot().stages.birds.count).toBe(1);
      expect(timings.snapshot().stages.birdActors.count).toBe(1);
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
