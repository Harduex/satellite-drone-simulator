import type { DroneState } from '../core/physics/types';
import type { ContactResult } from '../core/physics/SurfaceContact';

export const IMPACT_FEEDBACK_SPEED = 2.5; // m/s into the contact surface
export const DISABLING_IMPACT_SPEED = 6; // prototype tuning, not real damage calibration

export class CrashDetector {
  disabled = false;
  private feedbackRemaining = 0;
  private contactCooldown = 0;
  private onCrashCallback: (() => void) | null = null;

  setOnCrash(callback: () => void): void { this.onCrashCallback = callback; }
  reset(): void { this.disabled = false; this.feedbackRemaining = 0; this.contactCooldown = 0; }
  get hasImpactFeedback(): boolean { return this.feedbackRemaining > 0; }

  check(contact: ContactResult, state: DroneState, godMode: boolean, dt: number): boolean {
    this.feedbackRemaining = Math.max(0, this.feedbackRemaining - dt);
    this.contactCooldown = Math.max(0, this.contactCooldown - dt);
    if (contact.impactSpeed < IMPACT_FEEDBACK_SPEED) return false;
    const q = state.quaternion;
    const upright = 1 - 2 * (q.x * q.x + q.y * q.y);
    const severe = contact.impactSpeed >= DISABLING_IMPACT_SPEED || upright < 0.5;
    const newlyDisabled = severe && !godMode && !this.disabled;
    if (newlyDisabled) this.disabled = true;
    if (this.contactCooldown <= 0 || newlyDisabled) {
      this.feedbackRemaining = 3;
      this.contactCooldown = 0.2;
      this.onCrashCallback?.();
    }
    return newlyDisabled;
  }
}
