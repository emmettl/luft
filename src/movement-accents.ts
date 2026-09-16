import {positionForAirTrack,type AirTrack} from '@motionstudies/core/domain/air'

export const ACCENT_SECONDS=1
export type MovementEvent={id:string;kind:'departure'|'arrival';time:number;longitude:number;latitude:number}
export type MovementAccent=MovementEvent&{started:number}
/** Only airport-linked observations with a valid local position become events.
 * Chunk boundaries and coverage gaps are not departures or arrivals. */
export function movementEvents(tracks:readonly AirTrack[]):MovementEvent[]{
 const events=new Map<string,MovementEvent>()
 for(const track of tracks)for(const [key,kind] of [['origin','departure'],['destination','arrival']] as const){
  const endpoint=track[key]
  if(endpoint?.evidence!=='observed-endpoint'||!Number.isFinite(endpoint.time))continue
  const position=positionForAirTrack(track,endpoint.time)
  if(!position)continue
  const id=`${track.icaoAddress??track.id}:${kind}:${endpoint.icao}:${endpoint.time}`
  events.set(id,{id,kind,time:endpoint.time,longitude:position.longitude,latitude:position.latitude})
 }
 return [...events.values()].sort((a,b)=>a.time-b.time)
}
/** Playback-clock lifetimes remain brief at every pace and freeze when paused.
 * The caller resets on explicit seeks, filter changes and density mode. */
export class MovementAccents {
 private readonly cache=new WeakMap<readonly AirTrack[],MovementEvent[]>()
 private previous?:number
 private active:MovementAccent[]=[]
 reset(){this.previous=undefined;this.active=[]}
 advance(tracks:readonly AirTrack[],time:number,clock:number):readonly MovementAccent[]{
  const previous=this.previous
  if(previous!==undefined&&(time<previous||time-previous>180))this.reset()
  this.active=this.active.filter(event=>clock-event.started<ACCENT_SECONDS)
  if(this.previous!==undefined&&time>this.previous){
   let events=this.cache.get(tracks)
   if(!events){events=movementEvents(tracks);this.cache.set(tracks,events)}
   const seen=new Set(this.active.map(event=>event.id))
   for(const event of events){
    if(event.time>time)break
    if(event.time>this.previous&&!seen.has(event.id)){this.active.push({...event,started:clock});seen.add(event.id)}
   }
  }
  this.previous=time
  return this.active
 }
}
