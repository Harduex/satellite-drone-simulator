import type { DroneState } from "../core/physics/types";
import type { BatteryState } from "./BatteryModel";
import { v3Magnitude } from "../core/physics/types";
import { useStore } from "../store";

const PUBLISH_INTERVAL = 6; // frames (~10Hz at 60fps)

export class TelemetryPublisher {
  private frameCount = 0;

  /**
   * Called every render frame. Publishes telemetry to the Zustand store
   * at a throttled rate (~10Hz).
   * Returns true if telemetry was published this frame.
   */
  maybePublish(
    droneState: DroneState,
    batteryState: BatteryState,
    throttle: number,
    groundHeight: number,
  ): boolean {
    this.frameCount++;
    if (this.frameCount % PUBLISH_INTERVAL !== 0) return false;

    const speed = v3Magnitude(droneState.velocity);
    useStore.getState().updateTelemetry({
      positionX: droneState.position.x,
      positionY: droneState.position.y,
      positionZ: droneState.position.z,
      speed,
      altitudeAGL: Math.max(0, droneState.position.z - groundHeight),
      batteryPercent: batteryState.percentRemaining,
      batteryVoltage: batteryState.voltage,
      throttle,
    });

    return true;
  }

  reset(): void {
    this.frameCount = 0;
  }
}
