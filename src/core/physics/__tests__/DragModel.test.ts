import { describe, expect, it } from "vitest";
import { computeAngularDrag, computeTranslationalDrag } from "../DragModel";
import { DEFAULT_DRONE_CONFIG, Q_IDENTITY } from "../types";

describe("DragModel", () => {
  describe("quadratic angular drag", () => {
    it("doubling angular velocity quadruples drag magnitude", () => {
      const omega1 = { x: 0, y: 0, z: 5 };
      const omega2 = { x: 0, y: 0, z: 10 };

      const drag1 = computeAngularDrag(omega1);
      const drag2 = computeAngularDrag(omega2);

      const ratio = Math.abs(drag2.z) / Math.abs(drag1.z);
      expect(ratio).toBeCloseTo(4.0, 0);
    });

    it("opposes angular velocity direction", () => {
      const omega = { x: 3, y: -2, z: 1 };
      const drag = computeAngularDrag(omega);
      expect(Math.sign(drag.x)).toBe(-Math.sign(omega.x));
      expect(Math.sign(drag.y)).toBe(-Math.sign(omega.y));
      expect(Math.sign(drag.z)).toBe(-Math.sign(omega.z));
    });

    it("returns zero for zero angular velocity", () => {
      const drag = computeAngularDrag({ x: 0, y: 0, z: 0 });
      expect(drag.x).toBe(0);
      expect(drag.y).toBe(0);
      expect(drag.z).toBe(0);
    });
  });

  describe("direction-dependent translational drag", () => {
    it("vertical drag is stronger than lateral drag at same speed", () => {
      const config = DEFAULT_DRONE_CONFIG;
      // Moving purely upward (body frame = world frame at Q_IDENTITY)
      const velUp = { x: 0, y: 0, z: 10 };
      // Moving purely forward
      const velFwd = { x: 0, y: 10, z: 0 };

      const dragUp = computeTranslationalDrag(velUp, Q_IDENTITY, config);
      const dragFwd = computeTranslationalDrag(velFwd, Q_IDENTITY, config);

      // Vertical drag should be verticalDragMultiplier (3x) stronger
      expect(Math.abs(dragUp.z)).toBeGreaterThan(Math.abs(dragFwd.y) * 2);
    });

    it("returns zero for zero velocity", () => {
      const drag = computeTranslationalDrag(
        { x: 0, y: 0, z: 0 },
        Q_IDENTITY,
        DEFAULT_DRONE_CONFIG,
      );
      expect(drag.x).toBe(0);
      expect(drag.y).toBe(0);
      expect(drag.z).toBe(0);
    });

    it("strictly opposes velocity without phantom horizontal lift in tilted free-fall and dive recovery", () => {
      const half = (-61 * Math.PI) / 360;
      const tiltedQuat = { w: Math.cos(half), x: Math.sin(half), y: 0, z: 0 };
      // Pure vertical free-fall while pitched 61 degrees nose-down
      const verticalFall = { x: 0, y: 0, z: -30 };
      const dragUnpowered = computeTranslationalDrag(verticalFall, tiltedQuat, DEFAULT_DRONE_CONFIG, 0);
      expect(dragUnpowered.x).toBeCloseTo(0, 6);
      expect(dragUnpowered.y).toBeCloseTo(0, 6);
      expect(dragUnpowered.z).toBeGreaterThan(0);

      // Even with active rotor spin (rotorDrag > 0) during a tilted descent (bodyVel.z < 0),
      // normal disc drag does not push the falling drone forward (+Y)
      const dragPoweredDescent = computeTranslationalDrag(verticalFall, tiltedQuat, DEFAULT_DRONE_CONFIG, 0.05);
      expect(dragPoweredDescent.y).toBeLessThanOrEqual(0);
      expect(dragPoweredDescent.z).toBeGreaterThan(0);
    });
  });
});

