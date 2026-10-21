import { afterEach, expect, it, vi } from 'vitest';
import * as Cesium from 'cesium';
import { PopulationSurfaceScheduler } from '../PopulationSurfaceScheduler';

afterEach(() => vi.restoreAllMocks());

function fixture() {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const scene = { preUpdate: new Cesium.Event(), postUpdate: new Cesium.Event() };
  const sampled: string[] = [];
  const prepare = (name: string) => (allow: () => boolean) => {
    while (allow()) { sampled.push(name); now += 4; }
  };
  const scheduler = new PopulationSurfaceScheduler(scene, prepare('roads'), prepare('paths'));
  scheduler.start();
  const frame = (flightMs = 0) => {
    now += 20;
    scene.preUpdate.raiseEvent();
    now += flightMs;
    scene.postUpdate.raiseEvent();
  };
  return { scene, sampled, scheduler, frame };
}

it('shares a non-preemptible query allowance and alternates the leading queue', () => {
  const f = fixture();
  f.frame();
  expect(f.sampled).toEqual(['roads']);
  f.frame();
  expect(f.sampled).toEqual(['roads', 'paths']);
  f.scheduler.dispose();
});

it('yields to expensive flight updates and resumes both queues when time is available', () => {
  const f = fixture();
  f.frame(30);
  expect(f.sampled).toEqual([]);
  f.frame(); f.frame();
  expect(f.sampled).toEqual(['roads', 'paths']);
  f.scheduler.dispose();
});

it('does no preparation while paused and removes listeners on disposal', () => {
  const f = fixture();
  f.scheduler.setPaused(true);
  f.frame();
  expect(f.sampled).toEqual([]);
  f.scheduler.setPaused(false);
  f.frame();
  expect(f.sampled).toEqual(['roads']);
  f.scheduler.dispose(); f.scheduler.dispose();
  expect(f.scene.preUpdate.numberOfListeners).toBe(0);
  expect(f.scene.postUpdate.numberOfListeners).toBe(0);
});

it('limits cheap queries across both queues and lets one active queue use the allowance', () => {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const scene = { preUpdate: new Cesium.Event(), postUpdate: new Cesium.Event() };
  const sampled: string[] = [];
  const prepare = (allow: () => boolean) => {
    while (allow()) { sampled.push('paths'); now += 0.1; }
  };
  const scheduler = new PopulationSurfaceScheduler(scene, () => {}, prepare);
  scheduler.start(); scheduler.start();
  scene.preUpdate.raiseEvent(); scene.postUpdate.raiseEvent();
  expect(sampled).toEqual(['paths', 'paths']);
  now = 20;
  scene.preUpdate.raiseEvent(); scene.postUpdate.raiseEvent();
  expect(sampled).toEqual(['paths', 'paths', 'paths', 'paths']);
  scheduler.dispose();
});

it('does not consume preparation time before flight has finished on start or resume', () => {
  const f = fixture();
  const observations: string[] = [];
  f.scene.preUpdate.addEventListener(() => observations.push('flight'));
  f.frame();
  expect(observations).toEqual(['flight']);
  expect(f.sampled).toEqual(['roads']);
  f.scheduler.setPaused(true); f.frame();
  f.scheduler.setPaused(false); f.frame(30);
  expect(f.sampled).toEqual(['roads']);
  f.scheduler.dispose();
});

it('prevents starvation and processes queries after repeated frame overruns', () => {
  const f = fixture();
  f.frame(30); // starved 1
  f.frame(30); // starved 2
  f.frame(30); // starved 3
  expect(f.sampled).toEqual([]);
  f.frame(30); // starved 4 -> triggers guaranteed query
  expect(f.sampled).toEqual(['roads']);
  f.scheduler.dispose();
});
