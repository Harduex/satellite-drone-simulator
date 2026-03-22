import type { AxisMapping } from "./AxisMapper";

export const RADIO_PRESETS: Record<string, AxisMapping> = {
  RadioMaster: {
    throttle: { axis: 1, inverted: false },
    yaw: { axis: 3, inverted: false },
    pitch: { axis: 2, inverted: false },
    roll: { axis: 0, inverted: false },
  },
  Jumper: {
    throttle: { axis: 1, inverted: true },
    yaw: { axis: 3, inverted: false },
    pitch: { axis: 2, inverted: false },
    roll: { axis: 0, inverted: false },
  },
  "TBS Tango": {
    throttle: { axis: 1, inverted: false },
    yaw: { axis: 0, inverted: false },
    pitch: { axis: 3, inverted: false },
    roll: { axis: 2, inverted: false },
  },
  Generic: {
    throttle: { axis: 1, inverted: false },
    yaw: { axis: 0, inverted: false },
    pitch: { axis: 3, inverted: false },
    roll: { axis: 2, inverted: false },
  },
};

/** Fuzzy-match a gamepad.id string to suggest a preset */
export function matchPreset(gamepadId: string): string | null {
  const id = gamepadId.toLowerCase();
  if (id.includes("radiomaster")) return "RadioMaster";
  if (id.includes("jumper")) return "Jumper";
  if (id.includes("tbs") || id.includes("tango")) return "TBS Tango";
  return null;
}
