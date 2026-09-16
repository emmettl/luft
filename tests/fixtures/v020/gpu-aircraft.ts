import * as THREE from 'three'
import {updateDirtyGeometry} from '@motionstudies/three/render-performance'
import type {AircraftPainter} from './aircraft-painter'
const vertexBase=`
uniform vec2 viewport;
attribute vec3 colour;
attribute vec2 appearance;
varying vec3 ink;
varying float alpha;
vec4 screen(vec2 p){return vec4(p.x/viewport.x*2.-1.,1.-p.y/viewport.y*2.,0.,1.);}
`
const lineVertex=vertexBase+`
attribute vec2 corner;
attribute vec3 positionTo;
void main(){
 vec2 d=positionTo.xy-position.xy;
 vec2 normal=vec2(-d.y,d.x)/max(length(d),0.0001);
 gl_Position=screen(mix(position.xy,positionTo.xy,corner.x)+normal*corner.y*appearance.x*.5);
 ink=colour;alpha=appearance.y;
}`
const pointVertex=vertexBase+`
uniform float pixelRatio;
void main(){gl_Position=screen(position.xy);gl_PointSize=appearance.x*2.*pixelRatio;ink=colour;alpha=appearance.y;}`
const fragment=`varying vec3 ink;varying float alpha;void main(){gl_FragColor=vec4(ink,alpha);}`
const pointFragment=`varying vec3 ink;varying float alpha;void main(){float d=length(gl_PointCoord-.5);float edge=1.-smoothstep(.5-fwidth(d),.5,d);if(edge<=0.)discard;gl_FragColor=vec4(ink,alpha*edge);}`
class Batch {
 count=0;capacity=0
 geometry:THREE.BufferGeometry|THREE.InstancedBufferGeometry
 object:THREE.Mesh|THREE.Points
 constructor(readonly lines:boolean,material:THREE.ShaderMaterial,order:number){
  this.geometry=lines?new THREE.InstancedBufferGeometry():new THREE.BufferGeometry()
  this.object=lines?new THREE.Mesh(this.geometry,material):new THREE.Points(this.geometry,material)
  this.object.frustumCulled=false;this.object.renderOrder=order
  this.reserve(256)
 }
 reserve(size:number){
  if(size<=this.capacity)return
  this.capacity=2**Math.ceil(Math.log2(size))
  const next=this.lines?new THREE.InstancedBufferGeometry():new THREE.BufferGeometry()
  if(this.lines)next.setAttribute('corner',new THREE.BufferAttribute(new Float32Array([0,-1,1,-1,1,1,0,-1,1,1,0,1]),2))
  for(const [name,components] of [['position',3],['positionTo',3],['colour',3],['appearance',2]] as const){
   const array=new Float32Array(this.capacity*components),previous=this.geometry.getAttribute(name)
   if(previous)array.set(previous.array)
   const attribute=this.lines?new THREE.InstancedBufferAttribute(array,components):new THREE.BufferAttribute(array,components)
   attribute.setUsage(THREE.DynamicDrawUsage);next.setAttribute(name,attribute)
  }
  this.geometry.dispose();this.geometry=next;this.object.geometry=next
 }
 add(x:number,y:number,tx:number,ty:number,rgb:readonly number[],size:number,alpha:number){
  this.reserve(this.count+1);const i=this.count++,a=this.geometry.attributes
  ;(a.position as THREE.BufferAttribute).setXYZ(i,x,y,0)
  ;(a.positionTo as THREE.BufferAttribute).setXYZ(i,tx,ty,0)
  ;(a.colour as THREE.BufferAttribute).setXYZ(i,rgb[0],rgb[1],rgb[2])
  ;(a.appearance as THREE.BufferAttribute).setXY(i,size,alpha)
 }
 upload(){
  updateDirtyGeometry(this.geometry,0,this.count-1,this.lines?6:this.count)
  if(this.lines)(this.geometry as THREE.InstancedBufferGeometry).instanceCount=this.count
  for(const name of ['colour','appearance']){const a=this.geometry.getAttribute(name) as THREE.BufferAttribute;a.clearUpdateRanges();if(this.count){a.addUpdateRange(0,this.count*a.itemSize);a.needsUpdate=true}}
  this.object.visible=this.count>0
 }
 dispose(){this.geometry.dispose()}
}
export class GpuAircraftPainter implements AircraftPainter {
 private readonly canvas=document.createElement('canvas')
 private readonly renderer:THREE.WebGLRenderer
 private readonly scene=new THREE.Scene()
 private readonly camera=new THREE.Camera()
 private readonly uniforms={viewport:{value:new THREE.Vector2(1,1)},pixelRatio:{value:1}}
 private readonly lineMaterial:THREE.ShaderMaterial
 private readonly pointMaterial:THREE.ShaderMaterial
 private readonly batches:Batch[]=[]
 private currentLayer=0;private rgb:readonly number[]=[1,1,1];private opacity=1;private width=1;private radius=1
 private readonly colours=new Map<string,readonly number[]>()
 private size='';private disposed=false
 private readonly lost=(event:Event)=>{event.preventDefault();if(!this.disposed)this.onFailure('WebGL context lost; using Canvas.')}
 constructor(parent:HTMLElement,private readonly onFailure:(message:string)=>void){
  this.canvas.className='gpu-layer';this.canvas.setAttribute('aria-hidden','true')
  this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,alpha:true,antialias:true,powerPreference:'default'})
  this.renderer.debug.onShaderError=()=>{queueMicrotask(()=>{if(!this.disposed)this.onFailure('GPU shader unavailable; using Canvas.')})}
  this.renderer.setClearColor(0,0);this.renderer.setPixelRatio(1)
  const options={uniforms:this.uniforms,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}
  this.lineMaterial=new THREE.ShaderMaterial({...options,vertexShader:lineVertex,fragmentShader:fragment})
  this.pointMaterial=new THREE.ShaderMaterial({...options,vertexShader:pointVertex,fragmentShader:pointFragment})
  for(let layer=0;layer<3;layer++)for(const lines of [true,false]){
   const batch=new Batch(lines,lines?this.lineMaterial:this.pointMaterial,layer*2+(lines?0:1));this.batches.push(batch);this.scene.add(batch.object)
  }
  this.canvas.addEventListener('webglcontextlost',this.lost);parent.append(this.canvas)
 }
 begin(width:number,height:number,dpr:number){
  const size=`${width}:${height}:${dpr}`
  if(size!==this.size){this.renderer.setPixelRatio(dpr);this.renderer.setSize(width,height,false);this.uniforms.viewport.value.set(width,height);this.uniforms.pixelRatio.value=dpr;this.size=size}
  for(const batch of this.batches)batch.count=0
 }
 style(layer:number,colour:string,opacity:number,width:number,radius:number){
  this.currentLayer=layer;this.opacity=opacity;this.width=width;this.radius=radius
  let rgb=this.colours.get(colour);if(!rgb){const value=parseInt(colour.slice(1),16);rgb=[(value>>16&255)/255,(value>>8&255)/255,(value&255)/255];this.colours.set(colour,rgb)}this.rgb=rgb
 }
 segment(x1:number,y1:number,x2:number,y2:number){if(x1===x2&&y1===y2)return;this.batches[this.currentLayer*2].add(x1,y1,x2,y2,this.rgb,this.width,this.opacity)}
 point(x:number,y:number){this.batches[this.currentLayer*2+1].add(x,y,x,y,this.rgb,this.radius,this.opacity)}
 end(){for(const batch of this.batches)batch.upload();this.renderer.render(this.scene,this.camera)}
 clear(){this.renderer.clear()}
 stats(){const r=this.renderer.info.render;return {calls:r.calls,triangles:r.triangles,points:r.points}}
 dispose(){if(this.disposed)return;this.disposed=true;this.canvas.removeEventListener('webglcontextlost',this.lost);for(const batch of this.batches)batch.dispose();this.lineMaterial.dispose();this.pointMaterial.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.canvas.remove()}
}
