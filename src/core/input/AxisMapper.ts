import type { StickInputs } from "../physics/types";

export interface AxisMapping {
  throttle: { axis: number; inverted: boolean };
  roll: { axis: number; inverted: boolean };
  pitch: { axis: number; inverted: boolean };
  yaw: { axis: number; inverted: boolean };
}

const STORAGE_KEY = "fpvsim_controller_config";
const DEADBAND = 0.05;

export class AxisMapper {
  private mapping: AxisMapping;

  constructor(mapping: AxisMapping) {
    this.mapping = mapping;
  }

  /** Map raw gamepad axes to normalized stick inputs */
  map(rawAxes: number[]): StickInputs {
    const m = this.mapping;

    const rawThrottle = this.readAxis(
      rawAxes,
      m.throttle.axis,
      m.throttle.inverted,
    );
    const rawRoll = this.readAxis(rawAxes, m.roll.axis, m.roll.inverted);
    const rawPitch = this.readAxis(rawAxes, m.pitch.axis, m.pitch.inverted);
    const rawYaw = this.readAxis(rawAxes, m.yaw.axis, m.yaw.inverted);

    return {
      // Throttle: normalize from [-1, 1] to [0, 1]
      throttle: Math.max(0, Math.min(1, (applyDeadband(rawThrottle) + 1) / 2)),
      roll: applyDeadband(rawRoll),
      pitch: applyDeadband(rawPitch),
      yaw: applyDeadband(rawYaw),
    };
  }

  private readAxis(axes: number[], index: number, inverted: boolean): number {
    const raw = axes[index] ?? 0;
    return inverted ? -raw : raw;
  }

  static loadFromStorage(): AxisMapping | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored) as AxisMapping;
    } catch {
      return null;
    }
  }

  static saveToStorage(mapping: AxisMapping): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mapping));
  }
}

function applyDeadband(value: number): number {
  if (Math.abs(value) < DEADBAND) return 0;
  // Scale remaining range to full [-1, 1]
  const sign = value > 0 ? 1 : -1;
  return sign * (Math.abs(value) - DEADBAND) / (1 - DEADBAND);
}
