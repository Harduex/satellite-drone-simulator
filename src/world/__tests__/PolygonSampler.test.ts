import { describe, expect, it } from 'vitest';
import { createPolygonSampler } from '../PolygonSampler';

const rectangle = (west: number, south: number, east: number, north: number) =>
  [[[west, south], [east, south], [east, north], [west, north], [west, south]]] as [number, number][][];
const draws = (...values: number[]) => () => values.shift()!;

describe('geographic area sampling', () => {
  it('weights disjoint regions by spherical area rather than region count', () => {
    const sample = createPolygonSampler([rectangle(0, 0, 1, 1), rectangle(10, 0, 14, 1)]);
    expect(sample(draws(0.3, 0.5, 0.5)).lng).toBe(12);
  });
  it('samples latitude in equal-area space', () => {
    const sample = createPolygonSampler([rectangle(0, 60, 1, 80)]);
    expect(sample(() => 0.5).lat).toBeCloseTo(67.73, 1);
  });
  it('rejects holes instead of placing candidates in excluded areas', () => {
    const polygon = rectangle(0, 0, 10, 10);
    polygon.push(rectangle(4, 4, 6, 6)[0]!);
    const point = createPolygonSampler([polygon])(draws(0.5, 0.5, 0.5, 0.5, 0.1, 0.1));
    expect(point.lng).toBe(1);
    expect(point.lat).toBeLessThan(2);
  });
  it('bounds rejection and reports an unusable random source', () => {
    const polygon = rectangle(0, 0, 10, 10);
    polygon.push(rectangle(4, 4, 6, 6)[0]!);
    expect(() => createPolygonSampler([polygon])(() => 0.5)).toThrow(/urban/i);
  });
});
