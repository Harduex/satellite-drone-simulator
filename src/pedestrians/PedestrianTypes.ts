import type { Point3, SurfaceEdge, VehiclePose } from '../traffic/TrafficTypes';
export interface WalkingPath {
    id: string;
    points: Point3[];
    pathClass: 'footway' | 'pedestrian' | 'path';
}
export interface WalkingEdge extends SurfaceEdge {
    pathClass: WalkingPath['pathClass'];
}
export interface WalkingGraph {
    edges: Map<string, WalkingEdge>;
}
export interface PedestrianFrame {
    id: number;
    edgeId: string;
    distance: number;
    speed: number;
    modelIndex: number;
    colorIndex: number;
    previous: VehiclePose;
    current: VehiclePose;
    walked: number;
    previousWalked: number;
}
