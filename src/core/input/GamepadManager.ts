import type { AxisMapping } from "./AxisMapper";
import { AxisMapper } from "./AxisMapper";
import { matchPreset, RADIO_PRESETS } from "./RadioPresets";
import type { StickInputs } from "../physics/types";

export class GamepadManager {
  private axisMapper: AxisMapper | null = null;
  private gamepadIndex: number | null = null;
  onConnect: ((gamepad: Gamepad) => void) | null = null;
  onDisconnect: (() => void) | null = null;

  constructor() {
    this.handleConnect = this.handleConnect.bind(this);
    this.handleDisconnect = this.handleDisconnect.bind(this);
  }

  startPolling(): void {
    window.addEventListener("gamepadconnected", this.handleConnect);
    window.addEventListener("gamepaddisconnected", this.handleDisconnect);

    // Load saved mapping from localStorage
    const saved = AxisMapper.loadFromStorage();
    if (saved) {
      this.axisMapper = new AxisMapper(saved);
    }

    // Check if a gamepad is already connected
    this.detectExisting();
  }

  stopPolling(): void {
    window.removeEventListener("gamepadconnected", this.handleConnect);
    window.removeEventListener("gamepaddisconnected", this.handleDisconnect);
    this.gamepadIndex = null;
    this.axisMapper = null;
  }

  /** Called from game loop tick — polls current gamepad and returns mapped stick inputs */
  read(): StickInputs | null {
    if (this.gamepadIndex === null) return null;

    const gamepads = navigator.getGamepads();
    const gp = gamepads[this.gamepadIndex];
    if (!gp) return null;

    if (!this.axisMapper) {
      // Auto-detect preset if no mapping configured
      const preset = matchPreset(gp.id);
      if (preset) {
        const mapping = RADIO_PRESETS[preset];
        if (mapping) {
          this.axisMapper = new AxisMapper(mapping);
        }
      }
      if (!this.axisMapper) return null;
    }

    const rawAxes = Array.from(gp.axes);
    return this.axisMapper.map(rawAxes);
  }

  getConnectedGamepad(): Gamepad | null {
    if (this.gamepadIndex === null) return null;
    const gamepads = navigator.getGamepads();
    return gamepads[this.gamepadIndex] ?? null;
  }

  setMapping(mapping: AxisMapping): void {
    this.axisMapper = new AxisMapper(mapping);
    AxisMapper.saveToStorage(mapping);
  }

  private handleConnect(e: GamepadEvent): void {
    const gp = e.gamepad;
    if (gp.axes.length >= 4) {
      this.gamepadIndex = gp.index;
      this.onConnect?.(gp);
    }
  }

  private handleDisconnect(_e: GamepadEvent): void {
    this.gamepadIndex = null;
    this.onDisconnect?.();
  }

  private detectExisting(): void {
    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (gp && gp.axes.length >= 4) {
        this.gamepadIndex = gp.index;
        this.onConnect?.(gp);
        break;
      }
    }
  }
}
