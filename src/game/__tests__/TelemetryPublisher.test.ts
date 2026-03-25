import { describe, it, expect, vi } from "vitest";
import { TelemetryPublisher } from "../TelemetryPublisher";
import { createDefaultDroneState } from "../../core/physics/types";

describe("TelemetryPublisher", () => {
  function createPublisher() {
    const publisher = new TelemetryPublisher();
    const callback = vi.fn();
    publisher.setOnPublish(callback);
    return { publisher, callback };
  }

  it("publishes every 6th frame (~10Hz at 60fps)", () => {
    const { publisher, callback } = createPublisher();
    const state = createDefaultDroneState(10);

    for (let i = 1; i <= 12; i++) {
      publisher.maybePublish(state, 0.5, 0);
    }

    // Should have published on frame 6 and 12
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("returns true only when publishing", () => {
    const { publisher } = createPublisher();
    const state = createDefaultDroneState(10);

    const results: boolean[] = [];
    for (let i = 0; i < 7; i++) {
      results.push(publisher.maybePublish(state, 0.5, 0));
    }

    // Frame 6 (index 5) should return true
    expect(results).toEqual([false, false, false, false, false, true, false]);
  });

  it("publishes correct telemetry data", () => {
    const { publisher, callback } = createPublisher();
    const state = createDefaultDroneState(20);
    state.velocity = { x: 3, y: 4, z: 0 }; // speed = 5 m/s
    state.position = { x: 0, y: 0, z: 20 };

    // Skip to 6th frame
    for (let i = 0; i < 6; i++) {
      publisher.maybePublish(state, 0.7, 5);
    }

    expect(callback).toHaveBeenCalledWith({
      speed: 5,
      altitudeAGL: 15, // 20 - 5
      throttle: 0.7,
    });
  });

  it("clamps altitudeAGL to 0 when below ground", () => {
    const { publisher, callback } = createPublisher();
    const state = createDefaultDroneState(2);
    state.position = { x: 0, y: 0, z: 2 };

    for (let i = 0; i < 6; i++) {
      publisher.maybePublish(state, 0, 10); // ground at 10, drone at 2
    }

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ altitudeAGL: 0 }),
    );
  });

  it("does not call callback when none set", () => {
    const publisher = new TelemetryPublisher();
    const state = createDefaultDroneState(10);

    // Should not throw
    for (let i = 0; i < 6; i++) {
      publisher.maybePublish(state, 0.5, 0);
    }
  });

  it("reset resets the frame counter", () => {
    const { publisher, callback } = createPublisher();
    const state = createDefaultDroneState(10);

    // Advance 3 frames
    for (let i = 0; i < 3; i++) {
      publisher.maybePublish(state, 0.5, 0);
    }

    publisher.reset();

    // After reset, need 6 more frames to publish
    for (let i = 0; i < 5; i++) {
      publisher.maybePublish(state, 0.5, 0);
    }
    expect(callback).not.toHaveBeenCalled();

    publisher.maybePublish(state, 0.5, 0);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
