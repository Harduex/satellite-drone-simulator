import type {
  DroneState,
  MotorCommands,
  RatesConfig,
  StickInputs,
} from "../physics/types";
import { PIDController } from "./PIDController";
import { applyExpo } from "./FlightModes";

// Betaflight-comparable PID gains (scaled for our units: rad/s error → motor command [0,1])
const DEFAULT_PID = {
  roll: { kP: 0.045, kI: 0.06, kD: 0.025 },
  pitch: { kP: 0.045, kI: 0.06, kD: 0.025 },
  yaw: { kP: 0.065, kI: 0.08, kD: 0.0 },
};

const DEG_TO_RAD = Math.PI / 180;

/**
 * Acro mode flight controller.
 * Sticks → target angular rates → PID → motor mixing.
 */
export class FlightController {
  private ratesConfig: RatesConfig;
  private rollPID: PIDController;
  private pitchPID: PIDController;
  private yawPID: PIDController;

  constructor(_physicsConfig: unknown, ratesConfig: RatesConfig) {
    this.ratesConfig = ratesConfig;
    this.rollPID = new PIDController(DEFAULT_PID.roll);
    this.pitchPID = new PIDController(DEFAULT_PID.pitch);
    this.yawPID = new PIDController(DEFAULT_PID.yaw);
  }

  update(
    stickInputs: StickInputs,
    droneState: DroneState,
    dt: number,
  ): MotorCommands {
    const { rollRate, pitchRate, yawRate, expo } = this.ratesConfig;

    // Stick → target angular rate (rad/s)
    const targetRollRate = applyExpo(stickInputs.roll, expo) * rollRate *
      DEG_TO_RAD;
    const targetPitchRate = applyExpo(stickInputs.pitch, expo) * pitchRate *
      DEG_TO_RAD;
    const targetYawRate = applyExpo(stickInputs.yaw, expo) * yawRate *
      DEG_TO_RAD;

    // PID error = target - actual (body frame angular velocity)
    const rollError = targetRollRate - droneState.angularVelocity.x;
    const pitchError = targetPitchRate - droneState.angularVelocity.y;
    const yawError = targetYawRate - droneState.angularVelocity.z;

    const rollCmd = this.rollPID.update(rollError, dt);
    const pitchCmd = this.pitchPID.update(pitchError, dt);
    const yawCmd = this.yawPID.update(yawError, dt);

    // Motor mixing (must match motor layout exactly):
    //   M1(front-left, CCW):  -roll + pitch + yaw
    //   M2(front-right, CW):  +roll + pitch - yaw
    //   M3(back-right, CCW):  +roll - pitch + yaw
    //   M4(back-left, CW):    -roll - pitch - yaw
    const throttle = stickInputs.throttle;

    const m1 = clamp01(throttle - rollCmd + pitchCmd + yawCmd);
    const m2 = clamp01(throttle + rollCmd + pitchCmd - yawCmd);
    const m3 = clamp01(throttle + rollCmd - pitchCmd + yawCmd);
    const m4 = clamp01(throttle - rollCmd - pitchCmd - yawCmd);

    return { m1, m2, m3, m4 };
  }

  updateRates(rates: RatesConfig): void {
    this.ratesConfig = rates;
  }

  reset(): void {
    this.rollPID.reset();
    this.pitchPID.reset();
    this.yawPID.reset();
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
