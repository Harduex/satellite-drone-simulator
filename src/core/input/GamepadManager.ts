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
      this.applyMappingForGamepad(gp);
      if (!this.axisMapper) return null;
    }

    return this.axisMapper.map(gp.axes);
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

  private applyMappingForGamepad(gp: Gamepad): void {
    // Try saved mapping from localStorage first
    const saved = AxisMapper.loadFromStorage();
    if (saved) {
      this.axisMapper = new AxisMapper(saved);
      return;
    }

    // Auto-detect preset from gamepad name
    const preset = matchPreset(gp.id);
    if (preset) {
      const mapping = RADIO_PRESETS[preset];
      if (mapping) {
        this.axisMapper = new AxisMapper(mapping);
      }
    }
  }

  private handleConnect(e: GamepadEvent): void {
    const gp = e.gamepad;
    if (gp.axes.length >= 4) {
      this.gamepadIndex = gp.index;
      // Clear stale mapper so we re-detect for the newly connected device
      this.axisMapper = null;
      this.onConnect?.(gp);
    }
  }

  private handleDisconnect(_e: GamepadEvent): void {
    this.gamepadIndex = null;
    this.axisMapper = null;
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
