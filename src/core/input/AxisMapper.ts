import type { StickInputs } from "../physics/types";

export interface AxisChannelConfig {
  axis: number;
  inverted: boolean;
  deadzone?: number; // 0.00–0.30, defaults to DEFAULT_DEADZONE
  centerOffset?: number; // raw center value, defaults to 0.0
}

export interface AxisMapping {
  throttle: AxisChannelConfig;
  roll: AxisChannelConfig;
  pitch: AxisChannelConfig;
  yaw: AxisChannelConfig;
}

const STORAGE_KEY = "fpvsim_controller_config";
export const DEFAULT_DEADZONE = 0.05;

function normalizeChannel(ch: AxisChannelConfig) {
  return {
    axis: ch.axis,
    inverted: ch.inverted,
    deadzone: ch.deadzone ?? DEFAULT_DEADZONE,
    centerOffset: ch.centerOffset ?? 0,
  };
}

export class AxisMapper {
  private mapping: AxisMapping;

  constructor(mapping: AxisMapping) {
    this.mapping = mapping;
  }

  /** Map raw gamepad axes to normalized stick inputs */
  map(rawAxes: number[]): StickInputs {
    const m = this.mapping;
    const tCh = normalizeChannel(m.throttle);
    const rCh = normalizeChannel(m.roll);
    const pCh = normalizeChannel(m.pitch);
    const yCh = normalizeChannel(m.yaw);

    const rawThrottle = this.readAxis(rawAxes, tCh.axis, tCh.inverted, tCh.centerOffset);
    const rawRoll = this.readAxis(rawAxes, rCh.axis, rCh.inverted, rCh.centerOffset);
    const rawPitch = this.readAxis(rawAxes, pCh.axis, pCh.inverted, pCh.centerOffset);
    const rawYaw = this.readAxis(rawAxes, yCh.axis, yCh.inverted, yCh.centerOffset);

    return {
      throttle: Math.max(0, Math.min(1, (applyDeadband(rawThrottle, tCh.deadzone) + 1) / 2)),
      roll: applyDeadband(rawRoll, rCh.deadzone),
      pitch: applyDeadband(rawPitch, pCh.deadzone),
      yaw: applyDeadband(rawYaw, yCh.deadzone),
    };
  }

  private readAxis(axes: number[], index: number, inverted: boolean, centerOffset: number): number {
    const raw = (axes[index] ?? 0) - centerOffset;
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

function applyDeadband(value: number, deadzone: number): number {
  if (Math.abs(value) < deadzone) return 0;
  const sign = value > 0 ? 1 : -1;
  return sign * (Math.abs(value) - deadzone) / (1 - deadzone);
}
