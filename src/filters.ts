import {AIRLINES,airlineForTrack,type AirlineId} from './airlines'
import type {Index} from './data'
import {airportGeography,type AirportGeography} from './geography'

export type Selection={airports:string[];airlines:AirlineId[];routes:string[];countries:string[];continents:string[]}
export const EMPTY_SELECTION:Selection={airports:[],airlines:[],routes:[],countries:[],continents:[]}
type Track=Index['aircraft'][number]
export type SnapshotIndex={date:string;sourceManifestSha256:string;tracks:[string,number[]][]}
export const routeKey=(track:Pick<Track,'origin'|'destination'>)=>track.origin?.icao&&track.destination?.icao&&track.origin.icao!==track.destination.icao?[track.origin.icao,track.destination.icao].sort().join('|'):undefined
export function endpointRegions(track:Track,field:'country'|'continent',geography:AirportGeography=airportGeography){
 return [...new Set([track.origin,track.destination].flatMap(endpoint=>{
  const value=endpoint&&(field==='continent'?endpoint.continent??geography[endpoint.icao]?.continent:geography[endpoint.icao]?.country)
  return value?[value]:[]
 }))]
}
export function matchesSelection(track:Track,selection:Selection,geography:AirportGeography=airportGeography){
 return (!selection.airlines.length||selection.airlines.includes(airlineForTrack(track)!))&&
  (!selection.airports.length||selection.airports.some(code=>track.origin?.icao===code||track.destination?.icao===code))&&
  (!selection.routes.length||selection.routes.includes(routeKey(track)??''))&&
  (!selection.countries.length||endpointRegions(track,'country',geography).some(code=>selection.countries.includes(code)))&&
  (!selection.continents.length||endpointRegions(track,'continent',geography).some(code=>selection.continents.includes(code)))
}
export function selectionActivity(tracks:readonly Track[],snapshots:SnapshotIndex){
 const identities=new Map(tracks.map(track=>[track.id,track.icaoAddress??track.id]))
 const bins=Array.from({length:288},()=>new Set<string>()),cells=Array.from({length:24},()=>new Map<string,number>())
 for(const [id,points] of snapshots.tracks){
  const identity=identities.get(id);if(!identity)continue
  // Triples are five-minute tick, half-degree longitude, half-degree latitude.
  for(let i=0;i<points.length;i+=3){
   const tick=points[i];if(bins[tick].has(identity))continue
   bins[tick].add(identity)
   const grid=cells[Math.floor(tick/12)],key=`${points[i+1]},${points[i+2]}`
   grid.set(key,(grid.get(key)??0)+1)
  }
 }
 return {aircraft:new Set(identities.values()).size,bins:bins.map((ids,i)=>({time:i*300,count:ids.size})),cells:cells.map(grid=>[...grid].map(([key,count])=>[...key.split(',').map(n=>Number(n)/2),count]))}
}
export function observedRoutes(tracks:readonly Track[],airports:Index['airports']){
 const places=new Map(airports.map(airport=>[airport.icao,airport]))
 const routes=new Map<string,{id:string;label:string;detail:string;count:number;search:string}>()
 for(const track of tracks){
  const id=routeKey(track);if(!id)continue
  const existing=routes.get(id);if(existing){existing.count++;continue}
  const codes=id.split('|'),ends=codes.map(code=>places.get(code))
  const label=codes.map((code,i)=>ends[i]?.iata||code).join(' ↔ ')
  const detail=codes.map((code,i)=>ends[i]?.city||code).join(' · ')
  routes.set(id,{id,label,detail,count:1,search:[label,detail,...codes,...ends.map(a=>a?.name??'')].join(' ').toLowerCase()})
 }
 return [...routes.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label))
}
export const airlineLabel=(ids:readonly AirlineId[])=>ids.map(id=>AIRLINES.find(a=>a.id===id)!.name).join(' + ')
