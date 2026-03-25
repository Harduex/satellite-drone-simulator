import { describe, expect, it } from "vitest";
import {
  computeTranslationalDrag,
  computeTranslationalDragInto,
  computeAngularDrag,
  computeAngularDragInto,
} from "../DragModel";
import { DEFAULT_DRONE_CONFIG, Q_IDENTITY, quatFromEuler, vec3 } from "../types";
import type { Vector3 } from "../types";

describe("DragModel Into parity", () => {
  describe("computeTranslationalDragInto", () => {
    it("returns same reference as out", () => {
      const out: Vector3 = { x: 0, y: 0, z: 0 };
      const result = computeTranslationalDragInto(
        vec3(5, 0, 0), Q_IDENTITY, DEFAULT_DRONE_CONFIG, out,
      );
      expect(result).toBe(out);
    });

    it("matches allocating version for identity quaternion", () => {
      const vel = vec3(3, -4, 2);
      const expected = computeTranslationalDrag(vel, Q_IDENTITY, DEFAULT_DRONE_CONFIG);
      const out: Vector3 = { x: 0, y: 0, z: 0 };
      computeTranslationalDragInto(vel, Q_IDENTITY, DEFAULT_DRONE_CONFIG, out);
      expect(out.x).toBeCloseTo(expected.x, 8);
      expect(out.y).toBeCloseTo(expected.y, 8);
      expect(out.z).toBeCloseTo(expected.z, 8);
    });

    it("matches allocating version for rotated body", () => {
      const vel = vec3(10, -5, 3);
      const q = quatFromEuler(0.3, -0.2, 0.5);
      const expected = computeTranslationalDrag(vel, q, DEFAULT_DRONE_CONFIG);
      const out: Vector3 = { x: 0, y: 0, z: 0 };
      computeTranslationalDragInto(vel, q, DEFAULT_DRONE_CONFIG, out);
      expect(out.x).toBeCloseTo(expected.x, 6);
      expect(out.y).toBeCloseTo(expected.y, 6);
      expect(out.z).toBeCloseTo(expected.z, 6);
    });

    it("returns zero for zero velocity (v3MagnitudeSq threshold)", () => {
      const out: Vector3 = { x: 99, y: 99, z: 99 };
      computeTranslationalDragInto(vec3(0, 0, 0), Q_IDENTITY, DEFAULT_DRONE_CONFIG, out);
      expect(out).toEqual({ x: 0, y: 0, z: 0 });
    });

    it("returns zero for sub-threshold velocity", () => {
      const out: Vector3 = { x: 99, y: 99, z: 99 };
      // v3MagnitudeSq < 1e-12 means magnitude < ~1e-6
      computeTranslationalDragInto(vec3(1e-7, 0, 0), Q_IDENTITY, DEFAULT_DRONE_CONFIG, out);
      expect(out).toEqual({ x: 0, y: 0, z: 0 });
    });

    it("drag opposes velocity direction", () => {
      const vel = vec3(10, 0, 0);
      const out: Vector3 = { x: 0, y: 0, z: 0 };
      computeTranslationalDragInto(vel, Q_IDENTITY, DEFAULT_DRONE_CONFIG, out);
      expect(out.x).toBeLessThan(0);
    });
  });

  describe("computeAngularDragInto", () => {
    it("returns same reference as out", () => {
      const out: Vector3 = { x: 0, y: 0, z: 0 };
      const result = computeAngularDragInto(vec3(5, 0, 0), out);
      expect(result).toBe(out);
    });

    it("matches allocating version", () => {
      const omega = vec3(3, -2, 1);
      const expected = computeAngularDrag(omega);
      const out: Vector3 = { x: 0, y: 0, z: 0 };
      computeAngularDragInto(omega, out);
      expect(out.x).toBeCloseTo(expected.x, 10);
      expect(out.y).toBeCloseTo(expected.y, 10);
      expect(out.z).toBeCloseTo(expected.z, 10);
    });

    it("returns zero for zero angular velocity", () => {
      const out: Vector3 = { x: 99, y: 99, z: 99 };
      computeAngularDragInto(vec3(0, 0, 0), out);
      expect(out).toEqual({ x: 0, y: 0, z: 0 });
    });

    it("returns zero for sub-threshold angular velocity", () => {
      const out: Vector3 = { x: 99, y: 99, z: 99 };
      computeAngularDragInto(vec3(1e-7, 0, 0), out);
      expect(out).toEqual({ x: 0, y: 0, z: 0 });
    });

    it("opposes angular velocity direction", () => {
      const omega = vec3(5, -3, 2);
      const out: Vector3 = { x: 0, y: 0, z: 0 };
      computeAngularDragInto(omega, out);
      expect(Math.sign(out.x)).toBe(-Math.sign(omega.x));
      expect(Math.sign(out.y)).toBe(-Math.sign(omega.y));
      expect(Math.sign(out.z)).toBe(-Math.sign(omega.z));
    });

    it("quadratic: doubling speed quadruples drag", () => {
      const out1: Vector3 = { x: 0, y: 0, z: 0 };
      const out2: Vector3 = { x: 0, y: 0, z: 0 };
      computeAngularDragInto(vec3(0, 0, 5), out1);
      computeAngularDragInto(vec3(0, 0, 10), out2);
      const ratio = Math.abs(out2.z) / Math.abs(out1.z);
      expect(ratio).toBeCloseTo(4.0, 0);
    });
  });
});
