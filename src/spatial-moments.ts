import type {Index} from './data'
import {momentTime,type Moment} from './moments'

/** Thirty-minute windows on five-minute boundaries; only observed endpoint evidence. */
export function airportMoments(tracks:Index['aircraft'],airports:Index['airports']):Moment[]{
 const places=new Map(airports.map(airport=>[airport.icao,airport]))
 const result:Moment[]=[]
 for(const side of ['destination','origin'] as const){
  const groups=new Map<string,Map<number,Set<string>>>()
  for(const track of tracks){
   const endpoint=track[side]
   if(!endpoint||!places.has(endpoint.icao)||!Number.isFinite(endpoint.time)||endpoint.time<0||endpoint.time>=86400)continue
   let windows=groups.get(endpoint.icao);if(!windows){windows=new Map();groups.set(endpoint.icao,windows)}
   const tick=Math.floor(endpoint.time/300)
   for(let start=Math.max(0,tick-5);start<=Math.min(282,tick);start++){
    let ids=windows.get(start);if(!ids){ids=new Set();windows.set(start,ids)}
    ids.add(track.icaoAddress??track.id)
   }
  }
  const candidates=[...groups].flatMap(([code,windows])=>[...windows].map(([tick,ids])=>({code,time:tick*300,count:ids.size})))
   .filter(window=>window.count>=3).sort((a,b)=>b.count-a.count||a.time-b.time||a.code.localeCompare(b.code))
  const best=candidates[0];if(!best)continue
  const airport=places.get(best.code)!,arriving=side==='destination',endTime=best.time+1800
  result.push({id:arriving?'arrival-wave':'departure-wave',airport:best.code,time:best.time,endTime,
   title:`${arriving?'Arrivals into':'Departures from'} ${airport.iata||airport.icao}`,
   caption:`${best.count.toLocaleString('en-GB')} distinct aircraft associated with ${airport.city||airport.name} between ${momentTime(best.time)} and ${momentTime(endTime)} UTC — the busiest observed half-hour ${arriving?'arrival':'departure'} window in this selection.`})
 }
 return result.sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id))
}
