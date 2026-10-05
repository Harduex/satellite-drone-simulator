import type { Vector3 } from "./types";
import { meanWindInto, resolveWindConfig, type WindConfig } from "./WindConfig";

/** Bounded temporal weather approximation; no spatial turbulence or calibrated gust torque. */
export class WindModel {
  private config: WindConfig;
  private mean = { x: 0, y: 0, z: 0 };
  private gust = { x: 0, y: 0, z: 0 };
  private target = { x: 0, y: 0, z: 0 };
  private remaining = 0;
  private randomState = 0;
  private readonly initialSeed: number;

  constructor(config: WindConfig = resolveWindConfig({}), seed = 1729) {
    this.config = config;
    this.initialSeed = seed >>> 0 || 1729;
    this.setConfig(config);
    this.reset();
  }

  setConfig(config: WindConfig): void {
    this.config = resolveWindConfig(config);
    meanWindInto(this.config, this.mean);
  }

  private random(): number {
    let seed = this.randomState;
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    this.randomState = seed >>> 0;
    return this.randomState / 4294967296;
  }

  updateInto(dt: number, out: Vector3): Vector3 {
    let pending = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    // Split at target boundaries so sampling depends on simulation time, not render grouping.
    while (pending > 1e-12) {
      if (this.remaining < 1e-12) {
        const angle = this.random() * Math.PI * 2;
        const radius = Math.sqrt(this.random());
        this.target.x = radius * Math.cos(angle);
        this.target.y = radius * Math.sin(angle);
        this.target.z = this.random() * 2 - 1;
        this.remaining = 2;
      }
      const step = Math.min(pending, this.remaining);
      const alpha = -Math.expm1(-step / 1.5);
      this.gust.x += (this.target.x - this.gust.x) * alpha;
      this.gust.y += (this.target.y - this.gust.y) * alpha;
      this.gust.z += (this.target.z - this.gust.z) * alpha;
      this.remaining -= step;
      pending -= step;
    }
    const strength = this.config.windGustStrength;
    out.x = this.mean.x + strength * this.gust.x;
    out.y = this.mean.y + strength * this.gust.y;
    out.z = strength * 0.1 * this.gust.z;
    return out;
  }

  reset(): void {
    this.randomState = this.initialSeed;
    this.remaining = 0;
    this.gust.x = this.gust.y = this.gust.z = 0;
  }
}
