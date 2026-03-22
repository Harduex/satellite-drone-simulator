import type { MotorCommands } from "../core/physics/types";

export interface BatteryState {
  voltage: number;
  percentRemaining: number;
  capacityUsedMah: number;
}

// 4S LiPo battery simulation
const FULL_VOLTAGE = 16.8; // 4.2V per cell × 4
const NOMINAL_VOLTAGE = 14.8; // 3.7V per cell × 4
const EMPTY_VOLTAGE = 12.0; // 3.0V per cell × 4
const TOTAL_CAPACITY_MAH = 1300;

// At full throttle 4 motors, roughly 30A draw → drains ~1300mAh in 2.6 min
const AMPS_PER_FULL_THROTTLE = 30;

export class BatteryModel {
  private capacityUsedMah = 0;

  drain(motorCommands: MotorCommands, dt: number): BatteryState {
    // Average throttle across 4 motors
    const avgThrottle =
      (motorCommands.m1 + motorCommands.m2 + motorCommands.m3 +
        motorCommands.m4) / 4;

    // Current draw proportional to throttle (simplified)
    const currentAmps = avgThrottle * AMPS_PER_FULL_THROTTLE;

    // Convert to mAh: (amps * dt_seconds) / 3.6 = mAh
    const drainMah = (currentAmps * dt) / 3.6;
    this.capacityUsedMah += drainMah;

    const percentRemaining = Math.max(
      0,
      100 * (1 - this.capacityUsedMah / TOTAL_CAPACITY_MAH),
    );

    // Voltage sag: linear interpolation from full to empty based on capacity
    const t = this.capacityUsedMah / TOTAL_CAPACITY_MAH;
    let voltage: number;
    if (t < 0.8) {
      // 80% of capacity: linear from full to nominal
      voltage = FULL_VOLTAGE - (FULL_VOLTAGE - NOMINAL_VOLTAGE) * (t / 0.8);
    } else {
      // Last 20%: steeper drop to empty
      const t2 = (t - 0.8) / 0.2;
      voltage = NOMINAL_VOLTAGE - (NOMINAL_VOLTAGE - EMPTY_VOLTAGE) * t2;
    }
    voltage = Math.max(EMPTY_VOLTAGE, voltage);

    return {
      voltage,
      percentRemaining,
      capacityUsedMah: this.capacityUsedMah,
    };
  }

  reset(): void {
    this.capacityUsedMah = 0;
  }
}
