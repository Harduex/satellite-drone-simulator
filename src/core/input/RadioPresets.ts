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
  // BETAFPV LiteRadio 2 SE — USB HID joystick (Mode 2):
  //   Left stick:  throttle axis 1 (inverted: full up = -1), yaw axis 0
  //   Right stick: pitch axis 2 (inverted: push fwd = -1), roll axis 3
  BETAFPV: {
    throttle: { axis: 1, inverted: true },
    yaw: { axis: 0, inverted: false },
    pitch: { axis: 2, inverted: true },
    roll: { axis: 3, inverted: false },
  },
  Generic: {
    throttle: { axis: 1, inverted: true },
    yaw: { axis: 0, inverted: false },
    pitch: { axis: 2, inverted: true },
    roll: { axis: 3, inverted: false },
  },
};

/** Fuzzy-match a gamepad.id string to suggest a preset. Falls back to "Generic". */
export function matchPreset(gamepadId: string): string {
  const id = gamepadId.toLowerCase();
  if (id.includes("radiomaster")) return "RadioMaster";
  if (id.includes("jumper")) return "Jumper";
  if (id.includes("tbs") || id.includes("tango")) return "TBS Tango";
  if (id.includes("betafpv") || id.includes("literadio") || id.includes("lite radio")) return "BETAFPV";
  return "Generic";
}
