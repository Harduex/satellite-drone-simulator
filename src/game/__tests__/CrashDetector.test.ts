import { describe, expect, it, vi } from "vitest";
import { CrashDetector } from "../CrashDetector";
import { createDefaultDroneState } from "../../core/physics/types";

const SPAWN_GRACE_FRAMES = 30;
const CRASH_CONFIRM_FRAMES = 3;

describe("CrashDetector", () => {
  it("suppresses crash during grace period", () => {
    const detector = new CrashDetector(8);
    const state = createDefaultDroneState(0); // on the ground
    const callback = vi.fn();
    detector.setOnCrash(callback);

    for (let i = 0; i < SPAWN_GRACE_FRAMES; i++) {
      expect(detector.check(state, 0)).toBe(false);
    }
    expect(callback).not.toHaveBeenCalled();
  });

  it("detects crash when AGL near zero after grace period", () => {
    const detector = new CrashDetector(8);
    const state = createDefaultDroneState({ x: 0, y: 0, z: 5 });
    const callback = vi.fn();
    detector.setOnCrash(callback);

    // Burn through grace period at safe altitude
    for (let i = 0; i < SPAWN_GRACE_FRAMES; i++) {
      detector.check(state, 0); // agl = 5, safe
    }

    // Simulate ground height equal to drone position (the bug scenario:
    // sampleHeight picks up drone entity → groundHeight ≈ dronePos.z → agl ≈ 0)
    const groundHeightEqualsToDrone = 5;
    for (let i = 0; i < CRASH_CONFIRM_FRAMES; i++) {
      const crashed = detector.check(state, groundHeightEqualsToDrone);
      if (i < CRASH_CONFIRM_FRAMES - 1) {
        expect(crashed).toBe(false);
      } else {
        expect(crashed).toBe(true);
      }
    }
    expect(callback).toHaveBeenCalledOnce();
  });

  it("does NOT crash when AGL is healthy", () => {
    const detector = new CrashDetector(8);
    const state = createDefaultDroneState({ x: 0, y: 0, z: 10 });
    const callback = vi.fn();
    detector.setOnCrash(callback);

    // Burn grace period
    for (let i = 0; i < SPAWN_GRACE_FRAMES; i++) {
      detector.check(state, 0);
    }

    // Fly at 10m AGL for many frames
    for (let i = 0; i < 100; i++) {
      expect(detector.check(state, 0)).toBe(false);
    }
    expect(callback).not.toHaveBeenCalled();
  });

  it("resets low-AGL counter when AGL recovers", () => {
    const detector = new CrashDetector(8);
    const lowState = createDefaultDroneState({ x: 0, y: 0, z: 0.1 });
    const highState = createDefaultDroneState({ x: 0, y: 0, z: 10 });
    const callback = vi.fn();
    detector.setOnCrash(callback);

    // Burn grace period
    for (let i = 0; i < SPAWN_GRACE_FRAMES; i++) {
      detector.check(highState, 0);
    }

    // Two consecutive low-AGL frames (less than CRASH_CONFIRM_FRAMES)
    detector.check(lowState, 0);
    detector.check(lowState, 0);
    // Recover
    detector.check(highState, 0);
    // Two more low-AGL frames — should not crash because counter reset
    detector.check(lowState, 0);
    detector.check(lowState, 0);

    expect(callback).not.toHaveBeenCalled();
  });

  it("reset() restores grace period", () => {
    const detector = new CrashDetector(8);
    const state = createDefaultDroneState(0);
    const callback = vi.fn();
    detector.setOnCrash(callback);

    // Burn grace period + trigger crash frames
    for (let i = 0; i < SPAWN_GRACE_FRAMES + CRASH_CONFIRM_FRAMES + 5; i++) {
      detector.check(state, 0);
    }

    detector.reset();

    // Grace period should be active again — no crash even at ground level
    for (let i = 0; i < SPAWN_GRACE_FRAMES; i++) {
      expect(detector.check(state, 0)).toBe(false);
    }
  });
});
