import { expect, it, vi } from 'vitest';
import * as Cesium from 'cesium';
import { PedestrianRenderer } from '../PedestrianRenderer';
import type { PedestrianFrame } from '../../../pedestrians/PedestrianTypes';
const pose = { position: { x: 0, y: 0, z: 0 }, heading: 0, pitch: 0 };
const frame: PedestrianFrame = { id: 1, edgeId: 'a', distance: 0, speed: 1.2, modelIndex: 0, colorIndex: 0, previous: pose, current: pose, walked: 1, previousWalked: .9 };
it('does not resurrect a model after pause or dispose', async () => {
    let resolve!: (model: Cesium.Model) => void;
    const load = vi.spyOn(Cesium.Model, 'fromGltfAsync').mockImplementation(() => new Promise(r => { resolve = r; }));
    const add = vi.fn(), remove = vi.fn(), destroy = vi.fn();
    const viewer = { scene: { primitives: { add, remove } }, creditDisplay: { addStaticCredit: vi.fn(), removeStaticCredit: vi.fn() } } as unknown as Cesium.Viewer;
    const renderer = new PedestrianRenderer(viewer, Cesium.Matrix4.IDENTITY, () => { });
    try {
        renderer.update([frame], 0);
        renderer.setPaused(true);
        resolve({ destroy } as unknown as Cesium.Model);
        await Promise.resolve();
        expect(destroy).toHaveBeenCalledOnce();
        expect(add).not.toHaveBeenCalled();
        renderer.dispose();
        renderer.dispose();
        expect(viewer.creditDisplay.removeStaticCredit).toHaveBeenCalledOnce();
    }
    finally {
        load.mockRestore();
    }
});
it('uses local native assets, shirt UV tint and actual primitive exclusions', async () => {
    const model = { modelMatrix: new Cesium.Matrix4(), destroy: vi.fn(), ready: true, activeAnimations: { add: vi.fn(), removeAll: vi.fn(), animateWhilePaused: false } } as unknown as Cesium.Model;
    const load = vi.spyOn(Cesium.Model, 'fromGltfAsync').mockResolvedValue(model);
    const add = vi.fn(), remove = vi.fn();
    const viewer = { scene: { primitives: { add, remove } }, creditDisplay: { addStaticCredit: vi.fn(), removeStaticCredit: vi.fn() } } as unknown as Cesium.Viewer;
    const renderer = new PedestrianRenderer(viewer, Cesium.Matrix4.IDENTITY, () => { });
    try {
        renderer.setEnvironmentExposure(.03);
        renderer.update([frame], .5);
        await Promise.resolve();
        expect(renderer.getExclusions()).toEqual([model]);
        const options = load.mock.calls[0]![0]!;
        expect(options.url).toContain('models/pedestrians/male-a.glb');
        expect(options.customShader!.fragmentShaderText).toContain('texCoord_0');
        expect(options.customShader!.fragmentShaderText).toContain('u_environmentExposure');
        renderer.update([frame], .5);
        expect(model.activeAnimations.animateWhilePaused).toBe(true);
        renderer.update([], 0);
        expect(remove).toHaveBeenCalledWith(model);
    }
    finally {
        renderer.dispose();
        load.mockRestore();
    }
});
