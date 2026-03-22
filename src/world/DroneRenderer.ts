import * as Cesium from "cesium";

export class DroneRenderer {
  private entity: Cesium.Entity | null = null;
  private viewer: Cesium.Viewer | null = null;

  init(viewer: Cesium.Viewer): void {
    this.viewer = viewer;
    // Simple point primitive for now — geometric model in Phase 7
    this.entity = viewer.entities.add({
      position: Cesium.Cartesian3.ZERO,
      point: {
        pixelSize: 8,
        color: Cesium.Color.LIME,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
      },
    });
  }

  getEntity(): Cesium.Entity | null {
    return this.entity;
  }

  update(ecefPosition: Cesium.Cartesian3): void {
    if (!this.entity) return;
    (this.entity.position as Cesium.ConstantPositionProperty).setValue(
      ecefPosition,
    );
  }

  destroy(): void {
    if (this.viewer && this.entity) {
      this.viewer.entities.remove(this.entity);
    }
    this.entity = null;
    this.viewer = null;
  }
}
