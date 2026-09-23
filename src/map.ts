import {holdingConfidence,type HoldingIndex} from './holding'
import { positionForAirTrack, type AirTrack, type AirPosition } from '@motionstudies/core/domain/air'
import { PausedVehicleFrame } from '@motionstudies/core/render-frame'
import type { Airport, Land } from './data'
import type {AircraftPainter} from './aircraft-painter'
import {trackDirection} from './retained-trails'
import {ACCENT_SECONDS,MovementAccents} from './movement-accents'
import {VisibilityFades} from './visibility-fades'
import {layoutAirportLabels,type AirportLabel} from './airport-labels'
import type {MapLabelBox} from '@motionstudies/core/map-labels'
import {DaylightLayer} from './daylight'
import {countryAirportIds,type Country} from './countries'
import type {FlightRoute} from './flight-route'
export const cityLabel=(airport:Airport)=>airport.city.split(/[,(]/)[0].trim()
export type View={west:number;south:number;east:number;north:number}
export const EUROPE:View={west:-25,south:34,east:45,north:72}
export const BRITAIN:View={west:-12,south:47,east:16,north:62}
export function direction(track:Pick<AirTrack,'origin'|'destination'>,airport?:Airport) {
 return trackDirection(track,airport?.icao)
}
function after(samples:AirTrack['samples'],time:number) {let lo=0,hi=samples.length;while(lo<hi){const m=(lo+hi)>>>1;if(samples[m][0]<time)lo=m+1;else hi=m}return lo}
type Aircraft=[AirTrack,AirPosition,ReturnType<typeof direction>,number]
type Extent={west:number;east:number;south:number;north:number}
export class AirMap {
 view={...EUROPE};width=1;height=1;scale=1;left=0;top=0;bottomClearance=160;topClearance=0;selectedFlight?:string
 points:{x:number;y:number;track:AirTrack}[]=[]
 durations:number[]=[]
 stages:{setup:number;sampling:number;geometry:number;submission:number}[]=[]
 resetMeasurements(){this.durations=[];this.stages=[]}
 renderedFrames=0
 private watching=false
 setWatchMode(enabled:boolean){
  if(enabled===this.watching)return
  this.watching=enabled;this.resizeDirty=true;this.baseKey='';this.labelKey='';this.revision++
  this.resetAccents();this.painter?.setWatchMode?.(enabled)
 }
 private painter?:AircraftPainter
 private baseKey=''
 private comparison?:ReadonlyMap<string,number>
 setComparison(comparison?:ReadonlyMap<string,number>){if(comparison!==this.comparison){this.comparison=comparison;this.revision++}}
 snapshot(){
  const result=document.createElement('canvas');result.width=this.canvas.width;result.height=this.canvas.height
  const ctx=result.getContext('2d')!;ctx.drawImage(this.canvas,0,0)
  if(this.inputs?.mode==='motion'){const aircraft=this.painter?.snapshot?.();if(aircraft)ctx.drawImage(aircraft,0,0);if(this.accentCanvas)ctx.drawImage(this.accentCanvas,0,0)}
  ctx.scale(this.dpr,this.dpr);ctx.font='10px monospace';ctx.fillStyle='#d5e0e5'
  for(const label of this.airportLabels)ctx.fillText(label.text,label.box.left,label.box.bottom-3)
  return result
 }
 private flightRoute?:FlightRoute
 private followScreenY?:number
 setFollowScreenY(y?:number){this.followScreenY=y}
 followedFlight?:string
 followFlight(id?:string){this.followedFlight=id;this.camera=undefined}
 private advanceFollow(tracks:AirTrack[],time:number,mode:string){
  if(!this.followedFlight)return
  if(mode!=='motion'||this.followedFlight!==this.selectedFlight){this.followFlight();return}
  const track=tracks.find(track=>track.id===this.followedFlight),position=track&&positionForAirTrack(track,time)
  if(!position)return // Hold the last camera position through an observation gap.
  const {longitude:x,latitude:y}=position,w=12,h=8
  const frameHeight=Math.max(1,this.height-this.topClearance-Math.min(this.height*.4,this.bottomClearance))
  const scale=Math.min(this.width/(w*.62),frameHeight/h)
  const centreY=this.topClearance+frameHeight/2,offset=this.followScreenY===undefined?0:(this.followScreenY-centreY)/scale
  const target={west:x-w/2,east:x+w/2,south:y+offset-h/2,north:y+offset+h/2}
  for(const key of ['west','east','south','north'] as const){
   const delta=target[key]-this.view[key]
   this.view[key]=!this.accentsEnabled||Math.abs(delta)<.0001?target[key]:this.view[key]+delta*.14
  }
 }
 setFlightRoute(route?:FlightRoute){this.flightRoute=route;this.baseKey='';this.revision++}
 frameFlightRoute(){
  if(!this.flightRoute||this.flightRoute.id!==this.selectedFlight)return
  const points=this.flightRoute.segments.flat()
  if(!points.length)return
  let west=Infinity,east=-Infinity,south=Infinity,north=-Infinity
  for(const [,x,y] of points){west=Math.min(west,x);east=Math.max(east,x);south=Math.min(south,y);north=Math.max(north,y)}
  const frameBottom=this.height-Math.min(this.height*.4,this.bottomClearance),frameHeight=frameBottom-this.topClearance
  const wideControls=this.labelObstacles.filter(box=>box.top<this.height*.45&&box.right-box.left>this.width*.55)
  const top=Math.max(this.topClearance,...wideControls.map(box=>box.bottom))+12,bottom=frameBottom-12
  const scale=Math.min(Math.max(44,this.width-48)/(.62*Math.max(4,east-west+2)),Math.max(60,bottom-top)/Math.max(3,north-south+2))
  const viewWidth=this.width/(.62*scale),viewHeight=frameHeight/scale,centre=(north+south)/2
  const viewNorth=centre+((top+bottom)/2-this.topClearance)/scale
  this.transitionTo({west:(west+east-viewWidth)/2,east:(west+east+viewWidth)/2,south:viewNorth-viewHeight,north:viewNorth})
 }
 private paintFlightRoute(){
  if(!this.flightRoute||this.flightRoute.id!==this.selectedFlight)return
  const ctx=this.ctx;ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath()
  for(const segment of this.flightRoute.segments)segment.forEach(([,lon,lat],i)=>{const [x,y]=this.project(lon,lat);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)})
  ctx.strokeStyle='#e6cfa51a';ctx.lineWidth=5;ctx.stroke()
  ctx.strokeStyle='#e6cfa59e';ctx.lineWidth=1.15;ctx.stroke()
  // Small open rings mark the first and last actual observations, not inferred airports.
  const first=this.flightRoute.segments[0]?.[0],last=this.flightRoute.segments.at(-1)?.at(-1)
  ctx.strokeStyle='#efd9b3b3';ctx.lineWidth=1
  for(const point of [first,last])if(point){const [x,y]=this.project(point[1],point[2]);ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.stroke()}
  ctx.restore()
 }
 setPainter(painter?:AircraftPainter){this.painter?.dispose();this.painter=painter;painter?.setWatchMode?.(this.watching);this.revision++;this.baseKey='';this.resetMeasurements()}
 gpuStats(){return this.painter?.stats()}
 private readonly ctx:CanvasRenderingContext2D
 private readonly backdrop=document.createElement('canvas')
 private readonly observer:ResizeObserver
 private readonly frame=new PausedVehicleFrame()
 private readonly extents=new WeakMap<AirTrack,Extent>()
 airportLabels:AirportLabel[]=[]
 private labelKey=''
 private labelObstacles:readonly MapLabelBox[]=[]
 private obstacleKey=''
 private countries:readonly Country[]=[]
 private selectedCountries:readonly string[]=[]
 private countryAirportCodes:ReadonlySet<string>=new Set()
 private countryAirports:readonly Airport[]=[]
 private geographyDirty=false
 setCountries(countries:readonly Country[],selected:readonly string[]=[]){
  if(countries===this.countries&&selected.join('|')===this.selectedCountries.join('|'))return
  this.countries=countries;this.selectedCountries=[...selected]
  this.countryAirportCodes=countryAirportIds(countries,selected)
  this.countryAirports=this.airports.filter(a=>this.countryAirportCodes.has(a.icao))
  this.geographyDirty=true;this.labelKey='';this.baseKey='';this.revision++
 }
 setLabelObstacles(boxes:readonly MapLabelBox[]){const key=JSON.stringify(boxes);if(key!==this.obstacleKey){this.obstacleKey=key;this.labelObstacles=boxes;this.revision++}}
 private updateAirportLabels(codes:readonly string[]){
  const key=`${this.projection}:${codes.join('|')}:${this.obstacleKey}`;if(key===this.labelKey)return;this.labelKey=key
  this.airportLabels=layoutAirportLabels(this.airports,this.labelOptions?.ranks??new Map(this.airports.map((a,i)=>[a.icao,i])),new Set(codes),new Set(this.airportLabels.map(label=>label.airport.icao)),this.view.north-this.view.south,this.width,this.height,(lon,lat)=>this.project(lon,lat),this.labelObstacles,this.countryAirportCodes)
  this.labelOptions?.onChange(this.airportLabels)
 }
 private resizeDirty=true;private dpr=0;private revision=0
 private projection='';private inputs?:{tracks:AirTrack[];airport?:Airport|readonly Airport[];mode:string;cells:number[][];selected?:string;matchingIds?:ReadonlySet<string>}
 private holdingTracks:HoldingIndex['tracks']={}
 setHoldingEvidence(tracks:HoldingIndex['tracks']){this.holdingTracks=tracks;this.revision++}
 private accentTracks:AirTrack[]=[]
 private counts={total:0,inbound:0,outbound:0,visible:0}
 private readonly movements=new MovementAccents()
 private readonly fades=new VisibilityFades()
 private readonly accentContext?:CanvasRenderingContext2D
 private accentsPainted=false
 private accentsEnabled=true
 private daylight?:DaylightLayer
 private daylightEnabled=true
 private camera?:{from:View;to:View;started:number}
 setDaylightEnabled(enabled:boolean){if(this.daylightEnabled!==enabled){this.daylightEnabled=enabled;this.baseKey='';this.revision++}}
 setMotionEffectsEnabled(enabled:boolean){if(enabled!==this.accentsEnabled){this.accentsEnabled=enabled;if(!enabled&&this.camera){this.view=this.camera.to;this.camera=undefined}this.resetMotionEffects()}}
 transitionTo(to:View){
  this.followedFlight=undefined
  if(!this.accentsEnabled){this.view={...to};this.camera=undefined;return}
  this.camera={from:{...this.view},to:{...to},started:performance.now()}
 }
 private advanceCamera(now:number){
  if(!this.camera)return
  const {from,to,started}=this.camera,t=Math.min(1,(now-started)/700),ease=t*t*(3-2*t)
  for(const key of ['west','south','east','north'] as const)this.view[key]=from[key]+(to[key]-from[key])*ease
  if(t===1)this.camera=undefined
 }
 resetMotionEffects(){this.fades.reset();this.resetAccents();this.revision++}
 resetAccents(){this.movements.reset();if(this.accentsPainted)this.accentContext?.clearRect(0,0,this.width,this.height);this.accentsPainted=false}
 constructor(readonly canvas:HTMLCanvasElement,readonly land:Land,readonly airports:Airport[],readonly studyBounds:View=EUROPE,private readonly accentCanvas?:HTMLCanvasElement,date?:string,private readonly labelOptions?:{ranks:ReadonlyMap<string,number>;onChange:(labels:AirportLabel[])=>void}){
  if(date)this.daylight=new DaylightLayer(date)
  this.accentContext=accentCanvas?.getContext('2d')??undefined
  this.view={...studyBounds}
  this.ctx=canvas.getContext('2d')!
  this.observer=new ResizeObserver(()=>{this.resizeDirty=true});this.observer.observe(canvas)
 }
 dispose(){this.resetMotionEffects();this.daylight?.dispose();this.painter?.dispose();this.observer.disconnect();this.backdrop.width=0;this.backdrop.height=0}
 private fit(){
  const dpr=Math.min(2,devicePixelRatio||1)
  if(this.resizeDirty||this.dpr!==dpr){
   const {width,height}=this.canvas.getBoundingClientRect();this.width=width;this.height=height;this.dpr=dpr;this.resizeDirty=false
   const style=getComputedStyle(this.canvas)
   this.bottomClearance=this.watching?0:parseFloat(style.getPropertyValue('--luft-map-bottom'))||160
   this.topClearance=this.watching?0:parseFloat(style.getPropertyValue('--luft-map-top'))||0
   this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr)
   this.ctx.setTransform(dpr,0,0,dpr,0,0);this.projection='';this.baseKey=''
   if(this.accentCanvas){this.accentCanvas.width=this.canvas.width;this.accentCanvas.height=this.canvas.height;this.accentContext?.setTransform(dpr,0,0,dpr,0,0)}
  }
  const key=[this.width,this.height,this.view.west,this.view.south,this.view.east,this.view.north].join(':')
  if(key===this.projection){if(this.geographyDirty)this.paintLand();return}
  const frameHeight=Math.max(1,this.height-this.topClearance-Math.min(this.height*.4,this.bottomClearance))
  this.scale=Math.min(this.width/((this.view.east-this.view.west)*.62),frameHeight/(this.view.north-this.view.south))
  this.left=(this.width-(this.view.east-this.view.west)*.62*this.scale)/2
  this.top=this.topClearance+(frameHeight-(this.view.north-this.view.south)*this.scale)/2
  this.projection=key;this.revision++;this.paintLand()
 }
 private paintLand(){
  this.geographyDirty=false
  this.backdrop.width=this.canvas.width;this.backdrop.height=this.canvas.height
  const ctx=this.backdrop.getContext('2d')!;ctx.setTransform(this.dpr,0,0,this.dpr,0,0)
  ctx.fillStyle=this.watching?'#0c1822':'#11202b';ctx.strokeStyle=this.watching?'#20303a':'#283640';ctx.lineWidth=.6;ctx.beginPath()
  for(const f of this.land.features){const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates as number[][][]]:f.geometry.coordinates as number[][][][];for(const poly of polys)for(const ring of poly){ring.forEach(([lon,lat],i)=>{const [x,y]=this.project(lon,lat);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)});ctx.closePath()}}
  ctx.fill('evenodd');ctx.stroke()
  const countryPath=(country:Country)=>{for(const polygon of country.polygons)for(const ring of polygon){ring.forEach(([lon,lat],i)=>{const [x,y]=this.project(lon,lat);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)});ctx.closePath()}}
  // Paint the selected fill and all boundaries into the retained geographic base.
  for(const country of this.countries)if(this.selectedCountries.includes(country.code)){
   ctx.beginPath();countryPath(country);ctx.fillStyle=this.watching?'#ddc49105':'#ddc49112';ctx.fill('evenodd')
  }
  if(this.countries.length){
   ctx.beginPath();for(const country of this.countries)countryPath(country)
   if(this.watching){
    // Bloom is baked into the geographic backdrop, never blurred per aircraft/frame.
    ctx.save();ctx.lineJoin='round';ctx.strokeStyle='#419bfa18';ctx.lineWidth=3;ctx.stroke()
    ctx.shadowColor='#358ff080';ctx.shadowBlur=5*this.dpr
    ctx.strokeStyle='#71baff70';ctx.lineWidth=.85;ctx.stroke();ctx.restore()
   }else{ctx.strokeStyle='#8db4d04d';ctx.lineWidth=.75;ctx.stroke()}
  }
  for(const country of this.countries)if(this.selectedCountries.includes(country.code)){
   ctx.beginPath();countryPath(country);ctx.strokeStyle=this.watching?'#dfc99822':'#dfc99855';ctx.lineWidth=.8;ctx.stroke()
  }
  // Every referenced airport gets a marker, even where its text label cannot fit.
  for(const airport of this.watching?[]:this.countryAirports){
   const [x,y]=this.project(airport.longitude,airport.latitude)
   if(x<0||x>this.width||y<0||y>this.height)continue
   ctx.strokeStyle='#ead2a6a6';ctx.lineWidth=.8;ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.stroke()
   ctx.fillStyle='#f0d9af';ctx.beginPath();ctx.arc(x,y,1.3,0,Math.PI*2);ctx.fill()
  }
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
  this.followFlight()
  if(!Number.isFinite(factor)||factor<=0)return
  this.camera=undefined
  const bounds=this.studyBounds,aspect=(this.view.east-this.view.west)/(this.view.north-this.view.south)
  const w=Math.min(bounds.east-bounds.west,(bounds.north-bounds.south)*aspect,Math.max(2,(this.view.east-this.view.west)*factor)),h=w/aspect
  const cx=Math.max(bounds.west+w/2,Math.min(bounds.east-w/2,(this.view.west+this.view.east)/2))
  const cy=Math.max(bounds.south+h/2,Math.min(bounds.north-h/2,(this.view.south+this.view.north)/2))
  this.view={west:cx-w/2,east:cx+w/2,south:cy-h/2,north:cy+h/2}
 }
 pan(dx:number,dy:number){this.followFlight();const x=dx/(.62*this.scale),y=dy/this.scale;this.view={west:this.view.west-x,east:this.view.east-x,south:this.view.south+y,north:this.view.north+y}}
 focus(airport:Airport){this.transitionTo({west:airport.longitude-8,east:airport.longitude+8,south:airport.latitude-5,north:airport.latitude+5})}
 frameAirports(airports:readonly Airport[]){
  if(!airports.length){this.transitionTo(this.studyBounds);return}
  const west=Math.min(...airports.map(a=>a.longitude))-8,east=Math.max(...airports.map(a=>a.longitude))+8
  const south=Math.min(...airports.map(a=>a.latitude))-5,north=Math.max(...airports.map(a=>a.latitude))+5
  this.transitionTo({west:Math.max(this.studyBounds.west,west),east:Math.min(this.studyBounds.east,east),south:Math.max(this.studyBounds.south,south),north:Math.min(this.studyBounds.north,north)})
 }
 frameCountries(codes:readonly string[]){
  const selected=this.countries.filter(c=>codes.includes(c.code)),points=selected.flatMap(c=>c.polygons.flatMap(p=>p[0]))
  if(!points.length){this.transitionTo(this.studyBounds);return}
  const bounds=this.studyBounds
  let west=bounds.east,east=bounds.west,south=bounds.north,north=bounds.south
  for(const [x,y] of points){west=Math.min(west,x);east=Math.max(east,x);south=Math.min(south,y);north=Math.max(north,y)}
  west=Math.max(bounds.west,west);east=Math.min(bounds.east,east);south=Math.max(bounds.south,south);north=Math.min(bounds.north,north)
  if(west>=east||south>=north){this.transitionTo(bounds);return}
  const padX=Math.max(2,(east-west)*.12),padY=Math.max(1.5,(north-south)*.12)
  this.transitionTo({west:Math.max(bounds.west,west-padX),east:Math.min(bounds.east,east+padX),south:Math.max(bounds.south,south-padY),north:Math.min(bounds.north,north+padY)})
 }
 private paintAccents(tracks:AirTrack[],time:number,clock:number){
  const ctx=this.accentContext;if(!ctx)return
  const accents=this.movements.advance(tracks,time,clock)
  if(!accents.length&&!this.accentsPainted)return
  ctx.clearRect(0,0,this.width,this.height);this.accentsPainted=accents.length>0
  for(const event of accents){
   const [x,y]=this.project(event.longitude,event.latitude)
   if(x<-14||x>this.width+14||y<-14||y>this.height+14)continue
   const progress=Math.max(0,Math.min(1,(clock-event.started)/ACCENT_SECONDS))
   const radius=event.kind==='departure'?2+6*progress:8-6*progress
   ctx.globalAlpha=.55*Math.sin(Math.PI*progress)
   ctx.strokeStyle=event.kind==='departure'?'#efbd72':'#81d9f1';ctx.lineWidth=1.2
   ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.stroke()
  }
  ctx.globalAlpha=1
 }
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
 draw(tracks:AirTrack[],time:number,airport:Airport|readonly Airport[]|undefined,mode:string,cells:number[][],accentClock=0,matchingIds?:ReadonlySet<string>) {
  const started=performance.now();this.advanceCamera(started);this.advanceFollow(tracks,time,mode);this.fit()
  const selectedAirports:readonly Airport[]=airport?(Array.isArray(airport)?airport:[airport as Airport]):[],explicitCodes=selectedAirports.map(a=>a.icao),codes=[...new Set([...explicitCodes,...this.countryAirportCodes])],hasAirports=codes.length>0
  if(!this.watching)this.updateAirportLabels(explicitCodes)
  const previous=this.inputs
  if(!previous||previous.tracks!==tracks||previous.airport!==airport||previous.mode!==mode||previous.cells!==cells||previous.selected!==this.selectedFlight||previous.matchingIds!==matchingIds){
   this.revision++;this.inputs={tracks,airport,mode,cells,selected:this.selectedFlight,matchingIds}
   this.accentTracks=matchingIds?tracks.filter(track=>matchingIds.has(track.id)):tracks
  }
  if(previous&&(previous.mode!==mode||previous.matchingIds!==matchingIds))this.fades.reset()
  const frameTime=mode==='density'?0:time
  if(!this.frame.needsUpdate(false,frameTime,this.revision))return this.counts
  const ctx=this.ctx,{width:w,height:h}=this,painter=this.painter
  if(mode==='motion'&&this.accentsEnabled)this.fades.begin(time)
  const daylightTime=mode==='density'?Math.floor(time/3600)*3600+1800:time
  const baseKey=`${this.projection}:${codes.join('|')}:${mode}:${this.daylightEnabled?Math.floor(daylightTime/60):'off'}:${this.selectedFlight??''}:${this.flightRoute?.id??''}`,repaintBase=!painter||mode==='density'||baseKey!==this.baseKey
  if(repaintBase){ctx.clearRect(0,0,w,h);ctx.drawImage(this.backdrop,0,0,w,h);if(this.daylightEnabled)this.daylight?.draw(ctx,w,h,{west:this.view.west,north:this.view.north,left:this.left,top:this.top,scale:this.scale},daylightTime);if(mode==='motion'&&!this.watching)this.paintFlightRoute();this.baseKey=baseKey}
  this.points=[]
  if(painter){if(mode==='density')painter.clear();else painter.begin(w,h,this.dpr,{xScale:.62*this.scale,yScale:-this.scale,xOffset:this.left-this.view.west*.62*this.scale,yOffset:this.top+this.view.north*this.scale},time)}
  const setup=performance.now()-started;let sampling=0,geometry=0,submission=0
  let inbound=0,outbound=0,total=0
  if(mode==='density'){
   let max=1;for(const c of cells)max=Math.max(max,c[2])
   for(const [lon,lat,n] of cells){const [x,y]=this.project(lon,lat+.5),cw=Math.max(1,.5*.62*this.scale),ch=Math.max(1,.5*this.scale);if(x+cw<0||x>w||y+ch<0||y>h)continue;ctx.fillStyle=`rgba(233,188,108,${.04+.83*Math.sqrt(n/max)})`;ctx.fillRect(x,y,cw,ch)}
  }else if(painter){
   const preparationStarted=performance.now();painter.prepare(tracks,codes,this.selectedFlight,matchingIds,this.comparison);geometry=performance.now()-preparationStarted
   const samplingStarted=performance.now()
   for(let i=0;i<tracks.length;i++){
    const track=tracks[i],p=positionForAirTrack(track,time),visible=!!p&&!this.outside(track,p)
    const fade=this.accentsEnabled?this.fades.opacity(track,time,accentClock,!!p):1
    const eligible=this.watching&&track.id!==this.selectedFlight&&(!matchingIds||matchingIds.has(track.id))&&(!hasAirports||!!trackDirection(track,codes))
    painter.aircraft(i,p,visible,fade,eligible?holdingConfidence(this.holdingTracks[track.id],time):0)
    if(!p||(matchingIds&&!matchingIds.has(track.id)))continue
    const d=trackDirection(track,codes);total++;if(d==='inbound')inbound++;if(d==='outbound')outbound++
    if(visible){const x=this.left+(p.longitude-this.view.west)*.62*this.scale,y=this.top+(this.view.north-p.latitude)*this.scale;if(x>=0&&x<=w&&y>=0&&y<=h)this.points.push({x,y,track})}
   }
   sampling=performance.now()-samplingStarted;const submissionStarted=performance.now();painter.end();submission=performance.now()-submissionStarted
  }else{
   const samplingStarted=performance.now()
   const layers:Aircraft[][]=[[],[],[],[]]
   for(const track of tracks){const p=positionForAirTrack(track,time),fade=this.accentsEnabled?this.fades.opacity(track,time,accentClock,!!p):1;if(!p)continue;const dimmed=!!matchingIds&&!matchingIds.has(track.id),d=dimmed?undefined:trackDirection(track,codes);if(!dimmed){total++;if(d==='inbound')inbound++;if(d==='outbound')outbound++}
    if(!this.outside(track,p))layers[dimmed?0:track.id===this.selectedFlight?3:d?2:1].push([track,p,d,fade])
   }
   sampling=performance.now()-samplingStarted;const geometryStarted=performance.now()
   for(const layer of layers)for(const [track,p,d,fade] of layer){
    const dimmed=!!matchingIds&&!matchingIds.has(track.id),selected=!dimmed&&track.id===this.selectedFlight,hold=this.watching&&!dimmed&&!selected&&(!hasAirports||d)?holdingConfidence(this.holdingTracks[track.id],time):0,group=this.comparison?.get(track.id),baseColour=selected?'#ffffff':group===1?'#81d9f1':group===2?'#efbd72':d==='inbound'?'#81d9f1':d==='outbound'?'#efbd72':p.altitudeFeet<10000?'#cfac76':'#86bac7'
    const colour=hold?`#${[1,3,5].map(i=>Math.round(parseInt(baseColour.slice(i,i+2),16)*(1-hold*.45)+255*hold*.45).toString(16).padStart(2,'0')).join('')}`:baseColour
    const x=this.left+(p.longitude-this.view.west)*.62*this.scale,y=this.top+(this.view.north-p.latitude)*this.scale
    const opacity=dimmed||(!this.comparison&&hasAirports&&!d&&!selected)?.14:1,width=selected?2:d?1.4:this.watching?.8:.65,radius=selected?3.5:d?2.3:1.2
    ctx.globalAlpha=opacity*fade;ctx.strokeStyle=colour;ctx.lineWidth=width*(1+hold*.6);ctx.beginPath()
    const start=after(track.samples,time-180),end=after(track.samples,time)
    if(end>start){
     const tail=track.samples[start],tx=this.left+(tail[1]-this.view.west)*.62*this.scale,ty=this.top+(this.view.north-tail[2])*this.scale
     if(Math.hypot(x-tx,y-ty)>1){const trail=ctx.createLinearGradient(tx,ty,x,y);trail.addColorStop(0,`${colour}${Math.round(18+hold*51).toString(16).padStart(2,'0')}`);trail.addColorStop(.45,`${colour}${Math.round(112+hold*25).toString(16).padStart(2,'0')}`);trail.addColorStop(1,`${colour}e0`);ctx.strokeStyle=trail}
    }
    for(let i=start;i<end;i++){const sample=track.samples[i],sx=this.left+(sample[1]-this.view.west)*.62*this.scale,sy=this.top+(this.view.north-sample[2])*this.scale
     if(i>start&&sample[0]-track.samples[i-1][0]<=45){ctx.lineTo(sx,sy)}else ctx.moveTo(sx,sy)
    }
    if(end>start&&time-track.samples[end-1][0]<=45){ctx.lineTo(x,y)}
    ctx.stroke();ctx.fillStyle=colour
    if(this.watching&&!selected&&!dimmed){for(const [size,alpha] of [[4.5,.045],[2.8,.1]] as const){ctx.globalAlpha=opacity*fade*alpha;ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=opacity*fade}
    if(selected){for(const [size,alpha] of [[11,.05],[7,.12]] as const){ctx.globalAlpha=opacity*fade*alpha;ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=opacity*fade}
    ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill()
    ctx.fillStyle='#f0faff';ctx.globalAlpha=opacity*fade*.6;ctx.beginPath();ctx.arc(x,y,radius*.45,0,Math.PI*2);ctx.fill()
    if(!dimmed&&x>=0&&x<=w&&y>=0&&y<=h)this.points.push({x,y,track})
   }
   ctx.globalAlpha=1
   geometry=performance.now()-geometryStarted
  }
  if(mode==='motion'&&this.accentsEnabled)this.fades.end()
  if(mode==='motion'&&this.accentsEnabled&&!this.watching)this.paintAccents(this.accentTracks,time,accentClock)
  else this.resetAccents()
  this.renderedFrames++;this.durations.push(performance.now()-started);if(this.durations.length>300)this.durations.shift()
  this.stages.push({setup,sampling,geometry,submission});if(this.stages.length>300)this.stages.shift()
  this.frame.record(frameTime,this.revision)
  return this.counts={total,inbound,outbound,visible:this.points.length}
 }
}
