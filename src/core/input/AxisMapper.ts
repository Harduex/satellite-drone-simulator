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

interface NormalizedChannel {
  axis: number;
  inverted: boolean;
  deadzone: number;
  centerOffset: number;
}

function normalizeChannel(ch: AxisChannelConfig): NormalizedChannel {
  return {
    axis: ch.axis,
    inverted: ch.inverted,
    deadzone: ch.deadzone ?? DEFAULT_DEADZONE,
    centerOffset: ch.centerOffset ?? 0,
  };
}

export class AxisMapper {
  private tCh: NormalizedChannel;
  private rCh: NormalizedChannel;
  private pCh: NormalizedChannel;
  private yCh: NormalizedChannel;
  private _stickOut: StickInputs = { throttle: 0, roll: 0, pitch: 0, yaw: 0 };

  constructor(mapping: AxisMapping) {
    this.tCh = normalizeChannel(mapping.throttle);
    this.rCh = normalizeChannel(mapping.roll);
    this.pCh = normalizeChannel(mapping.pitch);
    this.yCh = normalizeChannel(mapping.yaw);
  }

  /** Map raw gamepad axes to normalized stick inputs (shared mutable buffer) */
  map(rawAxes: ArrayLike<number>): StickInputs {
    const rawThrottle = this.readAxis(rawAxes, this.tCh.axis, this.tCh.inverted, this.tCh.centerOffset);
    const rawRoll = this.readAxis(rawAxes, this.rCh.axis, this.rCh.inverted, this.rCh.centerOffset);
    const rawPitch = this.readAxis(rawAxes, this.pCh.axis, this.pCh.inverted, this.pCh.centerOffset);
    const rawYaw = this.readAxis(rawAxes, this.yCh.axis, this.yCh.inverted, this.yCh.centerOffset);

    this._stickOut.throttle = Math.max(0, Math.min(1, (applyDeadband(rawThrottle, this.tCh.deadzone) + 1) / 2));
    this._stickOut.roll = applyDeadband(rawRoll, this.rCh.deadzone);
    this._stickOut.pitch = applyDeadband(rawPitch, this.pCh.deadzone);
    this._stickOut.yaw = applyDeadband(rawYaw, this.yCh.deadzone);
    return this._stickOut;
  }

  private readAxis(axes: ArrayLike<number>, index: number, inverted: boolean, centerOffset: number): number {
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
