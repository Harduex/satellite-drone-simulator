import type { DroneState } from "../core/physics/types";
import { v3Magnitude } from "../core/physics/types";

export interface TelemetryData {
  speed: number;
  altitudeAGL: number;
  throttle: number;
}

const PUBLISH_INTERVAL = 6; // frames (~10Hz at 60fps)

export class TelemetryPublisher {
  private frameCount = 0;
  private onPublish: ((data: TelemetryData) => void) | null = null;

  /** Inject the publish callback instead of coupling directly to a store. */
  setOnPublish(callback: (data: TelemetryData) => void): void {
    this.onPublish = callback;
  }

  /**
   * Called every render frame. Publishes telemetry via the injected callback
   * at a throttled rate (~10Hz).
   * Returns true if telemetry was published this frame.
   */
  maybePublish(
    droneState: DroneState,
    throttle: number,
    groundHeight: number,
  ): boolean {
    this.frameCount++;
    if (this.frameCount % PUBLISH_INTERVAL !== 0) return false;

    if (this.onPublish) {
      this.onPublish({
        speed: v3Magnitude(droneState.velocity),
        altitudeAGL: Math.max(0, droneState.position.z - groundHeight),
        throttle,
      });
    }

    return true;
  }

  reset(): void {
    this.frameCount = 0;
  }
}
