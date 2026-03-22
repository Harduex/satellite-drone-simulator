import type { StickInputs } from "../physics/types";

const THROTTLE_RAMP_RATE = 0.8; // per second
const STICK_VALUE = 0.7; // how much roll/pitch/yaw keyboard gives

/** Keyboard fallback input for development/testing without radio controller */
export class KeyboardInput {
  private keys = new Set<string>();
  private throttleLevel = 0;

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
  }

  /**
   * Read keyboard state and produce StickInputs.
   * @param dt Time since last call in seconds (for throttle ramping)
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

    // Roll: Arrow Left/Right
    let roll = 0;
    if (this.keys.has("ArrowRight")) roll += STICK_VALUE;
    if (this.keys.has("ArrowLeft")) roll -= STICK_VALUE;

    // Pitch: Arrow Up/Down
    let pitch = 0;
    if (this.keys.has("ArrowUp")) pitch += STICK_VALUE;
    if (this.keys.has("ArrowDown")) pitch -= STICK_VALUE;

    // Yaw: A/D
    let yaw = 0;
    if (this.keys.has("KeyD")) yaw += STICK_VALUE;
    if (this.keys.has("KeyA")) yaw -= STICK_VALUE;

    return {
      throttle: this.throttleLevel,
      roll,
      pitch,
      yaw,
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
