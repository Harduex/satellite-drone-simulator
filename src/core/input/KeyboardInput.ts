import type { StickInputs } from "../physics/types";

const THROTTLE_RAMP_RATE = 0.8; // per second
const STICK_RAMP_RATE = 4.0; // per second — how fast roll/pitch/yaw ramp to target
const STICK_MAX = 0.7; // maximum roll/pitch/yaw value from keyboard
const STICK_DECAY_RATE = 6.0; // per second — how fast sticks return to center

/** Keyboard fallback input for development/testing without radio controller */
export class KeyboardInput {
  private keys = new Set<string>();
  private throttleLevel = 0;
  private rollLevel = 0;
  private pitchLevel = 0;
  private yawLevel = 0;

  constructor() {
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
  }

  start(): void {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  stop(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.keys.clear();
    this.throttleLevel = 0;
    this.rollLevel = 0;
    this.pitchLevel = 0;
    this.yawLevel = 0;
  }

  /**
   * Read keyboard state and produce StickInputs.
   * All stick axes ramp smoothly to prevent instant full-deflection flips.
   * @param dt Time since last call in seconds
   */
  read(dt: number): StickInputs {
    // Throttle: W ramps up, S ramps down (incremental, not binary)
    if (this.keys.has("KeyW")) {
      this.throttleLevel = Math.min(
        1,
        this.throttleLevel + THROTTLE_RAMP_RATE * dt,
      );
    }
    if (this.keys.has("KeyS")) {
      this.throttleLevel = Math.max(
        0,
        this.throttleLevel - THROTTLE_RAMP_RATE * dt,
      );
    }

    // Roll: Arrow Left/Right (inverted: ArrowLeft = roll left = negative)
    this.rollLevel = rampAxis(
      this.rollLevel,
      this.keys.has("ArrowLeft"),
      this.keys.has("ArrowRight"),
      dt,
    );

    // Pitch: Arrow Up/Down
    this.pitchLevel = rampAxis(
      this.pitchLevel,
      this.keys.has("ArrowUp"),
      this.keys.has("ArrowDown"),
      dt,
    );

    // Yaw: A/D
    this.yawLevel = rampAxis(
      this.yawLevel,
      this.keys.has("KeyD"),
      this.keys.has("KeyA"),
      dt,
    );

    return {
      throttle: this.throttleLevel,
      roll: this.rollLevel,
      pitch: this.pitchLevel,
      yaw: this.yawLevel,
    };
  }

  isActive(): boolean {
    return this.keys.size > 0 || this.throttleLevel > 0;
  }

  private onKeyDown(e: KeyboardEvent): void {
    // Don't capture if user is typing in an input field
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    this.keys.add(e.code);
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.code);
  }
}

/** Smoothly ramp a stick axis toward target or decay to zero */
function rampAxis(
  current: number,
  positiveHeld: boolean,
  negativeHeld: boolean,
  dt: number,
): number {
  let target = 0;
  if (positiveHeld) target += STICK_MAX;
  if (negativeHeld) target -= STICK_MAX;

  if (target !== 0) {
    // Ramp toward target
    const diff = target - current;
    const step = STICK_RAMP_RATE * dt;
    if (Math.abs(diff) < step) return target;
    return current + Math.sign(diff) * step;
  } else {
    // Decay to zero when no key held
    const step = STICK_DECAY_RATE * dt;
    if (Math.abs(current) < step) return 0;
    return current - Math.sign(current) * step;
  }
}
