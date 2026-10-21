import { afterEach, expect, it, vi } from 'vitest';
import { PerformanceTimings } from '../PerformanceTimings';

afterEach(() => vi.restoreAllMocks());

it('keeps recent bounded timing samples and retains an outlier in tail statistics', () => {
  const timings = new PerformanceTimings();
  timings.setEnabled(true);
  for (let i = 0; i < 650; i++) timings.record('physics', 1);
  timings.record('physics', 100);
  expect(timings.snapshot().stages.physics).toEqual({
    count: 600, meanMs: 1.165, medianMs: 1, p95Ms: 1, p99Ms: 1, maxMs: 100,
  });
});

it('does not read the clock or retain samples while disabled', () => {
  const clock = vi.spyOn(performance, 'now').mockReturnValue(12);
  const timings = new PerformanceTimings();
  const start = timings.begin();
  timings.end('physics', start);
  timings.record('physics', 30);
  expect(clock).not.toHaveBeenCalled();
  expect(timings.snapshot().stages.physics.count).toBe(0);
});

it('discards old samples on disable and ignores invalid durations', () => {
  const timings = new PerformanceTimings();
  timings.setEnabled(true);
  timings.record('contacts', 12);
  timings.record('contacts', NaN);
  timings.record('contacts', -1);
  expect(timings.snapshot().stages.contacts.count).toBe(1);
  timings.setEnabled(false);
  timings.setEnabled(true);
  expect(timings.snapshot().stages.contacts.count).toBe(0);
});
