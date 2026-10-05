import { it, expect } from 'vitest';
import { PbfWriter } from 'pbf';
import { decodePedestrianTile } from '../PedestrianSource';

function tile(features: {properties: Record<string,string>;points: number[][]}[]) {
  const writer=new PbfWriter(),keys=[...new Set(features.flatMap(f=>Object.keys(f.properties)))],values=[...new Set(features.flatMap(f=>Object.values(f.properties)))];
  writer.writeMessage(3,(_,layer)=>{
    layer.writeStringField(1,'transportation');layer.writeVarintField(5,4096);
    keys.forEach(k=>layer.writeStringField(3,k));values.forEach(v=>layer.writeMessage(4,(_,out)=>out.writeStringField(1,v),undefined));
    for(const f of features)layer.writeMessage(2,(_,out)=>{
      const tags=new PbfWriter();for(const [k,v] of Object.entries(f.properties)){tags.writeVarint(keys.indexOf(k));tags.writeVarint(values.indexOf(v));}
      out.writeBytesField(2,tags.finish());out.writeVarintField(3,2);
      const g=new PbfWriter();let x=0,y=0;
      f.points.forEach(([nx,ny],i)=>{g.writeVarint(i===0?9:10);g.writeSVarint(nx!-x);g.writeSVarint(ny!-y);x=nx!;y=ny!;});out.writeBytesField(4,g.finish());
    },undefined);
  },undefined);return writer.finish();
}
const project=(p:{longitude:number;latitude:number})=>({x:(p.longitude+180)/360*4096,y:(1-Math.asinh(Math.tan(p.latitude*Math.PI/180))/Math.PI)/2*4096,z:0});
it('keeps buffered roads in tile seam clearance checks',()=>{
  const bytes=tile([{properties:{class:'path',subclass:'footway'},points:[[4095,100],[4095,200]]},{properties:{class:'minor'},points:[[4098,100],[4098,200]]}]);
  expect(decodePedestrianTile(bytes,{z:0,x:0,y:0},project)).toHaveLength(0);
});
it('rejects aggregate grid work before admitting paths from an excessive tile',()=>{
  const blockers=Array.from({length:1000},()=>({properties:{class:'minor'},points:[[0,0],[2000,2000]]}));
  const bytes=tile([...blockers,{properties:{class:'path',subclass:'footway'},points:[[3500,100],[3500,200]]}]);
  expect(decodePedestrianTile(bytes,{z:0,x:0,y:0},project)).toHaveLength(0);
});
