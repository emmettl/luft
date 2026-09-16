import { positionForAirTrack, type AirTrack } from '@motionstudies/core/domain/air'
import type { Airport, Land } from './data'
export type View={west:number;south:number;east:number;north:number}
export const EUROPE:View={west:-25,south:34,east:45,north:72}
export const BRITAIN:View={west:-12,south:47,east:16,north:62}
export function direction(track:Pick<AirTrack,'origin'|'destination'>,airport?:Airport) {
 if(!airport)return undefined
 return track.destination?.icao===airport.icao?'inbound':track.origin?.icao===airport.icao?'outbound':undefined
}
function after(samples:AirTrack['samples'],time:number) {let lo=0,hi=samples.length;while(lo<hi){const m=(lo+hi)>>>1;if(samples[m][0]<time)lo=m+1;else hi=m}return lo}
export class AirMap {
 view={...EUROPE}; width=1;height=1;scale=1;left=0;top=0;selectedFlight?:string
 points:{x:number;y:number;track:AirTrack}[]=[]
 durations:number[]=[]
 constructor(readonly canvas:HTMLCanvasElement,readonly land:Land,readonly airports:Airport[]){}
 fit(){const {width,height}=this.canvas.getBoundingClientRect();const dpr=Math.min(2,devicePixelRatio||1);if(this.width!==width||this.height!==height||this.canvas.width!==Math.round(width*dpr)){this.width=width;this.height=height;this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr)}this.scale=Math.min(width/((this.view.east-this.view.west)*.62),height/(this.view.north-this.view.south));this.left=(width-(this.view.east-this.view.west)*.62*this.scale)/2;this.top=(height-(this.view.north-this.view.south)*this.scale)/2;this.canvas.getContext('2d')!.setTransform(dpr,0,0,dpr,0,0)}
 project(lon:number,lat:number){return [this.left+(lon-this.view.west)*.62*this.scale,this.top+(this.view.north-lat)*this.scale]}
 zoom(factor:number){const cx=(this.view.west+this.view.east)/2,cy=(this.view.south+this.view.north)/2,w=Math.min(120,Math.max(2,(this.view.east-this.view.west)*factor)),h=w*(this.view.north-this.view.south)/(this.view.east-this.view.west);this.view={west:cx-w/2,east:cx+w/2,south:cy-h/2,north:cy+h/2}}
 pan(dx:number,dy:number){const x=dx/(.62*this.scale),y=dy/this.scale;this.view={west:this.view.west-x,east:this.view.east-x,south:this.view.south+y,north:this.view.north+y}}
 focus(airport:Airport){this.view={west:airport.longitude-8,east:airport.longitude+8,south:airport.latitude-5,north:airport.latitude+5}}
 draw(tracks:AirTrack[],time:number,airport:Airport|undefined,mode:string,cells:number[][]) {
  const started=performance.now();this.fit();const ctx=this.canvas.getContext('2d')!;const {width:w,height:h}=this;ctx.clearRect(0,0,w,h)
  ctx.fillStyle='#11202b';ctx.strokeStyle='#283640';ctx.lineWidth=.6
  ctx.beginPath()
  for(const f of this.land.features){const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates as number[][][]]:f.geometry.coordinates as number[][][][];for(const poly of polys) for(const ring of poly){ring.forEach(([lon,lat],i)=>{const [x,y]=this.project(lon,lat);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)});ctx.closePath()}}
  ctx.fill('evenodd');ctx.stroke();this.points=[]
  let inbound=0,outbound=0,total=0
  if(mode==='density') {
   const max=Math.max(1,...cells.map(c=>c[2]));for(const [lon,lat,n] of cells){const [x,y]=this.project(lon,lat+.5);ctx.fillStyle=`rgba(233,188,108,${.04+.83*Math.sqrt(n/max)})`;ctx.fillRect(x,y,Math.max(1,.5*.62*this.scale),Math.max(1,.5*this.scale))}
  } else {
   // Background first; airport-associated and selected movements remain legible.
   const layers:[AirTrack,ReturnType<typeof positionForAirTrack>,ReturnType<typeof direction>][]=[]
   for(const track of tracks){const p=positionForAirTrack(track,time);if(p){const d=direction(track,airport);layers.push([track,p,d]);total++;if(d==='inbound')inbound++;if(d==='outbound')outbound++}}
   layers.sort((a,b)=>Number(!!a[2])-Number(!!b[2])||Number(a[0].id===this.selectedFlight)-Number(b[0].id===this.selectedFlight))
   for(const [track,p,d] of layers) {
    if(!p)continue
    const selected=track.id===this.selectedFlight,colour=selected?'#ffffff':d==='inbound'?'#81d9f1':d==='outbound'?'#efbd72':p.altitudeFeet<10000?'#cfac76':'#86bac7'
    const [x,y]=this.project(p.longitude,p.latitude)
    ctx.globalAlpha=airport&&!d&&!selected?.14:1;ctx.strokeStyle=colour;ctx.lineWidth=selected?2:d?1.4:.65;ctx.beginPath()
    const start=after(track.samples,time-180),end=after(track.samples,time);let previous:number[]|undefined
    for(let i=start;i<end;i++){const sample=track.samples[i],q=this.project(sample[1],sample[2]);if(previous && sample[0]-track.samples[i-1][0]<=45)ctx.lineTo(q[0],q[1]);else ctx.moveTo(q[0],q[1]);previous=q}
    if(previous && end>0 && time-track.samples[end-1][0]<=45)ctx.lineTo(x,y)
    ctx.stroke();ctx.fillStyle=colour;ctx.beginPath();ctx.arc(x,y,selected?3.5:d?2.3:1.2,0,Math.PI*2);ctx.fill()
    if(x>=0&&x<=w&&y>=0&&y<=h)this.points.push({x,y,track})
   }
   ctx.globalAlpha=1
  }
  const labels=airport?[airport]:this.airports.filter(a=>['LHR','CDG','FRA','AMS','MAD','FCO','ZRH','IST'].includes(a.iata))
  ctx.font='10px ui-monospace, monospace'
  for(const a of labels){const [x,y]=this.project(a.longitude,a.latitude);if(x<15||x>w-30||y<15||y>h-10)continue;ctx.strokeStyle=airport?'#efe0bd':'#809096';ctx.lineWidth=.8;ctx.strokeRect(x-3,y-3,6,6);ctx.fillStyle=airport?'#eee0c4':'#91a1a9';ctx.fillText(airport?`${a.iata||a.icao} · ${a.city}`:a.iata,x+8,y+3)}
  this.durations.push(performance.now()-started);if(this.durations.length>300)this.durations.shift()
  return {total,inbound,outbound,visible:this.points.length}
 }
}
