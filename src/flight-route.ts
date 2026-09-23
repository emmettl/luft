import type {AirSample} from '@motionstudies/core/domain/air'
export type RoutePoint=[time:number,longitude:number,latitude:number,altitudeFeet?:number]
export type RouteSegments=RoutePoint[][]
export type FlightRoute={id:string;segments:RouteSegments}
export function routeBucket(id:string){let hash=2166136261;for(const char of id)hash=Math.imul(hash^char.charCodeAt(0),16777619);return (hash&255).toString(16).padStart(2,'0')}

/** Thin within continuous observations only; retain bends to roughly 1 km. */
function simplify(points:RoutePoint[]):RoutePoint[]{
 if(points.length<=2)return points
 const keep=new Set([0,points.length-1]),pending=[[0,points.length-1]]
 while(pending.length){
  const [first,last]=pending.pop()!,a=points[first],b=points[last],dx=(b[1]-a[1])*.62,dy=b[2]-a[2],length=dx*dx+dy*dy
  let farthest=-1,maximum=1
  for(let i=first+1;i<last;i++){
   const x=(points[i][1]-a[1])*.62,y=points[i][2]-a[2],t=length?Math.max(0,Math.min(1,(x*dx+y*dy)/length)):0,distance=(x-t*dx)**2+(y-t*dy)**2
   const timeRatio=(points[i][0]-a[0])/(b[0]-a[0]),altitudeError=Math.abs((points[i][3]??0)-((a[3]??0)+timeRatio*((b[3]??0)-(a[3]??0))))
   const error=Math.max(distance/.01**2,altitudeError/250)
   if(error>maximum){maximum=error;farthest=i}
  }
  if(farthest!==-1){keep.add(farthest);pending.push([first,farthest],[farthest,last])}
 }
 return [...keep].sort((a,b)=>a-b).map(i=>points[i])
}
/** Each chunk owns its time window, avoiding duplicated overlap/guard samples. */
export function appendRouteSamples(routes:Map<string,RouteSegments>,id:string,samples:readonly AirSample[],start:number,end:number){
 const segments:RouteSegments=[]
 for(const sample of samples){
  if(sample[0]<start||sample[0]>=end)continue
  const point:RoutePoint=[sample[0],sample[1],sample[2],sample[3]],segment=segments.at(-1),previous=segment?.at(-1)
  if(!previous||point[0]-previous[0]>45)segments.push([point]);else if(point[0]>previous[0])segment!.push(point)
 }
 if(!segments.length)return
 const route=routes.get(id)??[]
 for(const segment of segments){
  const points=simplify(segment),previous=route.at(-1)?.at(-1),first=points[0]
  if(previous&&first[0]>previous[0]&&first[0]-previous[0]<=45)route.at(-1)!.push(...points)
  else route.push(points)
 }
 routes.set(id,route)
}
