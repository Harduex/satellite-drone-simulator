import { TRAFFIC, ROAD_DENSITY, ROAD_SPEED } from './TrafficConfig';
import { poseOnEdge } from './RoadGraph';
import type { Point3, RoadEdge, RoadGraph, VehicleFrame } from './TrafficTypes';

const HOURS: readonly (readonly [number, number])[] = [[0,.35],[5,.35],[6,.75],[8,1.25],[12,1],[17,1.25],[20,.85],[24,.35]];
export function demandMultiplier(hour: number): number {
  if (!Number.isFinite(hour)) return 1;
  hour=(hour%24+24)%24;
  for(let i=1;i<HOURS.length;i++) if(hour<=HOURS[i]![0]) {
    const a=HOURS[i-1]!,b=HOURS[i]!;return a[1]+(b[1]-a[1])*(hour-a[0])/(b[0]-a[0]);
  }
  return 1;
}
interface Car extends VehicleFrame { nominal: number; next: string | null; waiting: number }
export class TrafficSimulation {
  private graph: RoadGraph = {edges:new Map()};
  private cars: Car[]=[];
  private center:Point3={x:0,y:0,z:0};
  private demand=1;
  private randomState:number;
  private nextId=0;
  private populationAccumulator=0;
  private reservations=new Map<string,number>();
  constructor(private seed=42, private lengths:readonly number[]=[4.3,4.1,4.6]) { this.randomState=seed; }
  private random():number { this.randomState=(Math.imul(this.randomState,1664525)+1013904223)>>>0;return this.randomState/4294967296; }
  setCenter(center:Point3):void {this.center={...center};}
  setDemand(hour:number):void {this.demand=demandMultiplier(hour);}
  setGraph(graph:RoadGraph):void {
    this.graph=graph;this.cars=this.cars.filter(car=>graph.edges.has(car.edgeId));
    for(const car of this.cars) if(car.next&&!graph.edges.has(car.next)) car.next=null;
    this.reservations.clear();
  }
  reset(center:Point3):void {
    this.center={...center};this.cars=[];this.reservations.clear();this.randomState=this.seed;this.nextId=0;
    const target=this.target();
    for(let i=0;i<target*5 && this.cars.length<target;i++) this.spawn(false);
  }
  getFrames():readonly VehicleFrame[]{return this.cars;}
  private target():number {
    let value=0;
    for(const edge of this.graph.edges.values()) {
      const mid=poseOnEdge(edge,edge.length/2).position;
      if(Math.hypot(mid.x-this.center.x,mid.y-this.center.y)<TRAFFIC.radius) value+=edge.length/1000*ROAD_DENSITY[edge.roadClass];
    }
    return Math.min(TRAFFIC.cars,Math.round(value*this.demand));
  }
  private spawn(peripheral:boolean):void {
    const edges=[...this.graph.edges.values()];if(!edges.length)return;
    const edge=edges[Math.floor(this.random()*edges.length)]!;
    const distance=this.random()*edge.length, pose=poseOnEdge(edge,distance);
    const radius=Math.hypot(pose.position.x-this.center.x,pose.position.y-this.center.y);
    if(radius>TRAFFIC.radius || (peripheral&&radius<TRAFFIC.radius*.65))return;
    const length=this.lengths[Math.floor(this.random()*this.lengths.length)]!;
    const gap=4+ROAD_SPEED[edge.roadClass]*1.5+length;
    if(this.cars.some(car=>car.edgeId===edge.id&&Math.abs(car.distance-distance)<gap))return;
    const modelIndex=this.lengths.indexOf(length);
    this.cars.push({id:this.nextId++,modelIndex,colorIndex:Math.floor(this.random()*6),length,edgeId:edge.id,distance,
      speed:0,nominal:ROAD_SPEED[edge.roadClass]*(.9+.2*this.random()),next:null,waiting:0,
      previous:{position:{...pose.position},heading:pose.heading,pitch:pose.pitch},current:pose});
  }
  private chooseNext(edge:RoadEdge):string|null {
    const options=edge.outgoing.map(id=>this.graph.edges.get(id)!).filter(Boolean);
    if(!options.length)return null;
    const heading=poseOnEdge(edge,edge.length).heading;
    const weighted=options.map(next=>({next,weight:(2+Math.cos(poseOnEdge(next,0).heading-heading)*1.8)*ROAD_SPEED[next.roadClass]}));
    let value=this.random()*weighted.reduce((sum,item)=>sum+item.weight,0);
    for(const item of weighted){value-=item.weight;if(value<=0)return item.next.id;}
    return options[0]!.id;
  }
  private leaderGap(car:Car,edge:RoadEdge):number {
    let gap=Infinity;
    for(const leader of this.cars) if(leader.id!==car.id&&leader.edgeId===edge.id&&leader.distance>car.distance) {
      gap=Math.min(gap,leader.distance-car.distance-(leader.length+car.length)/2);
    }
    let traversed=edge.length-car.distance, next=car.next;
    const visited=new Set<string>();
    while(next&&traversed<150&&!visited.has(next)) {
      visited.add(next);const following=this.graph.edges.get(next);if(!following)break;
      for(const leader of this.cars) if(leader.id!==car.id&&leader.edgeId===next) gap=Math.min(gap,traversed+leader.distance-(leader.length+car.length)/2);
      traversed+=following.length;next=following.outgoing.length===1?following.outgoing[0]!:null;
    }
    return gap;
  }
  step(dt:number):void {
    if(!Number.isFinite(dt)||dt<=0)return;
    dt=Math.min(dt,.1);
    this.populationAccumulator+=dt;
    if(this.populationAccumulator>=.2){this.populationAccumulator-=.2;if(this.cars.length<this.target())this.spawn(true);}
    const retired=new Set<number>();
    const ordered=[...this.cars].sort((a,b)=>b.waiting-a.waiting || a.id-b.id);
    for(const car of ordered){
      const edge=this.graph.edges.get(car.edgeId);if(!edge){retired.add(car.id);continue;}
      car.previous={position:{...car.current.position},heading:car.current.heading,pitch:car.current.pitch};
      car.next??=this.chooseNext(edge);
      let available=this.leaderGap(car,edge);
      const remaining=edge.length-car.distance;
      let target=car.nominal;
      const next=car.next?this.graph.edges.get(car.next):undefined;
      const owner=this.reservations.get(edge.end);
      const contested=[...this.graph.edges.values()].some(other=>other.end===edge.end&&other.id!==edge.id&&other.outgoing.length>0);
      if(next&&remaining<20){
        const delta=Math.atan2(Math.sin(poseOnEdge(next,0).heading-car.current.heading),Math.cos(poseOnEdge(next,0).heading-car.current.heading));
        target=Math.min(target,Math.abs(delta)>.3?5:car.nominal);
        const exitBlocked=this.cars.some(other=>other.id!==car.id&&other.edgeId===next.id&&other.distance<car.length+6);
        const priorityWaiting=this.cars.some(other=>other.id!==car.id&&this.graph.edges.get(other.edgeId)?.end===edge.end&&
          ROAD_SPEED[this.graph.edges.get(other.edgeId)!.roadClass]>ROAD_SPEED[edge.roadClass]&&other.waiting>0&&car.waiting<5);
        if(exitBlocked||(contested&&owner!==undefined&&owner!==car.id)||priorityWaiting) available=Math.min(available,Math.max(0,remaining-car.length/2));
        else if(contested)this.reservations.set(edge.end,car.id);
      }
      const desiredGap=4+car.speed*1.5;
      if(available<desiredGap)target=Math.min(target,Math.max(0,(available-4)/1.5));
      car.speed+=Math.max(-5*dt,Math.min(2*dt,target-car.speed));
      const advance=Math.max(0,Math.min(car.speed*dt,available-1));
      car.waiting=advance<.01?car.waiting+dt:0;
      car.distance+=advance;
      if(car.distance>=edge.length){
        if(this.reservations.get(edge.end)===car.id)this.reservations.delete(edge.end);
        if(!next){retired.add(car.id);continue;}
        car.distance-=edge.length;car.edgeId=next.id;car.next=null;
      }
      const currentEdge=this.graph.edges.get(car.edgeId)!;
      car.current=poseOnEdge(currentEdge,car.distance);
      if(Math.hypot(car.current.position.x-this.center.x,car.current.position.y-this.center.y)>TRAFFIC.radius+20)retired.add(car.id);
    }
    for(const [node,id]of this.reservations)if(retired.has(id)||!this.cars.some(car=>car.id===id))this.reservations.delete(node);
    this.cars=this.cars.filter(car=>!retired.has(car.id));
  }
}
