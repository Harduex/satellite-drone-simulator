import type { PhysicsConfig } from "./types";

export interface MotorState {
  rpm: number[]; // 4 motors current RPM
}

export class MotorModel {
  private config: PhysicsConfig;
  state: MotorState;
  // Pre-allocated buffers — returned by update()/getReactionTorques().
  // Callers must consume values before the next call (same physics step).
  private thrustBuffer: number[] = [0, 0, 0, 0];
  private reactionTorqueBuffer: number[] = [0, 0, 0, 0];
  // Cached Math.exp alpha values — only two possible results per config
  private cachedAlphaSpinUp = 0;
  private cachedAlphaSpinDown = 0;
  private cachedDt = 0;
  private cachedTimeConstant = 0;
  private cachedSpinDownFactor = 0;

  constructor(config: PhysicsConfig) {
    this.config = config;
    this.state = { rpm: [0, 0, 0, 0] };
  }

  /**
   * Update motor RPMs from throttle commands [0,1] with asymmetric spin-up/down lag.
   * Spin-up uses base motorTimeConstant, spin-down uses motorTimeConstant * motorSpinDownFactor.
   * Returns thrust (N) for each of the 4 motors (reused buffer).
   */
  update(throttleCommands: number[], dt: number): number[] {
    const { kT, maxThrottleRpm, motorTimeConstant, motorSpinDownFactor } = this.config;
    const responseExponent = Number.isFinite(this.config.motorResponseExponent) && this.config.motorResponseExponent! > 0
      ? this.config.motorResponseExponent! : 1;

    if (dt !== this.cachedDt || motorTimeConstant !== this.cachedTimeConstant ||
      motorSpinDownFactor !== this.cachedSpinDownFactor) {
      this.cachedDt = dt;
      this.cachedTimeConstant = motorTimeConstant;
      this.cachedSpinDownFactor = motorSpinDownFactor;
      this.cachedAlphaSpinUp = 1 - Math.exp(-dt / motorTimeConstant);
      this.cachedAlphaSpinDown = 1 - Math.exp(-dt / (motorTimeConstant * motorSpinDownFactor));
    }

    for (let i = 0; i < 4; i++) {
      const cmd = Math.max(0, Math.min(1, throttleCommands[i] ?? 0));

      // Linear thrust uses sqrt(command) directly; the loaded RPM curve applies
      // only to raw ESC commands so it does not undo thrust linearization.
      const linearizedCmd = this.config.thrustLinearization !== false
        ? Math.sqrt(cmd) : Math.pow(cmd, responseExponent);
      const targetRpm = linearizedCmd * maxThrottleRpm;
      const currentRpm = this.state.rpm[i] ?? 0;

      const isSpinningDown = targetRpm < currentRpm;
      const alpha = isSpinningDown ? this.cachedAlphaSpinDown : this.cachedAlphaSpinUp;

      const newRpm = currentRpm + alpha * (targetRpm - currentRpm);
      this.state.rpm[i] = newRpm;

      // Thrust: T = kT * rpm²
      this.thrustBuffer[i] = kT * newRpm * newRpm;
    }

    return this.thrustBuffer;
  }

  /** Get reaction torque per motor for yaw computation (reused buffer) */
  getReactionTorques(): number[] {
    const { kQ } = this.config;
    for (let i = 0; i < 4; i++) {
      const rpm = this.state.rpm[i]!;
      this.reactionTorqueBuffer[i] = kQ * rpm * rpm;
    }
    return this.reactionTorqueBuffer;
  }

  reset(): void {
    this.state.rpm = [0, 0, 0, 0];
  }
}
