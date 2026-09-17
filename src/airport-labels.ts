import {mapLabelBudget,mapLabelRankLimit,selectMapLabels,type MapLabelBox} from '@motionstudies/core/map-labels'
import type {AirSearchTrack} from '@motionstudies/core/air-search'
import type {Airport} from './data'
export type AirportLabel={airport:Airport;text:string;selected:boolean;highlighted:boolean;box:MapLabelBox}
/** Rank by deduplicated observed endpoint associations in the pinned day, not traffic estimates. */
export function airportLabelRanks(airports:readonly Airport[],tracks:readonly AirSearchTrack[]){
 const counts=new Map<string,number>(),seen=new Set<string>()
 for(const track of tracks)for(const kind of ['origin','destination'] as const){
  const endpoint=track[kind];if(!endpoint)continue
  const key=`${track.icaoAddress??track.id}:${kind}:${endpoint.icao}:${endpoint.time}`
  if(seen.has(key))continue;seen.add(key);counts.set(endpoint.icao,(counts.get(endpoint.icao)??0)+1)
 }
 return new Map([...airports].sort((a,b)=>(counts.get(b.icao)??0)-(counts.get(a.icao)??0)||a.icao.localeCompare(b.icao)).map((a,i)=>[a.icao,i]))
}
export function layoutAirportLabels(airports:readonly Airport[],ranks:ReadonlyMap<string,number>,selected:ReadonlySet<string>,retained:ReadonlySet<string>,heightDegrees:number,width:number,height:number,project:(lon:number,lat:number)=>number[],obstacles:readonly MapLabelBox[],highlighted:ReadonlySet<string>=new Set()):AirportLabel[]{
 const semanticHeight=32*heightDegrees/38,rankLimit=mapLabelRankLimit(semanticHeight),budget=mapLabelBudget(semanticHeight)
 const candidates=airports.flatMap(airport=>{
  const chosen=selected.has(airport.icao),rank=ranks.get(airport.icao)??Infinity
  const inCountry=highlighted.has(airport.icao)
  if(!chosen&&!inCountry&&(!airport.hasObservedMovements||rank>=rankLimit))return []
  const [x,y]=project(airport.longitude,airport.latitude),city=airport.city.split(/[,(]/)[0].trim(),code=airport.iata||airport.icao
  // Allow 24px for marker, gap and padding, plus rounding slack for Safari font metrics.
  const text=chosen&&city?`${code} · ${city}`:code,labelWidth=Math.max(44,Math.min(210,Math.ceil(26+text.length*7)))
  return [{airport,text,selected:chosen,highlighted:inCountry,name:airport.icao,rank,priority:chosen?0:inCountry?1:3,retained:retained.has(airport.icao),distance:Math.hypot(x-width/2,y-height/2),box:{left:x-8,right:x-8+labelWidth,top:y-22,bottom:y+22}}]
 })
 return selectMapLabels(candidates,budget,{left:8,right:width-8,top:8,bottom:height-8},obstacles)
}
