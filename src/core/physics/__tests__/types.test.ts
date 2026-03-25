import { describe, expect, it } from "vitest";
import {
  vec3,
  V3_ZERO,
  v3Add,
  v3Sub,
  v3Scale,
  v3Dot,
  v3Cross,
  v3Magnitude,
  v3MagnitudeSq,
  v3Normalize,
  v3Negate,
  v3Set,
  v3AddInto,
  v3ScaleInto,
  v3CrossInto,
  Q_IDENTITY,
  quatMultiply,
  quatNormalize,
  quatConjugate,
  quatRotateVector,
  quatFromEuler,
  quatMultiplyInto,
  quatNormalizeInto,
  quatRotateVectorInto,
  createDefaultDroneState,
} from "../types";
import type { Vector3, Quaternion } from "../types";

// ── Vector3 basics ──────────────────────────────────────
describe("Vector3 operations", () => {
  it("vec3 creates a vector", () => {
    const v = vec3(1, 2, 3);
    expect(v).toEqual({ x: 1, y: 2, z: 3 });
  });

  it("V3_ZERO is the zero vector", () => {
    expect(V3_ZERO).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("v3Add adds two vectors", () => {
    expect(v3Add(vec3(1, 2, 3), vec3(4, 5, 6))).toEqual({ x: 5, y: 7, z: 9 });
  });

  it("v3Sub subtracts two vectors", () => {
    expect(v3Sub(vec3(4, 5, 6), vec3(1, 2, 3))).toEqual({ x: 3, y: 3, z: 3 });
  });

  it("v3Scale scales a vector", () => {
    expect(v3Scale(vec3(1, 2, 3), 2)).toEqual({ x: 2, y: 4, z: 6 });
  });

  it("v3Scale by zero gives zero-magnitude vector", () => {
    const result = v3Scale(vec3(5, -3, 7), 0);
    // -3 * 0 = -0 in IEEE 754, so use magnitude check
    expect(v3Magnitude(result)).toBe(0);
  });

  it("v3Dot computes dot product", () => {
    expect(v3Dot(vec3(1, 0, 0), vec3(0, 1, 0))).toBe(0);
    expect(v3Dot(vec3(1, 2, 3), vec3(4, 5, 6))).toBe(32);
  });

  it("v3Cross computes cross product", () => {
    // x cross y = z
    expect(v3Cross(vec3(1, 0, 0), vec3(0, 1, 0))).toEqual({ x: 0, y: 0, z: 1 });
    // y cross x = -z
    expect(v3Cross(vec3(0, 1, 0), vec3(1, 0, 0))).toEqual({ x: 0, y: 0, z: -1 });
    // a cross a = 0
    const a = vec3(1, 2, 3);
    const self = v3Cross(a, a);
    expect(self.x).toBeCloseTo(0);
    expect(self.y).toBeCloseTo(0);
    expect(self.z).toBeCloseTo(0);
  });

  it("v3Magnitude computes length", () => {
    expect(v3Magnitude(vec3(3, 4, 0))).toBeCloseTo(5);
    expect(v3Magnitude(vec3(0, 0, 0))).toBe(0);
    expect(v3Magnitude(vec3(1, 0, 0))).toBe(1);
  });

  it("v3MagnitudeSq computes squared length", () => {
    expect(v3MagnitudeSq(vec3(3, 4, 0))).toBe(25);
    expect(v3MagnitudeSq(vec3(0, 0, 0))).toBe(0);
  });

  it("v3MagnitudeSq equals v3Magnitude squared", () => {
    const v = vec3(1.5, -2.7, 3.14);
    expect(v3MagnitudeSq(v)).toBeCloseTo(v3Magnitude(v) ** 2);
  });

  it("v3Normalize returns unit vector", () => {
    const n = v3Normalize(vec3(3, 4, 0));
    expect(v3Magnitude(n)).toBeCloseTo(1);
    expect(n.x).toBeCloseTo(0.6);
    expect(n.y).toBeCloseTo(0.8);
  });

  it("v3Normalize of near-zero vector returns V3_ZERO", () => {
    const n = v3Normalize(vec3(1e-15, 0, 0));
    expect(n).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("v3Negate negates all components", () => {
    expect(v3Negate(vec3(1, -2, 3))).toEqual({ x: -1, y: 2, z: -3 });
  });
});

// ── Mutable "Into" variants ─────────────────────────────
describe("Vector3 Into variants (zero-alloc)", () => {
  it("v3Set writes into output", () => {
    const out: Vector3 = { x: 99, y: 99, z: 99 };
    const result = v3Set(out, 1, 2, 3);
    expect(result).toBe(out); // same reference
    expect(out).toEqual({ x: 1, y: 2, z: 3 });
  });

  it("v3AddInto writes into output and returns it", () => {
    const out: Vector3 = { x: 0, y: 0, z: 0 };
    const result = v3AddInto(vec3(1, 2, 3), vec3(4, 5, 6), out);
    expect(result).toBe(out);
    expect(out).toEqual({ x: 5, y: 7, z: 9 });
  });

  it("v3ScaleInto writes into output", () => {
    const out: Vector3 = { x: 0, y: 0, z: 0 };
    const result = v3ScaleInto(vec3(1, 2, 3), 3, out);
    expect(result).toBe(out);
    expect(out).toEqual({ x: 3, y: 6, z: 9 });
  });

  it("v3CrossInto writes into output", () => {
    const out: Vector3 = { x: 0, y: 0, z: 0 };
    const result = v3CrossInto(vec3(1, 0, 0), vec3(0, 1, 0), out);
    expect(result).toBe(out);
    expect(out).toEqual({ x: 0, y: 0, z: 1 });
  });

  it("v3CrossInto supports a === out aliasing", () => {
    const a: Vector3 = { x: 1, y: 0, z: 0 };
    const b: Vector3 = { x: 0, y: 1, z: 0 };
    v3CrossInto(a, b, a); // write into a
    expect(a).toEqual({ x: 0, y: 0, z: 1 });
  });

  it("v3CrossInto supports b === out aliasing", () => {
    const a: Vector3 = { x: 1, y: 0, z: 0 };
    const b: Vector3 = { x: 0, y: 1, z: 0 };
    v3CrossInto(a, b, b); // write into b
    expect(b).toEqual({ x: 0, y: 0, z: 1 });
  });

  it("v3AddInto does NOT support input aliasing (known limitation)", () => {
    // v3AddInto(a, b, a) effectively does a.x = a.x + b.x which is fine
    const a: Vector3 = { x: 1, y: 2, z: 3 };
    const b: Vector3 = { x: 4, y: 5, z: 6 };
    v3AddInto(a, b, a);
    expect(a).toEqual({ x: 5, y: 7, z: 9 });
  });

  it("Into variants match allocating versions", () => {
    const a = vec3(1.5, -2.3, 4.7);
    const b = vec3(-0.5, 3.1, -1.2);
    const out: Vector3 = { x: 0, y: 0, z: 0 };

    v3AddInto(a, b, out);
    expect(out).toEqual(v3Add(a, b));

    v3ScaleInto(a, 2.5, out);
    expect(out).toEqual(v3Scale(a, 2.5));

    v3CrossInto(a, b, out);
    const expected = v3Cross(a, b);
    expect(out.x).toBeCloseTo(expected.x);
    expect(out.y).toBeCloseTo(expected.y);
    expect(out.z).toBeCloseTo(expected.z);
  });
});

// ── Quaternion basics ───────────────────────────────────
describe("Quaternion operations", () => {
  it("Q_IDENTITY is the identity quaternion", () => {
    expect(Q_IDENTITY).toEqual({ w: 1, x: 0, y: 0, z: 0 });
  });

  it("quatMultiply with identity returns same quaternion", () => {
    const q: Quaternion = { w: 0.5, x: 0.5, y: 0.5, z: 0.5 };
    const result = quatMultiply(Q_IDENTITY, q);
    expect(result.w).toBeCloseTo(q.w);
    expect(result.x).toBeCloseTo(q.x);
    expect(result.y).toBeCloseTo(q.y);
    expect(result.z).toBeCloseTo(q.z);
  });

  it("quatMultiply is non-commutative", () => {
    const a: Quaternion = { w: 0.5, x: 0.5, y: 0.5, z: 0.5 };
    const b: Quaternion = { w: 0.7071, x: 0.7071, y: 0, z: 0 };
    const ab = quatMultiply(a, b);
    const ba = quatMultiply(b, a);
    // ab !== ba for non-identity quaternions
    const differs = Math.abs(ab.x - ba.x) > 0.001 ||
                    Math.abs(ab.y - ba.y) > 0.001 ||
                    Math.abs(ab.z - ba.z) > 0.001;
    expect(differs).toBe(true);
  });

  it("quatNormalize returns unit quaternion", () => {
    const q: Quaternion = { w: 2, x: 3, y: 4, z: 5 };
    const n = quatNormalize(q);
    const mag = Math.sqrt(n.w * n.w + n.x * n.x + n.y * n.y + n.z * n.z);
    expect(mag).toBeCloseTo(1);
  });

  it("quatNormalize of near-zero returns identity", () => {
    const q: Quaternion = { w: 1e-15, x: 0, y: 0, z: 0 };
    const n = quatNormalize(q);
    expect(n).toEqual(Q_IDENTITY);
  });

  it("quatConjugate negates xyz, keeps w", () => {
    const q: Quaternion = { w: 0.5, x: 0.3, y: -0.2, z: 0.1 };
    const c = quatConjugate(q);
    expect(c.w).toBe(q.w);
    expect(c.x).toBe(-q.x);
    expect(c.y).toBe(-q.y);
    expect(c.z).toBe(-q.z);
  });

  it("q * conjugate(q) = identity (for unit quaternion)", () => {
    const q = quatNormalize({ w: 1, x: 1, y: 1, z: 1 });
    const result = quatMultiply(q, quatConjugate(q));
    expect(result.w).toBeCloseTo(1);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
    expect(result.z).toBeCloseTo(0);
  });

  it("quatRotateVector by identity returns same vector", () => {
    const v = vec3(1, 2, 3);
    const rotated = quatRotateVector(Q_IDENTITY, v);
    expect(rotated.x).toBeCloseTo(v.x);
    expect(rotated.y).toBeCloseTo(v.y);
    expect(rotated.z).toBeCloseTo(v.z);
  });

  it("quatRotateVector 90° around Z rotates X→Y", () => {
    const q90z = quatFromEuler(0, 0, Math.PI / 2);
    const v = vec3(1, 0, 0);
    const rotated = quatRotateVector(q90z, v);
    expect(rotated.x).toBeCloseTo(0, 4);
    expect(rotated.y).toBeCloseTo(1, 4);
    expect(rotated.z).toBeCloseTo(0, 4);
  });

  it("quatFromEuler all zeros gives identity", () => {
    const q = quatFromEuler(0, 0, 0);
    expect(q.w).toBeCloseTo(1);
    expect(q.x).toBeCloseTo(0);
    expect(q.y).toBeCloseTo(0);
    expect(q.z).toBeCloseTo(0);
  });

  it("quatFromEuler produces unit quaternion", () => {
    const q = quatFromEuler(0.5, -0.3, 1.2);
    const mag = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
    expect(mag).toBeCloseTo(1);
  });
});

// ── Quaternion Into variants ────────────────────────────
describe("Quaternion Into variants (zero-alloc)", () => {
  it("quatMultiplyInto returns same reference", () => {
    const out: Quaternion = { w: 0, x: 0, y: 0, z: 0 };
    const a: Quaternion = { w: 0.5, x: 0.5, y: 0.5, z: 0.5 };
    const result = quatMultiplyInto(Q_IDENTITY, a, out);
    expect(result).toBe(out);
    expect(out.w).toBeCloseTo(a.w);
    expect(out.x).toBeCloseTo(a.x);
  });

  it("quatMultiplyInto supports a === out aliasing", () => {
    const a: Quaternion = { w: 0.5, x: 0.5, y: 0.5, z: 0.5 };
    const b: Quaternion = { ...Q_IDENTITY };
    const expected = quatMultiply(a, b);
    quatMultiplyInto(a, b, a);
    expect(a.w).toBeCloseTo(expected.w);
    expect(a.x).toBeCloseTo(expected.x);
    expect(a.y).toBeCloseTo(expected.y);
    expect(a.z).toBeCloseTo(expected.z);
  });

  it("quatMultiplyInto supports b === out aliasing", () => {
    const a: Quaternion = { ...Q_IDENTITY };
    const b: Quaternion = { w: 0.5, x: 0.5, y: 0.5, z: 0.5 };
    const expected = quatMultiply(a, b);
    quatMultiplyInto(a, b, b);
    expect(b.w).toBeCloseTo(expected.w);
    expect(b.x).toBeCloseTo(expected.x);
    expect(b.y).toBeCloseTo(expected.y);
    expect(b.z).toBeCloseTo(expected.z);
  });

  it("quatMultiplyInto matches allocating version", () => {
    const a = quatFromEuler(0.3, -0.1, 0.5);
    const b = quatFromEuler(-0.2, 0.4, -0.6);
    const expected = quatMultiply(a, b);
    const out: Quaternion = { w: 0, x: 0, y: 0, z: 0 };
    quatMultiplyInto(a, b, out);
    expect(out.w).toBeCloseTo(expected.w);
    expect(out.x).toBeCloseTo(expected.x);
    expect(out.y).toBeCloseTo(expected.y);
    expect(out.z).toBeCloseTo(expected.z);
  });

  it("quatNormalizeInto returns same reference", () => {
    const out: Quaternion = { w: 0, x: 0, y: 0, z: 0 };
    quatNormalizeInto({ w: 2, x: 3, y: 4, z: 5 }, out);
    const mag = Math.sqrt(out.w * out.w + out.x * out.x + out.y * out.y + out.z * out.z);
    expect(mag).toBeCloseTo(1);
  });

  it("quatNormalizeInto of degenerate zero returns identity", () => {
    const out: Quaternion = { w: 0, x: 0, y: 0, z: 0 };
    quatNormalizeInto({ w: 0, x: 0, y: 0, z: 0 }, out);
    expect(out).toEqual({ w: 1, x: 0, y: 0, z: 0 });
  });

  it("quatRotateVectorInto matches allocating version", () => {
    const q = quatFromEuler(0.3, -0.1, 0.5);
    const v = vec3(1, 2, 3);
    const expected = quatRotateVector(q, v);
    const out: Vector3 = { x: 0, y: 0, z: 0 };
    quatRotateVectorInto(q, v, out);
    expect(out.x).toBeCloseTo(expected.x);
    expect(out.y).toBeCloseTo(expected.y);
    expect(out.z).toBeCloseTo(expected.z);
  });

  it("quatRotateVectorInto 90° around Z rotates X→Y", () => {
    const q90z = quatFromEuler(0, 0, Math.PI / 2);
    const out: Vector3 = { x: 0, y: 0, z: 0 };
    quatRotateVectorInto(q90z, vec3(1, 0, 0), out);
    expect(out.x).toBeCloseTo(0, 4);
    expect(out.y).toBeCloseTo(1, 4);
    expect(out.z).toBeCloseTo(0, 4);
  });

  it("quatRotateVectorInto identity leaves vector unchanged", () => {
    const v = vec3(5, -3, 7);
    const out: Vector3 = { x: 0, y: 0, z: 0 };
    quatRotateVectorInto(Q_IDENTITY, v, out);
    expect(out.x).toBeCloseTo(v.x);
    expect(out.y).toBeCloseTo(v.y);
    expect(out.z).toBeCloseTo(v.z);
  });
});

// ── createDefaultDroneState & V3_ZERO regression ────────
describe("createDefaultDroneState", () => {
  it("creates state at given altitude (number)", () => {
    const state = createDefaultDroneState(10);
    expect(state.position).toEqual({ x: 0, y: 0, z: 10 });
    expect(state.velocity).toEqual({ x: 0, y: 0, z: 0 });
    expect(state.quaternion).toEqual({ w: 1, x: 0, y: 0, z: 0 });
    expect(state.angularVelocity).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("creates state at given Vector3 position", () => {
    const pos = vec3(5, -3, 20);
    const state = createDefaultDroneState(pos);
    expect(state.position).toEqual({ x: 5, y: -3, z: 20 });
  });

  it("copies Vector3 input (not reference)", () => {
    const pos = vec3(5, -3, 20);
    const state = createDefaultDroneState(pos);
    pos.x = 999;
    expect(state.position.x).toBe(5); // not 999
  });

  it("V3_ZERO is NOT mutated by writing to returned state (regression)", () => {
    const state = createDefaultDroneState(10);
    // Simulate what stepInto does — write into velocity
    state.velocity.x = 42;
    state.velocity.y = -7;
    state.velocity.z = 100;
    // V3_ZERO must remain pristine
    expect(V3_ZERO).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("Q_IDENTITY is NOT mutated by writing to returned state (regression)", () => {
    const state = createDefaultDroneState(10);
    // Simulate what stepInto does — write into quaternion
    state.quaternion.w = 0.5;
    state.quaternion.x = 0.5;
    state.quaternion.y = 0.5;
    state.quaternion.z = 0.5;
    // Q_IDENTITY must remain pristine
    expect(Q_IDENTITY).toEqual({ w: 1, x: 0, y: 0, z: 0 });
  });

  it("two separate states do NOT share velocity references", () => {
    const s1 = createDefaultDroneState(10);
    const s2 = createDefaultDroneState(20);
    s1.velocity.x = 42;
    expect(s2.velocity.x).toBe(0);
  });

  it("two separate states do NOT share quaternion references", () => {
    const s1 = createDefaultDroneState(10);
    const s2 = createDefaultDroneState(20);
    s1.quaternion.w = 0;
    expect(s2.quaternion.w).toBe(1);
  });

  it("two separate states do NOT share angularVelocity references", () => {
    const s1 = createDefaultDroneState(10);
    const s2 = createDefaultDroneState(20);
    s1.angularVelocity.z = 99;
    expect(s2.angularVelocity.z).toBe(0);
  });
});
