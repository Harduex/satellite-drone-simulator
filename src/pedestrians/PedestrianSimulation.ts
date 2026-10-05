import type { Point3 } from '../traffic/TrafficTypes';
import { poseOnEdge } from '../traffic/RoadGraph';
import { PEDESTRIANS, PEDESTRIAN_MODELS } from './PedestrianConfig';
import type { PedestrianFrame, WalkingEdge, WalkingGraph } from './PedestrianTypes';
export class PedestrianSimulation {
    private graph: WalkingGraph = { edges: new Map() };
    private edges: WalkingEdge[] = [];
    private people: PedestrianFrame[] = [];
    private center: Point3 = { x: 0, y: 0, z: 0 };
    private randomState = 73;
    private nextId = 0;
    private populationTime = 0;
    private random(): number { this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0; return this.randomState / 4294967296; }
    setGraph(graph: WalkingGraph): void {
        this.graph = graph;
        this.edges = [...graph.edges.values()];
        this.people = this.people.filter(p => graph.edges.has(p.edgeId));
        if (this.people.length === 0 && this.edges.length > 0)
            this.populate();
    }
    setCenter(center: Point3): void { this.center = { ...center }; }
    reset(center: Point3): void { this.center = { ...center }; this.people = []; this.populationTime = 0; }
    getFrames(): readonly PedestrianFrame[] { return this.people; }
    private nearby(p: Point3): boolean { return Math.hypot(p.x - this.center.x, p.y - this.center.y) <= PEDESTRIANS.radius; }
    step(delta: number): void {
        if (!Number.isFinite(delta) || delta <= 0)
            return;
        delta = Math.min(PEDESTRIANS.step, delta);
        const survivors: PedestrianFrame[] = [];
        for (const person of this.people) {
            const edge = this.graph.edges.get(person.edgeId);
            if (!edge || !this.nearby(person.current.position))
                continue;
            person.previous = person.current;
            person.previousWalked = person.walked;
            let distance = person.distance + person.speed * delta, next = edge;
            if (distance >= edge.length) {
                const outgoing = edge.outgoing.map(id => this.graph.edges.get(id)).filter((e): e is WalkingEdge => !!e);
                if (!outgoing.length) {
                    if (edge.pendingContinuation) {
                        distance = edge.length;
                    }
                    else
                        continue;
                }
                else {
                    next = outgoing[Math.floor(this.random() * outgoing.length)]!;
                    distance -= edge.length;
                }
            }
            const pose = poseOnEdge(next, distance);
            if (!this.nearby(pose.position))
                continue;
            // Narrow mapped centerlines cannot support passing crowds safely.
            const crowded = survivors.some(other => Math.hypot(other.current.position.x - pose.position.x, other.current.position.y - pose.position.y) < .8);
            if (!crowded) {
                person.walked += Math.hypot(pose.position.x - person.current.position.x, pose.position.y - person.current.position.y);
                person.current = pose;
                person.distance = distance;
                person.edgeId = next.id;
            }
            survivors.push(person);
        }
        this.people = survivors;
        this.populationTime += delta;
        if (this.populationTime >= .1) {
            this.populationTime %= .1;
            this.populate();
        }
    }
    private populate(): void {
        const near = this.edges.filter(e => this.nearby(poseOnEdge(e, e.length / 2).position));
        const target = Math.min(PEDESTRIANS.people, Math.floor(near.reduce((sum, e) => sum + e.length, 0) / 2 / 15));
        if (this.people.length >= target) {
            if (this.people.length > target)
                this.people.pop();
            return;
        }
        for (let attempt = 0; attempt < 32 && near.length && this.people.length < target; attempt++) {
            const edge = near[Math.floor(this.random() * near.length)]!, distance = this.random() * edge.length, pose = poseOnEdge(edge, distance);
            if (!this.nearby(pose.position) || this.people.some(p => Math.hypot(p.current.position.x - pose.position.x, p.current.position.y - pose.position.y) < 2))
                continue;
            this.people.push({ id: this.nextId++, edgeId: edge.id, distance, speed: 1 + this.random() * .6, modelIndex: Math.floor(this.random() * PEDESTRIAN_MODELS.length), colorIndex: Math.floor(this.random() * 6), previous: pose, current: pose, walked: 0, previousWalked: 0 });
        }
    }
}
