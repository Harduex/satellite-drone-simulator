import type { PhysicsConfig } from "./types";

export interface MotorState {
  rpm: number[]; // 4 motors current RPM
}

export class MotorModel {
  private config: PhysicsConfig;
  state: MotorState;

  constructor(config: PhysicsConfig) {
    this.config = config;
    this.state = { rpm: [0, 0, 0, 0] };
  }

  /**
   * Update motor RPMs from throttle commands [0,1] with first-order spin-up lag.
   * Returns thrust (N) for each of the 4 motors.
   */
  update(throttleCommands: number[], dt: number): number[] {
    const { kT, maxThrottleRpm, motorTimeConstant } = this.config;
    const thrusts: number[] = [];
    const alpha = 1 - Math.exp(-dt / motorTimeConstant);

    for (let i = 0; i < 4; i++) {
      const cmd = Math.max(0, Math.min(1, throttleCommands[i] ?? 0));
      const targetRpm = cmd * maxThrottleRpm;

      // First-order lag filter for motor spin-up/down
      const currentRpm = this.state.rpm[i] ?? 0;
      const newRpm = currentRpm + alpha * (targetRpm - currentRpm);
      this.state.rpm[i] = newRpm;

      // Thrust: T = kT * rpm²
      thrusts.push(kT * newRpm * newRpm);
    }

    return thrusts;
  }

  /** Get reaction torque per motor for yaw computation */
  getReactionTorques(): number[] {
    const { kQ } = this.config;
    return this.state.rpm.map((rpm) => kQ * rpm * rpm);
  }

  reset(): void {
    this.state.rpm = [0, 0, 0, 0];
  }
}
