type Point={x:number;y:number}
type Pointer={pointerId:number;clientX:number;clientY:number}

export class MapGesture {
 private readonly pointers=new Map<number,Point>()
 private origin:Point={x:0,y:0}
 private moved=false
 private distance=0
 private pinchDistance(){
  if(this.pointers.size!==2)return 0
  const [a,b]=[...this.pointers.values()]
  return Math.hypot(a.x-b.x,a.y-b.y)
 }
 down(event:Pointer){
  const point={x:event.clientX,y:event.clientY}
  if(!this.pointers.size){this.origin=point;this.moved=false}
  this.pointers.set(event.pointerId,point)
  if(this.pointers.size>1)this.moved=true
  this.distance=this.pinchDistance()
 }
 move(event:Pointer,map:{pan:(dx:number,dy:number)=>void;zoom:(factor:number)=>void}){
  const previous=this.pointers.get(event.pointerId)
  if(!previous)return
  const point={x:event.clientX,y:event.clientY}
  this.pointers.set(event.pointerId,point)
  if(this.pointers.size===1){
   if(Math.hypot(point.x-this.origin.x,point.y-this.origin.y)>2)this.moved=true
   // Use this finger's previous position, including after a pinch ends.
   map.pan(point.x-previous.x,point.y-previous.y)
  }else{
   const distance=this.pinchDistance()
   if(this.distance>0&&distance>0)map.zoom(this.distance/distance)
   this.distance=distance
  }
 }
 up(event:Pointer){
  if(!this.pointers.has(event.pointerId))return false
  const tap=this.pointers.size===1&&!this.moved&&Math.hypot(event.clientX-this.origin.x,event.clientY-this.origin.y)<=2
  this.pointers.delete(event.pointerId)
  this.distance=this.pinchDistance()
  return tap
 }
 cancel(event:Pointer){
  if(!this.pointers.delete(event.pointerId))return
  this.moved=true
  this.distance=this.pinchDistance()
 }
}
