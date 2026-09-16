import type {AirTrack} from '@motionstudies/core/domain/air'

export type TrailBucket={from:Float32Array;to:Float32Array;aircraft:Float32Array;start:number;end:number}
export type TrailLayer={buckets:TrailBucket[];heads:Float32Array}
export function trackDirection(track:Pick<AirTrack,'origin'|'destination'>,airport?:string){
 return airport?(track.destination?.icao===airport?'inbound':track.origin?.icao===airport?'outbound':undefined):undefined
}
/** Immutable sample geometry for one chunk/filter/selection. Minute buckets let
 * the renderer skip whole blocks outside the trailing window without uploading.
 * Shaders apply exact sample boundaries within the remaining blocks. Heads and
 * partial segments use the shared CPU sampler's exact Hermite position.
 */
export function buildTrailLayers(tracks:AirTrack[],airport?:string,selected?:string):TrailLayer[]{
 const groups=[0,1,2].map(()=>({buckets:new Map<number,{from:number[];to:number[];aircraft:number[]}>(),heads:[] as number[]}))
 tracks.forEach((track,index)=>{
  const direction=trackDirection(track,airport),layer=track.id===selected?2:direction?1:0,code=direction==='inbound'?1:direction==='outbound'?2:0,g=groups[layer]
  g.heads.push(index,code,0)
  for(let i=1;i<track.samples.length;i++){
   const a=track.samples[i-1],b=track.samples[i]
   if(b[0]-a[0]>45||b[0]<a[0])continue
   const minute=Math.floor(a[0]/60);let bucket=g.buckets.get(minute)
   if(!bucket){bucket={from:[],to:[],aircraft:[]};g.buckets.set(minute,bucket)}
   bucket.from.push(a[1],a[2],a[0]);bucket.to.push(b[1],b[2],b[0]);bucket.aircraft.push(index,code)
  }
 })
 return groups.map(g=>({heads:new Float32Array(g.heads),buckets:[...g.buckets].sort(([a],[b])=>a-b).map(([minute,b])=>({from:new Float32Array(b.from),to:new Float32Array(b.to),aircraft:new Float32Array(b.aircraft),start:minute*60,end:(minute+1)*60}))}))
}
