import * as THREE from 'three'
import type {AirTrack,AirPosition} from '@motionstudies/core/domain/air'
import type {AircraftPainter,AircraftProjection} from './aircraft-painter'
import {buildTrailLayers} from './retained-trails'
const vertexBase=`
uniform vec2 viewport;
uniform vec4 projection;
uniform sampler2D aircraftState;
uniform vec2 stateSize;
uniform float studyTime;
uniform float emphasis;
uniform float airportSelected;
varying vec3 ink;
varying float alpha;
vec4 state(float index){return texture2D(aircraftState,(vec2(mod(index,stateSize.x),floor(index/stateSize.x))+.5)/stateSize);}
vec2 project(vec2 p){return p*projection.xy+projection.zw;}
vec4 screen(vec2 p){return vec4(p.x/viewport.x*2.-1.,1.-p.y/viewport.y*2.,0.,1.);}
void style(vec4 head,float direction){
 ink=emphasis>1.5?vec3(1.):direction>.5&&direction<1.5?vec3(129.,217.,241.)/255.:direction>1.5?vec3(239.,189.,114.)/255.:head.w<10000.?vec3(207.,172.,118.)/255.:vec3(134.,186.,199.)/255.;
 alpha=emphasis<-.5||(airportSelected>.5&&emphasis<.5)?.14:1.;
 alpha*=head.z;
}
`
const lineVertex=vertexBase+`
attribute vec3 sampleFrom;
attribute vec3 positionTo;
attribute vec2 aircraft;
void main(){
 vec4 head=state(aircraft.x);style(head,aircraft.y);
 // Canvas starts at the first sample inside the trailing window; it does not
 // interpolate the tail boundary. A sample at studyTime belongs to the head.
 bool visible=head.z>0.&&sampleFrom.z>=studyTime-180.&&sampleFrom.z<studyTime;
 vec2 from=project(sampleFrom.xy),to=project(positionTo.z<studyTime?positionTo.xy:head.xy);
 vec2 d=to-from,normal=vec2(-d.y,d.x)/max(length(d),.0001);
 float width=emphasis>1.5?2.:emphasis>.5?1.4:.65;
 float age=clamp((mix(sampleFrom.z,min(positionTo.z,studyTime),position.x)-(studyTime-180.))/180.,0.,1.);
 alpha*=mix(.07,.88,age*age);
 width*=mix(.55,1.,age);
 gl_Position=visible?screen(mix(from,to,position.x)+normal*position.y*width*.5):vec4(2.,2.,0.,1.);
}`
const pointVertex=vertexBase+`
uniform float pixelRatio;
void main(){
 vec4 head=state(position.x);style(head,position.y);
 ink=mix(ink,vec3(.94,.98,1.),.22);
 gl_Position=head.z>0.?screen(project(head.xy)):vec4(2.,2.,0.,1.);
 gl_PointSize=(emphasis>1.5?11.:emphasis>.5?2.3:1.2)*2.*pixelRatio;
}`
const fragment=`varying vec3 ink;varying float alpha;void main(){gl_FragColor=vec4(ink,alpha);}`
const pointFragment=`uniform float emphasis;varying vec3 ink;varying float alpha;void main(){float d=length(gl_PointCoord-.5);float radius=emphasis>1.5?.159:.5;float core=1.-smoothstep(radius-fwidth(d),radius,d);float glow=emphasis>1.5?.18*pow(max(0.,1.-d*2.),2.):0.;float edge=max(core,glow);if(edge<=0.)discard;gl_FragColor=vec4(ink,alpha*edge);}`
export class GpuAircraftPainter implements AircraftPainter {
 private readonly canvas=document.createElement('canvas')
 private readonly renderer:THREE.WebGLRenderer
 private readonly scene=new THREE.Scene()
 private readonly camera=new THREE.Camera()
 private state=new Float32Array(4)
 private texture=new THREE.DataTexture(this.state,1,1,THREE.RGBAFormat,THREE.FloatType)
 private readonly uniforms={viewport:{value:new THREE.Vector2(1,1)},projection:{value:new THREE.Vector4()},pixelRatio:{value:1},aircraftState:{value:this.texture},stateSize:{value:new THREE.Vector2(1,1)},studyTime:{value:0},airportSelected:{value:0}}
 private readonly objects:(THREE.Mesh|THREE.Points)[]=[]
 private readonly materials:THREE.ShaderMaterial[]=[]
 private readonly trailBuckets:{object:THREE.Mesh;start:number;end:number}[]=[]
 private tracks?:AirTrack[];private airport?:string;private selected?:string;private matchingIds?:ReadonlySet<string>
 private builds=0;private geometryBytes=0;private geometryPreparedBytes=0;private stateUploadBytes=0
 private size='';private disposed=false
 private readonly lost=(event:Event)=>{event.preventDefault();if(!this.disposed)this.onFailure('WebGL context lost; using Canvas.')}
 constructor(parent:HTMLElement,private readonly onFailure:(message:string)=>void){
  this.canvas.className='gpu-layer';this.canvas.setAttribute('aria-hidden','true')
  this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,alpha:true,antialias:true,powerPreference:'default'})
  this.renderer.debug.onShaderError=()=>{queueMicrotask(()=>{if(!this.disposed)this.onFailure('GPU shader unavailable; using Canvas.')})}
  this.renderer.setClearColor(0,0);this.renderer.setPixelRatio(1)
  for(let layer=0;layer<4;layer++)for(const lines of [true,false]){
   const material=new THREE.ShaderMaterial({uniforms:{...this.uniforms,emphasis:{value:layer-1}},transparent:true,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide,vertexShader:lines?lineVertex:pointVertex,fragmentShader:lines?fragment:pointFragment})
   this.materials.push(material)
  }
  this.canvas.addEventListener('webglcontextlost',this.lost);parent.append(this.canvas)
 }
 begin(width:number,height:number,dpr:number,projection:AircraftProjection,time:number){
  const size=`${width}:${height}:${dpr}`
  if(size!==this.size){this.renderer.setPixelRatio(dpr);this.renderer.setSize(width,height,false);this.uniforms.viewport.value.set(width,height);this.uniforms.pixelRatio.value=dpr;this.size=size}
  this.uniforms.projection.value.set(projection.xScale,projection.yScale,projection.xOffset,projection.yOffset)
  this.uniforms.studyTime.value=time;this.geometryPreparedBytes=0;this.updateBucketVisibility()
 }
 prepare(tracks:AirTrack[],airport?:string|readonly string[],selected?:string,matchingIds?:ReadonlySet<string>){
  const airportKey=typeof airport==='string'?airport:airport?.join('|')
  if(tracks===this.tracks&&airportKey===this.airport&&selected===this.selected&&matchingIds===this.matchingIds)return
  this.tracks=tracks;this.airport=airportKey;this.selected=selected;this.matchingIds=matchingIds;this.builds++
  this.uniforms.airportSelected.value=airportKey?1:0
  const width=Math.min(1024,this.renderer.capabilities.maxTextureSize,Math.max(1,tracks.length)),height=Math.max(1,Math.ceil(tracks.length/width))
  if(height>this.renderer.capabilities.maxTextureSize)throw Error('Aircraft texture exceeds device capacity')
  this.texture.dispose();this.state=new Float32Array(width*height*4)
  this.texture=new THREE.DataTexture(this.state,width,height,THREE.RGBAFormat,THREE.FloatType)
  this.uniforms.aircraftState.value=this.texture;this.uniforms.stateSize.value.set(width,height)
  const layers=buildTrailLayers(tracks,airport,selected,matchingIds);this.geometryBytes=0
  for(const object of this.objects){object.geometry.dispose();this.scene.remove(object)}
  this.objects.length=0;this.trailBuckets.length=0
  const add=(object:THREE.Mesh|THREE.Points,order:number)=>{
   object.frustumCulled=false;object.renderOrder=order;object.matrixAutoUpdate=false
   this.scene.add(object);this.objects.push(object)
   for(const attribute of Object.values(object.geometry.attributes))this.geometryBytes+=attribute.array.byteLength
  }
  layers.forEach((layer,i)=>{
   for(const bucket of layer.buckets){
    const lines=new THREE.InstancedBufferGeometry()
    lines.setAttribute('position',new THREE.BufferAttribute(new Float32Array([0,-1,0,1,-1,0,1,1,0,0,-1,0,1,1,0,0,1,0]),3))
    lines.setAttribute('sampleFrom',new THREE.InstancedBufferAttribute(bucket.from,3))
    lines.setAttribute('positionTo',new THREE.InstancedBufferAttribute(bucket.to,3))
    lines.setAttribute('aircraft',new THREE.InstancedBufferAttribute(bucket.aircraft,2))
    lines.instanceCount=bucket.from.length/3;lines.setDrawRange(0,6)
    const object=new THREE.Mesh(lines,this.materials[i*2]);add(object,i*2)
    this.trailBuckets.push({object,start:bucket.start,end:bucket.end})
   }
   if(layer.heads.length){
    const points=new THREE.BufferGeometry();points.setAttribute('position',new THREE.BufferAttribute(layer.heads,3))
    add(new THREE.Points(points,this.materials[i*2+1]),i*2+1)
   }
  })
  this.updateBucketVisibility()
  this.geometryPreparedBytes=this.geometryBytes
 }
 private updateBucketVisibility(){const time=this.uniforms.studyTime.value;for(const bucket of this.trailBuckets)bucket.object.visible=bucket.start<time&&bucket.end>time-180}
 aircraft(index:number,position:AirPosition|undefined,visible:boolean,opacity=1){
  const i=index*4;this.state[i+2]=position&&visible?opacity:0
  if(position&&visible){this.state[i]=position.longitude;this.state[i+1]=position.latitude;this.state[i+3]=position.altitudeFeet}
 }
 end(){this.stateUploadBytes=this.state.byteLength;this.texture.needsUpdate=true;this.renderer.render(this.scene,this.camera)}
 clear(){this.renderer.clear();this.renderer.info.reset();this.geometryPreparedBytes=0;this.stateUploadBytes=0}
 stats(){const r=this.renderer.info.render;return {calls:r.calls,triangles:r.triangles,points:r.points,geometryBuilds:this.builds,geometryBytes:this.geometryBytes,geometryPreparedBytes:this.geometryPreparedBytes,stateUploadBytes:this.stateUploadBytes}}
 dispose(){if(this.disposed)return;this.disposed=true;this.canvas.removeEventListener('webglcontextlost',this.lost);for(const object of this.objects)object.geometry.dispose();for(const material of this.materials)material.dispose();this.texture.dispose();this.tracks=undefined;this.renderer.dispose();this.renderer.forceContextLoss();this.canvas.remove()}
}
