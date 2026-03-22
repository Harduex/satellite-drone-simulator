import type { DroneState } from "../core/physics/types";

export class CrashDetector {
  private spawnAltitude: number;
  private onCrashCallback: (() => void) | null = null;

  constructor(spawnAltitude: number) {
    this.spawnAltitude = spawnAltitude;
  }

  setOnCrash(callback: () => void): void {
    this.onCrashCallback = callback;
  }

  /**
   * Check if the drone has crashed.
   * Returns true if a crash was detected and callback was invoked.
   */
  check(droneState: DroneState): boolean {
    const agl = droneState.position.z;
    if (agl < 0.5 && droneState.position.z < this.spawnAltitude * 0.5) {
      this.onCrashCallback?.();
      return true;
    }
    return false;
  }
}
