import { describe, expect, it } from "vitest";
import { BlackboxLogger } from "../BlackboxLogger";
import { createDefaultDroneState, DEFAULT_DRONE_CONFIG, DEFAULT_RATES } from "../types";

describe("BlackboxLogger", () => {
  it("records samples at the configured stride and exports chronologically with summary stats", () => {
    const logger = new BlackboxLogger(3, 2); // capacity 3, stride 2
    const state = createDefaultDroneState(10);
    const sticks = { throttle: 0.25, roll: 0.5, pitch: -0.2, yaw: 0.1 };
    const motors = { m1: 0.3, m2: 0.2, m3: 0.2, m4: 0.3 };
    const rpms = [15000, 12000, 12000, 15000];

    for (let step = 0; step < 8; step++) {
      state.position.z = 10 + step;
      state.velocity.y = step * 2;
      state.angularVelocity.y = step * 0.5;
      logger.recordStep(0.002, sticks, state, motors, rpms, 2);
    }

    // 8 steps at stride 2 -> 4 samples recorded (at steps 0, 2, 4, 6); capacity 3 keeps steps 2, 4, 6
    const exported = logger.exportReport(DEFAULT_DRONE_CONFIG, DEFAULT_RATES);
    expect(exported.sampleCount).toBe(3);
    expect(exported.samples[0]!.position[2]).toBeCloseTo(12, 4);
    expect(exported.samples[1]!.position[2]).toBeCloseTo(14, 4);
    expect(exported.samples[2]!.position[2]).toBeCloseTo(16, 4);
    expect(exported.summary.maxSpeedMs).toBeCloseTo(12, 4);
    expect(exported.summary.meanThrottle).toBeCloseTo(0.25, 4);

    logger.reset();
    expect(logger.exportReport(DEFAULT_DRONE_CONFIG, DEFAULT_RATES).sampleCount).toBe(0);
  });
});
