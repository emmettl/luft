import type {AirTrack} from '@motionstudies/core/domain/air'
export const VISIBILITY_FADE_SECONDS=.6
/** Presentation only: the caller's shared sampler remains the authority on position validity. */
export class VisibilityFades {
 private readonly breaks=new WeakMap<AirTrack,number[]>()
 private readonly active=new Map<string,{time:number;started:number;frame:number}>()
 private previous?:number
 private frame=0
 private prime=true
 begin(time:number){
  if(this.previous!==undefined&&(time<this.previous||time-this.previous>180))this.reset()
  this.prime=this.previous===undefined;this.previous=time;this.frame++
 }
 opacity(track:AirTrack,time:number,clock:number,present:boolean){
  if(!present){this.active.delete(track.id);return 0}
  let breaks=this.breaks.get(track)
  if(!breaks){breaks=[];for(let i=1;i<track.samples.length;i++)if(track.samples[i][0]-track.samples[i-1][0]>45)breaks.push(track.samples[i][0]);this.breaks.set(track,breaks)}
  let lo=0,hi=breaks.length;while(lo<hi){const mid=(lo+hi)>>>1;if(breaks[mid]<=time)lo=mid+1;else hi=mid}
  let state=this.active.get(track.id)
  // A fast frame can skip an entire gap. Chunk starts are deliberately not breaks.
  if(!state||state.frame<this.frame-1||(lo>0&&breaks[lo-1]>state.time)){
   state={time,started:this.prime?-Infinity:clock,frame:this.frame};this.active.set(track.id,state)
  }
  state.time=time;state.frame=this.frame
  const t=Math.max(0,Math.min(1,(clock-state.started)/VISIBILITY_FADE_SECONDS))
  return t*t*(3-2*t)
 }
 end(){for(const [id,state] of this.active)if(state.frame!==this.frame)this.active.delete(id)}
 reset(){this.previous=undefined;this.active.clear();this.prime=true}
}
