import { expect, it, vi } from 'vitest';
import * as Cesium from 'cesium';
import { PedestrianController } from '../PedestrianController';
import { RoadSource } from '../../traffic/RoadSource';
it('refreshes moving pedestrian coverage and cancels paused/disposed work', async () => {
    const load = vi.spyOn(RoadSource.prototype, 'loadTiles').mockResolvedValue([]);
    let now = 0;
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
    const event = new Cesium.Event(), position = { x: 0, y: 0, z: 50 };
    const viewer = { scene: { preUpdate: event, sampleHeightSupported: false }, creditDisplay: { addStaticCredit: vi.fn(), removeStaticCredit: vi.fn() } } as unknown as Cesium.Viewer;
    const controller = new PedestrianController({ viewer, enuFrame: Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(2.2945, 48.8584)), spawn: { ...position }, readDronePosition: () => position, readBaseExclusions: () => [], exclusionsChanged: () => { }, publish: () => { }, diagnosticsEnabled: () => false });
    try {
        controller.setEnabled(true);
        controller.start();
        await Promise.resolve();
        expect(load).toHaveBeenCalledTimes(1);
        position.x = 160;
        now = 1000;
        event.raiseEvent();
        now = 1301;
        event.raiseEvent();
        await Promise.resolve();
        expect(load).toHaveBeenCalledTimes(2);
        expect(load.mock.calls[1]![0].length).toBeLessThanOrEqual(9);
        controller.pause();
        position.x = 2500;
        now = 3000;
        event.raiseEvent();
        expect(load).toHaveBeenCalledTimes(2);
        controller.setEnabled(false);
        controller.dispose();
        controller.dispose();
        expect(event.numberOfListeners).toBe(0);
    }
    finally {
        controller.dispose();
        load.mockRestore();
        clock.mockRestore();
    }
});
