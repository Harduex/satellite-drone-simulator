export interface Point3 {
  x: number;
  y: number;
  z: number;
}
export interface GeoPoint {
  longitude: number;
  latitude: number;
}
export interface TileKey {
  z: number;
  x: number;
  y: number;
}
export type RoadClass =
  "motorway" | "trunk" | "primary" | "secondary" | "tertiary" | "minor";
export interface RoadSegment {
  id: string;
  points: Point3[];
  roadClass: RoadClass;
  oneway: -1 | 0 | 1;
  bridge: boolean;
  layer: number;
}
export interface SurfaceEdge {
  id: string;
  points: Point3[];
  length: number;
  bridge: boolean;
  layer: number;
  start: string;
  end: string;
  outgoing: string[];
  pendingContinuation?: boolean;
}
export interface RoadEdge extends SurfaceEdge {
  roadClass: RoadClass;
}
export interface RoadGraph {
  edges: Map<string, RoadEdge>;
}
export interface VehiclePose {
  position: Point3;
  heading: number;
  pitch: number;
}
export interface VehicleFrame {
  id: number;
  modelIndex: number;
  colorIndex: number;
  previous: VehiclePose;
  current: VehiclePose;
  speed: number;
  length: number;
  edgeId: string;
  distance: number;
}
export interface TrafficCounters {
  cars: number;
  edges: number;
  cachedTiles: number;
  cachedBytes: number;
  pendingRequests: number;
  requestFailures: number;
  refreshes: number;
  updateMs: number;
  surfaceSamples: number;
  surfaceMs: number;
  pendingSurfaceRoads: number;
  rejectedRoads: number;
}
