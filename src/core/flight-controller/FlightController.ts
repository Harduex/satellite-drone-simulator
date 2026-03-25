import type {
  DroneState,
  MotorCommands,
  RatesConfig,
  StickInputs,
} from "../physics/types";
import { MOTOR_LAYOUT } from "../physics/types";
import { PIDController } from "./PIDController";
import { applyExpo } from "./FlightModes";

// Betaflight-comparable PID gains (scaled for our units: rad/s error → motor command [0,1])
const DEFAULT_PID = {
  roll: { kP: 0.065, kI: 0.035, kD: 0.030, kFF: 0.015 },
  pitch: { kP: 0.065, kI: 0.035, kD: 0.030, kFF: 0.015 },
  yaw: { kP: 0.090, kI: 0.045, kD: 0.010, kFF: 0.020 },
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

  constructor(ratesConfig: RatesConfig) {
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
    return this.updateInto(stickInputs, droneState, dt, { m1: 0, m2: 0, m3: 0, m4: 0 });
  }

  updateInto(
    stickInputs: StickInputs,
    droneState: DroneState,
    dt: number,
    out: MotorCommands,
  ): MotorCommands {
    const { rollRate, pitchRate, yawRate, expo } = this.ratesConfig;

    // Stick → target angular rate (rad/s)
    // In body frame (X=right, Y=forward, Z=up) with right-hand rotation:
    //   Positive omega.y → right roll (right side down), no negation needed
    //   Positive omega.x → nose up, so negate for stick-forward = pitch down (fly forward)
    //   Positive omega.z → yaw left (CCW from above), so negate for stick-right = yaw right
    const targetRollRate = applyExpo(stickInputs.roll, expo) * rollRate *
      DEG_TO_RAD;
    const targetPitchRate = -applyExpo(stickInputs.pitch, expo) * pitchRate *
      DEG_TO_RAD;
    const targetYawRate = -applyExpo(stickInputs.yaw, expo) * yawRate *
      DEG_TO_RAD;

    // PID error = target - actual (body frame angular velocity)
    // Body frame: X=right, Y=forward, Z=up
    // Roll = rotation around Y (forward axis), Pitch = rotation around X (right axis)
    const rollError = targetRollRate - droneState.angularVelocity.y;
    const pitchError = targetPitchRate - droneState.angularVelocity.x;
    const yawError = targetYawRate - droneState.angularVelocity.z;

    const rollCmd = this.rollPID.update(rollError, dt, targetRollRate);
    const pitchCmd = this.pitchPID.update(pitchError, dt, targetPitchRate);
    const yawCmd = this.yawPID.update(yawError, dt, targetYawRate);

    // Motor mixing via shared MOTOR_LAYOUT (single source of truth)
    const throttle = stickInputs.throttle;
    const [ml1, ml2, ml3, ml4] = MOTOR_LAYOUT;

    // Airmode mixer: compute raw values, then shift to preserve differential
    let m1 = throttle + ml1.mixRoll * rollCmd + ml1.mixPitch * pitchCmd + ml1.mixYaw * yawCmd;
    let m2 = throttle + ml2.mixRoll * rollCmd + ml2.mixPitch * pitchCmd + ml2.mixYaw * yawCmd;
    let m3 = throttle + ml3.mixRoll * rollCmd + ml3.mixPitch * pitchCmd + ml3.mixYaw * yawCmd;
    let m4 = throttle + ml4.mixRoll * rollCmd + ml4.mixPitch * pitchCmd + ml4.mixYaw * yawCmd;

    const minMotor = Math.min(m1, m2, m3, m4);
    if (minMotor < 0) {
      const shift = -minMotor;
      m1 += shift; m2 += shift; m3 += shift; m4 += shift;
    }

    const maxMotor = Math.max(m1, m2, m3, m4);
    if (maxMotor > 1) {
      const shift = maxMotor - 1;
      m1 -= shift; m2 -= shift; m3 -= shift; m4 -= shift;
    }

    out.m1 = Math.max(0, Math.min(1, m1));
    out.m2 = Math.max(0, Math.min(1, m2));
    out.m3 = Math.max(0, Math.min(1, m3));
    out.m4 = Math.max(0, Math.min(1, m4));

    return out;
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

