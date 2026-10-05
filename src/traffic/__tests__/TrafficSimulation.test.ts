import { expect, it } from 'vitest';
import { TrafficSimulation, demandMultiplier } from '../TrafficSimulation';
import { buildRoadGraph } from '../RoadGraph';
it('demand follows noon and quiet nighttime without invalid multipliers', () => {
  expect(demandMultiplier(12)).toBe(1);
  expect(demandMultiplier(2)).toBe(.35);
  expect(demandMultiplier(NaN)).toBe(1);
});
it('preserves seeded cars across graph refresh and respects the population cap', () => {
  const graph = buildRoadGraph([{ id:'a', roadClass:'motorway', oneway:1, bridge:false, layer:0,
    points:[{x:0,y:0,z:0},{x:0,y:900,z:0}] }], {x:0,y:0,z:0});
  const a = new TrafficSimulation(42, [4.3,4,4.6]), b = new TrafficSimulation(42, [4.3,4,4.6]);
  for (const simulation of [a,b]) { simulation.setGraph(graph); simulation.reset({x:0,y:0,z:0}); }
  expect(a.getFrames()).toEqual(b.getFrames());
  const ids = a.getFrames().map(f=>f.id); a.setGraph(graph);
  expect(a.getFrames().map(f=>f.id)).toEqual(ids);
  for(let i=0;i<100;i++) a.step(.1);
  expect(a.getFrames().length).toBeLessThanOrEqual(150);
});
