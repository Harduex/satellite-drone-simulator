import { describe, expect, it } from 'vitest';
import ModelSceneGraph from '@cesium/engine/Source/Scene/Model/ModelSceneGraph.js';
import SceneMode from '@cesium/engine/Source/Scene/SceneMode.js';

// Exercise the dependency directly so package updates cannot silently restore
// quadratic skin updates or sample joints before all transforms are current.
describe('Cesium animated scene graph', () => {
  it.each([1, 138])('updates skin matrices once after %i node transforms', count => {
    const events = [];
    const graph = {
      _model: { _projectTo2D: false },
      _runtimeNodes: Array.from({ length: count }, (_, i) => ({
        updateStages: [{ update: () => events.push(`node:${i}`) }],
        runtimePrimitives: [{ updateStages: [{ update: () => events.push(`primitive:${i}`) }] }],
      })),
      updateJointMatrices: () => events.push('skin'),
    };
    ModelSceneGraph.prototype.update.call(graph, { mode: SceneMode.SCENE3D }, true);
    expect(events.filter(event => event === 'skin')).toHaveLength(1);
    expect(events.indexOf('skin')).toBe(count);
    expect(events.indexOf('primitive:0')).toBe(count + 1);
  });

  it('skips skin updates when no animation changed', () => {
    let updates = 0;
    const graph = {
      _model: { _projectTo2D: false },
      _runtimeNodes: [],
      updateJointMatrices: () => updates++,
    };
    ModelSceneGraph.prototype.update.call(graph, { mode: SceneMode.SCENE3D }, false);
    expect(updates).toBe(0);
  });

  it('preserves projected 2D animation suppression and skips unreachable nodes', () => {
    const events = [];
    const graph = {
      _model: { _projectTo2D: true },
      _runtimeNodes: [undefined, {
        updateStages: [{ update: () => events.push('node') }],
        runtimePrimitives: [{ updateStages: [{ update: () => events.push('primitive') }] }],
      }],
      updateJointMatrices: () => events.push('skin'),
    };
    ModelSceneGraph.prototype.update.call(graph, { mode: SceneMode.SCENE2D }, true);
    expect(events).toEqual(['node', 'primitive']);
  });
});
