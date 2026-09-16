import { positionForAirTrack, type AirTrack, type AirPosition } from '@motionstudies/core/domain/air'
import { PausedVehicleFrame } from '@motionstudies/core/render-frame'
import type { Airport, Land } from './data'
import type {AircraftPainter} from './aircraft-painter'
import {trackDirection} from './retained-trails'
export const cityLabel=(airport:Airport)=>airport.city.split(/[,(]/)[0].trim()
export type View={west:number;south:number;east:number;north:number}
export const EUROPE:View={west:-25,south:34,east:45,north:72}
export const BRITAIN:View={west:-12,south:47,east:16,north:62}
export function direction(track:Pick<AirTrack,'origin'|'destination'>,airport?:Airport) {
 return trackDirection(track,airport?.icao)
}
function after(samples:AirTrack['samples'],time:number) {let lo=0,hi=samples.length;while(lo<hi){const m=(lo+hi)>>>1;if(samples[m][0]<time)lo=m+1;else hi=m}return lo}
type Aircraft=[AirTrack,AirPosition,ReturnType<typeof direction>]
type Extent={west:number;east:number;south:number;north:number}
export class AirMap {
 view={...EUROPE};width=1;height=1;scale=1;left=0;top=0;bottomClearance=160;topClearance=0;selectedFlight?:string
 points:{x:number;y:number;track:AirTrack}[]=[]
 durations:number[]=[]
 stages:{setup:number;sampling:number;geometry:number;submission:number}[]=[]
 resetMeasurements(){this.durations=[];this.stages=[]}
 renderedFrames=0
 private painter?:AircraftPainter
 private baseKey=''
 setPainter(painter?:AircraftPainter){this.painter?.dispose();this.painter=painter;this.revision++;this.baseKey='';this.resetMeasurements()}
 gpuStats(){return this.painter?.stats()}
 private readonly ctx:CanvasRenderingContext2D
 private readonly backdrop=document.createElement('canvas')
 private readonly observer:ResizeObserver
 private readonly frame=new PausedVehicleFrame()
 private readonly extents=new WeakMap<AirTrack,Extent>()
 private readonly defaultLabels:Airport[]
 private resizeDirty=true;private dpr=0;private revision=0
 private projection='';private inputs?:{tracks:AirTrack[];airport?:Airport|readonly Airport[];mode:string;cells:number[][];selected?:string}
 private counts={total:0,inbound:0,outbound:0,visible:0}
 constructor(readonly canvas:HTMLCanvasElement,readonly land:Land,readonly airports:Airport[],readonly studyBounds:View=EUROPE){
  this.view={...studyBounds}
  this.ctx=canvas.getContext('2d')!
  this.defaultLabels=airports.filter(a=>['LHR','CDG','FRA','AMS','MAD','FCO','ZRH','IST'].includes(a.iata))
  this.observer=new ResizeObserver(()=>{this.resizeDirty=true});this.observer.observe(canvas)
 }
 dispose(){this.painter?.dispose();this.observer.disconnect();this.backdrop.width=0;this.backdrop.height=0}
 private fit(){
  const dpr=Math.min(2,devicePixelRatio||1)
  if(this.resizeDirty||this.dpr!==dpr){
   const {width,height}=this.canvas.getBoundingClientRect();this.width=width;this.height=height;this.dpr=dpr;this.resizeDirty=false
   const style=getComputedStyle(this.canvas)
   this.bottomClearance=parseFloat(style.getPropertyValue('--luft-map-bottom'))||160
   this.topClearance=parseFloat(style.getPropertyValue('--luft-map-top'))||0
   this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr)
   this.ctx.setTransform(dpr,0,0,dpr,0,0);this.projection='';this.baseKey=''
  }
  const key=[this.width,this.height,this.view.west,this.view.south,this.view.east,this.view.north].join(':')
  if(key===this.projection)return
  const frameHeight=Math.max(1,this.height-this.topClearance-Math.min(this.height*.4,this.bottomClearance))
  this.scale=Math.min(this.width/((this.view.east-this.view.west)*.62),frameHeight/(this.view.north-this.view.south))
  this.left=(this.width-(this.view.east-this.view.west)*.62*this.scale)/2
  this.top=this.topClearance+(frameHeight-(this.view.north-this.view.south)*this.scale)/2
  this.projection=key;this.revision++;this.paintLand()
 }
 private paintLand(){
  this.backdrop.width=this.canvas.width;this.backdrop.height=this.canvas.height
  const ctx=this.backdrop.getContext('2d')!;ctx.setTransform(this.dpr,0,0,this.dpr,0,0)
  ctx.fillStyle='#11202b';ctx.strokeStyle='#283640';ctx.lineWidth=.6;ctx.beginPath()
  for(const f of this.land.features){const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates as number[][][]]:f.geometry.coordinates as number[][][][];for(const poly of polys)for(const ring of poly){ring.forEach(([lon,lat],i)=>{const [x,y]=this.project(lon,lat);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)});ctx.closePath()}}
  ctx.fill('evenodd');ctx.stroke()
  // Fade only the context outside the recorded area. Cache these masks with
  // the land so neither aircraft renderer adds compositing work per frame.
  const [left,top]=this.project(this.studyBounds.west,this.studyBounds.north)
  const [right,bottom]=this.project(this.studyBounds.east,this.studyBounds.south)
  const featherX=4*.62*this.scale,featherY=4*this.scale
  ctx.globalCompositeOperation='destination-in'
  for(const [x0,y0,x1,y1,fraction] of [
   [left-featherX,0,right+featherX,0,featherX/(right-left+2*featherX)],
   [0,top-featherY,0,bottom+featherY,featherY/(bottom-top+2*featherY)],
  ]){
   const fade=ctx.createLinearGradient(x0,y0,x1,y1)
   fade.addColorStop(0,'transparent');fade.addColorStop(fraction,'#fff')
   fade.addColorStop(1-fraction,'#fff');fade.addColorStop(1,'transparent')
   ctx.fillStyle=fade;ctx.fillRect(0,0,this.width,this.height)
  }
  ctx.globalCompositeOperation='source-over'
 }
 project(lon:number,lat:number){return [this.left+(lon-this.view.west)*.62*this.scale,this.top+(this.view.north-lat)*this.scale]}
 zoom(factor:number){
  if(!Number.isFinite(factor)||factor<=0)return
  const bounds=this.studyBounds,aspect=(this.view.east-this.view.west)/(this.view.north-this.view.south)
  const w=Math.min(bounds.east-bounds.west,(bounds.north-bounds.south)*aspect,Math.max(2,(this.view.east-this.view.west)*factor)),h=w/aspect
  const cx=Math.max(bounds.west+w/2,Math.min(bounds.east-w/2,(this.view.west+this.view.east)/2))
  const cy=Math.max(bounds.south+h/2,Math.min(bounds.north-h/2,(this.view.south+this.view.north)/2))
  this.view={west:cx-w/2,east:cx+w/2,south:cy-h/2,north:cy+h/2}
 }
 pan(dx:number,dy:number){const x=dx/(.62*this.scale),y=dy/this.scale;this.view={west:this.view.west-x,east:this.view.east-x,south:this.view.south+y,north:this.view.north+y}}
 focus(airport:Airport){this.view={west:airport.longitude-8,east:airport.longitude+8,south:airport.latitude-5,north:airport.latitude+5}}
 private outside(track:AirTrack,p:AirPosition){
  let extent=this.extents.get(track)
  if(!extent){extent={west:Infinity,east:-Infinity,south:Infinity,north:-Infinity};for(const s of track.samples){extent.west=Math.min(extent.west,s[1]);extent.east=Math.max(extent.east,s[1]);extent.south=Math.min(extent.south,s[2]);extent.north=Math.max(extent.north,s[2])}this.extents.set(track,extent)}
  // Include every observed sample and the interpolated head. Culling only the
  // head would lose visible trails crossing the edge. Four pixels cover strokes.
  return this.left+(Math.max(extent.east,p.longitude)-this.view.west)*.62*this.scale < -4 ||
   this.left+(Math.min(extent.west,p.longitude)-this.view.west)*.62*this.scale > this.width+4 ||
   this.top+(this.view.north-Math.min(extent.south,p.latitude))*this.scale < -4 ||
   this.top+(this.view.north-Math.max(extent.north,p.latitude))*this.scale > this.height+4
 }
 draw(tracks:AirTrack[],time:number,airport:Airport|readonly Airport[]|undefined,mode:string,cells:number[][]) {
  const started=performance.now();this.fit()
  const selectedAirports:readonly Airport[]=airport?(Array.isArray(airport)?airport:[airport as Airport]):[],codes=selectedAirports.map(a=>a.icao),hasAirports=codes.length>0
  const previous=this.inputs
  if(!previous||previous.tracks!==tracks||previous.airport!==airport||previous.mode!==mode||previous.cells!==cells||previous.selected!==this.selectedFlight){
   this.revision++;this.inputs={tracks,airport,mode,cells,selected:this.selectedFlight}
  }
  const frameTime=mode==='density'?0:time
  if(!this.frame.needsUpdate(false,frameTime,this.revision))return this.counts
  const ctx=this.ctx,{width:w,height:h}=this,painter=this.painter
  const baseKey=`${this.projection}:${codes.join('|')}:${mode}`,repaintBase=!painter||mode==='density'||baseKey!==this.baseKey
  if(repaintBase){ctx.clearRect(0,0,w,h);ctx.drawImage(this.backdrop,0,0,w,h);this.baseKey=baseKey}
  this.points=[]
  if(painter){if(mode==='density')painter.clear();else painter.begin(w,h,this.dpr,{xScale:.62*this.scale,yScale:-this.scale,xOffset:this.left-this.view.west*.62*this.scale,yOffset:this.top+this.view.north*this.scale},time)}
  const setup=performance.now()-started;let sampling=0,geometry=0,submission=0
  let inbound=0,outbound=0,total=0
  if(mode==='density'){
   let max=1;for(const c of cells)max=Math.max(max,c[2])
   for(const [lon,lat,n] of cells){const [x,y]=this.project(lon,lat+.5),cw=Math.max(1,.5*.62*this.scale),ch=Math.max(1,.5*this.scale);if(x+cw<0||x>w||y+ch<0||y>h)continue;ctx.fillStyle=`rgba(233,188,108,${.04+.83*Math.sqrt(n/max)})`;ctx.fillRect(x,y,cw,ch)}
  }else if(painter){
   const preparationStarted=performance.now();painter.prepare(tracks,codes,this.selectedFlight);geometry=performance.now()-preparationStarted
   const samplingStarted=performance.now()
   for(let i=0;i<tracks.length;i++){
    const track=tracks[i],p=positionForAirTrack(track,time),visible=!!p&&!this.outside(track,p)
    painter.aircraft(i,p,visible)
    if(!p)continue
    const d=trackDirection(track,codes);total++;if(d==='inbound')inbound++;if(d==='outbound')outbound++
    if(visible){const x=this.left+(p.longitude-this.view.west)*.62*this.scale,y=this.top+(this.view.north-p.latitude)*this.scale;if(x>=0&&x<=w&&y>=0&&y<=h)this.points.push({x,y,track})}
   }
   sampling=performance.now()-samplingStarted;const submissionStarted=performance.now();painter.end();submission=performance.now()-submissionStarted
  }else{
   const samplingStarted=performance.now()
   const layers:Aircraft[][]=[[],[],[]]
   for(const track of tracks){const p=positionForAirTrack(track,time);if(!p)continue;const d=trackDirection(track,codes);total++;if(d==='inbound')inbound++;if(d==='outbound')outbound++
    if(!this.outside(track,p))layers[track.id===this.selectedFlight?2:d?1:0].push([track,p,d])
   }
   sampling=performance.now()-samplingStarted;const geometryStarted=performance.now()
   for(const layer of layers)for(const [track,p,d] of layer){
    const selected=track.id===this.selectedFlight,colour=selected?'#ffffff':d==='inbound'?'#81d9f1':d==='outbound'?'#efbd72':p.altitudeFeet<10000?'#cfac76':'#86bac7'
    const x=this.left+(p.longitude-this.view.west)*.62*this.scale,y=this.top+(this.view.north-p.latitude)*this.scale
    const opacity=hasAirports&&!d&&!selected?.14:1,width=selected?2:d?1.4:.65,radius=selected?3.5:d?2.3:1.2
    ctx.globalAlpha=opacity;ctx.strokeStyle=colour;ctx.lineWidth=width;ctx.beginPath()
    const start=after(track.samples,time-180),end=after(track.samples,time)
    for(let i=start;i<end;i++){const sample=track.samples[i],sx=this.left+(sample[1]-this.view.west)*.62*this.scale,sy=this.top+(this.view.north-sample[2])*this.scale
     if(i>start&&sample[0]-track.samples[i-1][0]<=45){ctx.lineTo(sx,sy)}else ctx.moveTo(sx,sy)
    }
    if(end>start&&time-track.samples[end-1][0]<=45){ctx.lineTo(x,y)}
    ctx.stroke();ctx.fillStyle=colour;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill()
    if(x>=0&&x<=w&&y>=0&&y<=h)this.points.push({x,y,track})
   }
   ctx.globalAlpha=1
   geometry=performance.now()-geometryStarted
  }
  ctx.font='10px ui-monospace, monospace'
  for(const a of repaintBase?(hasAirports?selectedAirports:this.defaultLabels):[]){const [x,y]=this.project(a.longitude,a.latitude);if(x<15||x>w-30||y<15||y>h-10)continue;ctx.strokeStyle=hasAirports?'#efe0bd':'#809096';ctx.lineWidth=.8;ctx.strokeRect(x-3,y-3,6,6);ctx.fillStyle=hasAirports?'#eee0c4':'#91a1a9';ctx.fillText(hasAirports?`${a.iata||a.icao} · ${cityLabel(a)}`:a.iata,x+8,y+3)}
  this.renderedFrames++;this.durations.push(performance.now()-started);if(this.durations.length>300)this.durations.shift()
  this.stages.push({setup,sampling,geometry,submission});if(this.stages.length>300)this.stages.shift()
  this.frame.record(frameTime,this.revision)
  return this.counts={total,inbound,outbound,visible:this.points.length}
 }
}
