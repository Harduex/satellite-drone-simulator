import * as Cesium from 'cesium';
import type { FlightNavigationSnapshot, MapPosition } from '../core/navigation/types';
import { quatRotateVector, type DroneState, type Vector3 } from '../core/physics/types';
import { enuToEcef } from '../world/CoordUtils';

export class FlightNavigation {
  private lastUpdate = -Infinity;
  private heading = 0;
  private trail: MapPosition[] = [];
  private lastTrailPosition: { x: number; y: number } | null = null;
  private readonly home: MapPosition | null;

  constructor(private readonly frame: Cesium.Matrix4, private readonly spawn: Vector3) {
    this.home = this.toMapPosition(spawn);
  }

  reset(): void {
    this.lastUpdate = -Infinity;
    this.heading = 0;
    this.trail = [];
    this.lastTrailPosition = null;
  }

  update(state: DroneState, now: number): FlightNavigationSnapshot | null {
    if (!this.home) return null;
    if (now - this.lastUpdate < 200) return null;
    this.lastUpdate = now;
    const forward = quatRotateVector(state.quaternion, { x: 0, y: 1, z: 0 });
    if (Math.hypot(forward.x, forward.y) > 0.01) {
      this.heading = (Math.atan2(forward.x, forward.y) * 180 / Math.PI + 360) % 360;
    }
    const position = this.toMapPosition(state.position);
    if (!position) return null;
    const dx = this.spawn.x - state.position.x;
    const dy = this.spawn.y - state.position.y;
    const homeDistance = Math.hypot(dx, dy);
    const bearing = Math.atan2(dx, dy) * 180 / Math.PI;
    const homeDirection = homeDistance < 1 ? 0 : ((bearing - this.heading + 540) % 360) - 180;
    if (!this.lastTrailPosition || Math.hypot(
      state.position.x - this.lastTrailPosition.x,
      state.position.y - this.lastTrailPosition.y,
    ) >= 2) {
      this.trail.push(position);
      if (this.trail.length > 300) this.trail.shift();
      this.lastTrailPosition = { x: state.position.x, y: state.position.y };
    }
    return { position, home: this.home, heading: this.heading, homeDirection, homeDistance,
      trail: [...this.trail] };
  }

  private toMapPosition(position: Vector3): MapPosition | null {
    if (![position.x, position.y, position.z].every(Number.isFinite)) return null;
    const cartographic = Cesium.Cartographic.fromCartesian(enuToEcef(position, this.frame));
    if (!cartographic) return null;
    return { lat: Cesium.Math.toDegrees(cartographic.latitude), lng: Cesium.Math.toDegrees(cartographic.longitude) };
  }
}
