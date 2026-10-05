import { describe, expect, it } from "vitest";
import { WindModel } from "../WindModel";

describe("fair-weather wind", () => {
  it("supports Calm and bounds configured gusts around the mean", () => {
    const model = new WindModel({ windSpeed: 4, windDirection: 0, windGustStrength: 1 }, 7);
    const out = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 60000; i++) {
      model.updateInto(0.002, out);
      expect(Math.hypot(out.x, out.y + 4)).toBeLessThanOrEqual(1 + 1e-9);
      expect(Math.abs(out.z)).toBeLessThanOrEqual(0.1 + 1e-9);
    }
    model.setConfig({ windSpeed: 0, windDirection: 90, windGustStrength: 0 });
    model.updateInto(0.002, out);
    expect(out).toEqual({ x: 0, y: 0, z: 0 });
  });
  it("stays near a gentle breeze with small, smooth vertical variation", () => {
    const model = new WindModel();
    const out = { x: 0, y: 0, z: 0 };
    let previous = { ...model.updateInto(0, out) };
    let minimum = Infinity;
    let maximum = 0;
    for (let i = 0; i < 60000; i++) {
      expect(model.updateInto(0.002, out)).toBe(out);
      const speed = Math.hypot(out.x, out.y);
      minimum = Math.min(minimum, speed);
      maximum = Math.max(maximum, speed);
      expect(speed).toBeGreaterThan(1.1);
      expect(speed).toBeLessThan(1.9);
      expect(Math.abs(out.z)).toBeLessThanOrEqual(0.05);
      expect(Math.hypot(out.x - previous.x, out.y - previous.y, out.z - previous.z)).toBeLessThan(0.001);
      previous = { ...out };
    }
    expect(maximum - minimum).toBeGreaterThan(0.2);
  });

  it("advances only with simulation time and resets reproducibly", () => {
    const model = new WindModel();
    const out = { x: 0, y: 0, z: 0 };
    const initial = { ...model.updateInto(0, out) };
    model.updateInto(10, out);
    const paused = { ...out };
    model.updateInto(0, out);
    expect(out).toEqual(paused);
    model.reset();
    model.updateInto(0, out);
    expect(out).toEqual(initial);
  });

  it("gives the same breeze at the same elapsed simulation time", () => {
    const a = new WindModel();
    const b = new WindModel();
    const outA = { x: 0, y: 0, z: 0 };
    const outB = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 5000; i++) a.updateInto(0.002, outA);
    b.updateInto(10, outB);
    expect(outA.x).toBeCloseTo(outB.x, 10);
    expect(outA.y).toBeCloseTo(outB.y, 10);
    expect(outA.z).toBeCloseTo(outB.z, 10);
  });
});
