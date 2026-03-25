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

    // Cache exp() alpha values — dt is always PHYSICS_DT, tau has only 2 possible values
    if (dt !== this.cachedDt) {
      this.cachedDt = dt;
      this.cachedAlphaSpinUp = 1 - Math.exp(-dt / motorTimeConstant);
      this.cachedAlphaSpinDown = 1 - Math.exp(-dt / (motorTimeConstant * motorSpinDownFactor));
    }

    for (let i = 0; i < 4; i++) {
      const cmd = Math.max(0, Math.min(1, throttleCommands[i] ?? 0));

      // Thrust linearization: T = kT * RPM² is quadratic in cmd.
      // Applying sqrt makes thrust linear in stick position.
      const linearizedCmd = this.config.thrustLinearization !== false
        ? Math.sqrt(cmd) : cmd;
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
