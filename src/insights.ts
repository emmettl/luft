import {AIRLINES,airlineForTrack} from './airlines'
import type {Index} from './data'
import {endpointRegions,matchesSelection,type Selection} from './filters'
import {airportGeography,countryLabel,continentLabel,type AirportGeography} from './geography'

export type InsightCategory='airlines'|'airports'|'countries'|'continents'
export type InsightRow={id:string;label:string;detail:string;count:number}
export function buildInsights(index:Index,selection:Selection,category:InsightCategory,geography:AirportGeography=airportGeography){
 // Facets honor other groups, leaving alternatives in the active group available.
 const context={...selection,[category]:[]},total=new Set<string>(),covered=new Set<string>()
 const counts=new Map<string,Set<string>>()
 const airports=new Map(index.airports.map(a=>[a.icao,a]))
 const endpointNames=new Map<string,{iata:string;name:string;city:string}>()
 for(const track of index.aircraft){
  if(!matchesSelection(track,context,geography))continue
  const identity=track.icaoAddress??track.id;total.add(identity)
  for(const endpoint of [track.origin,track.destination])if(endpoint)endpointNames.set(endpoint.icao,endpoint)
  const carrier=category==='airlines'?airlineForTrack(track):undefined
  const keys=category==='airlines'?(carrier?[carrier]:[]):category==='airports'?[track.origin?.icao,track.destination?.icao].filter((code):code is string=>!!code):endpointRegions(track,category==='countries'?'country':'continent',geography)
  if(keys.length)covered.add(identity)
  for(const key of new Set(keys)){
   let identities=counts.get(key);if(!identities){identities=new Set();counts.set(key,identities)}
   identities.add(identity)
  }
 }
 const rows:InsightRow[]=[...counts].map(([id,identities])=>{
  const airport=airports.get(id)??endpointNames.get(id),carrier=AIRLINES.find(a=>a.id===id)
  return {id,count:identities.size,label:category==='airlines'?carrier!.name:category==='airports'?airport?.iata||id:category==='countries'?countryLabel(id):continentLabel(id),detail:category==='airports'?airport?.city||airport?.name||id:''}
 }).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label))
 return {rows,total:total.size,covered:covered.size}
}
