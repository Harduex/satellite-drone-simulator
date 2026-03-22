import type { DroneState } from "../core/physics/types";

// After a spawn/reset, ignore crash checks for this many telemetry frames (~3s at 10Hz).
// Gives the pilot time to apply throttle before the first crash is registered.
const SPAWN_GRACE_FRAMES = 30;

// Number of consecutive low-AGL telemetry frames required before declaring a crash.
// Prevents a single terrain-sample spike (e.g. a new 3D-tile building streaming in)
// from triggering a false reset while the drone is airborne.
const CRASH_CONFIRM_FRAMES = 3;

export class CrashDetector {
  private spawnAltitude: number;
  private onCrashCallback: (() => void) | null = null;
  private framesSinceSpawn = 0;
  private lowAglFrames = 0;

  constructor(spawnAltitude: number) {
    this.spawnAltitude = spawnAltitude;
  }

  setOnCrash(callback: () => void): void {
    this.onCrashCallback = callback;
  }

  /** Reset the spawn grace period (call this whenever the drone respawns). */
  reset(): void {
    this.framesSinceSpawn = 0;
    this.lowAglFrames = 0;
  }

  /**
   * Check if the drone has crashed.
   * @param groundHeight Current terrain surface height in ENU Z coords
   * Returns true if a crash was detected and callback was invoked.
   */
  check(droneState: DroneState, groundHeight: number = 0): boolean {
    this.framesSinceSpawn++;

    // Suppress crash detection during the spawn grace period so the pilot has
    // time to apply throttle before the drone hits the ground.
    if (this.framesSinceSpawn <= SPAWN_GRACE_FRAMES) {
      return false;
    }

    const agl = droneState.position.z - groundHeight;
    if (agl < 0.5 && agl < this.spawnAltitude * 0.3) {
      this.lowAglFrames++;
      if (this.lowAglFrames >= CRASH_CONFIRM_FRAMES) {
        this.onCrashCallback?.();
        return true;
      }
    } else {
      this.lowAglFrames = 0;
    }
    return false;
  }
}
