export enum FlightMode {
  ACRO = "ACRO",
}

/** Apply expo curve to a stick input [-1, 1] */
export function applyExpo(input: number, expo: number): number {
  return input * (expo * input * input + (1 - expo));
}
