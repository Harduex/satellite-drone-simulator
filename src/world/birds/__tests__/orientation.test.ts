import { describe, it, expect } from 'vitest';
import * as Cesium from 'cesium';
import { makeBirdRotation } from '../BirdRenderer';

describe('makeBirdRotation orientation', () => {
  it('points North (+Y) when heading is 0', () => {
    const rot = makeBirdRotation(0, 0, 0);
    const forward = new Cesium.Cartesian3(0, 1, 0);
    const rotated = Cesium.Matrix3.multiplyByVector(rot, forward, new Cesium.Cartesian3());

    expect(rotated.x).toBeCloseTo(0, 2);
    expect(rotated.y).toBeCloseTo(1, 2);
    expect(rotated.z).toBeCloseTo(0, 2);
  });

  it('points East (+X) when heading is 90 degrees (pi/2)', () => {
    const rot = makeBirdRotation(Math.PI / 2, 0, 0);
    const forward = new Cesium.Cartesian3(0, 1, 0);
    const rotated = Cesium.Matrix3.multiplyByVector(rot, forward, new Cesium.Cartesian3());

    expect(rotated.x).toBeCloseTo(1, 2);
    expect(rotated.y).toBeCloseTo(0, 2);
    expect(rotated.z).toBeCloseTo(0, 2);
  });

  it('points South (-Y) when heading is 180 degrees (pi)', () => {
    const rot = makeBirdRotation(Math.PI, 0, 0);
    const forward = new Cesium.Cartesian3(0, 1, 0);
    const rotated = Cesium.Matrix3.multiplyByVector(rot, forward, new Cesium.Cartesian3());

    expect(rotated.x).toBeCloseTo(0, 2);
    expect(rotated.y).toBeCloseTo(-1, 2);
    expect(rotated.z).toBeCloseTo(0, 2);
  });

  it('climbs upward (+Z) when pitch is positive', () => {
    const rot = makeBirdRotation(0, Math.PI / 4, 0);
    const forward = new Cesium.Cartesian3(0, 1, 0);
    const rotated = Cesium.Matrix3.multiplyByVector(rot, forward, new Cesium.Cartesian3());

    expect(rotated.z).toBeCloseTo(Math.SQRT1_2, 2);
    expect(rotated.y).toBeCloseTo(Math.SQRT1_2, 2);
  });

  it('banks right when roll is positive', () => {
    const rot = makeBirdRotation(0, 0, Math.PI / 4);
    const rightWing = new Cesium.Cartesian3(1, 0, 0);
    const rotated = Cesium.Matrix3.multiplyByVector(rot, rightWing, new Cesium.Cartesian3());

    // When rolled right, right wing drops (-Z)
    expect(rotated.z).toBeLessThan(-0.5);
    expect(rotated.x).toBeGreaterThan(0.5);
  });
});
