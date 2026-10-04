import type { Vector3 } from "./types";

/** Bounded fair-weather approximation in ENU, not a meteorological forecast. */
export class WindModel {
  private elapsed = 0;

  updateInto(dt: number, out: Vector3): Vector3 {
    this.elapsed += dt;
    const t = this.elapsed;
    // Long, nonmatching periods avoid abrupt kicks and short repeating gusts.
    out.x = 1.2 + 0.24 * Math.sin(t * 0.31) + 0.08 * Math.sin(t * 0.83);
    out.y = 0.9 + 0.16 * Math.sin(t * 0.23) + 0.06 * Math.sin(t * 0.67);
    out.z = 0.035 * Math.sin(t * 0.41) + 0.015 * Math.sin(t * 0.97);
    return out;
  }

  reset(): void {
    this.elapsed = 0;
  }
}
