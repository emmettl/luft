import {AIRLINES} from './airlines'
import type {Index} from './data'
import {EMPTY_SELECTION,routeKey,type Selection} from './filters'
import {airportGeography,CONTINENTS} from './geography'
import {EMPTY_ENDPOINT_FILTER,type EndpointFilter} from './endpoint-filters'

const groups=['airlines','airports','routes','countries','continents'] as const
export type SelectionOptions=Record<keyof Selection,ReadonlySet<string>>&{endpointAirports?:ReadonlySet<string>}
export function selectionOptions(index:Index,countryCodes:readonly string[]=[]):SelectionOptions{
 const airports=new Set(index.airports.map(airport=>airport.icao)),routes=new Set<string>()
 const countries=new Set(countryCodes),continents=new Set<string>()
 for(const place of Object.values(airportGeography)){
  if(place.country)countries.add(place.country)
  if(place.continent)continents.add(place.continent)
 }
 for(const track of index.aircraft){
  const route=routeKey(track);if(route)routes.add(route)
  for(const endpoint of [track.origin,track.destination])if(endpoint){
   airports.add(endpoint.icao)
   if(endpoint.continent)continents.add(endpoint.continent)
  }
 }
 return {airlines:new Set(AIRLINES.map(airline=>airline.id)),airports,routes,countries,continents}
}
export function selectionFromHash(hash:string,options:SelectionOptions):Selection{
 const params=new URLSearchParams(hash.replace(/^#/,''))
 const result={...EMPTY_SELECTION}
 for(const group of groups){
  const values=params.getAll(group).flatMap(value=>value.split(',')).map(value=>{
   const id=value.trim()
   if(group==='airlines')return id.toLowerCase()
   if(group==='routes')return id.toUpperCase().split('|').sort().join('|')
   return id.toUpperCase()
  })
  // Validate before rendering labels or matching tracks; stale links remain usable.
  Object.assign(result,{[group]:[...new Set(values.filter(value=>options[group].has(value)))]})
 }
 return result
}
export function endpointFromHash(hash:string,options:SelectionOptions):EndpointFilter{
 const params=new URLSearchParams(hash.replace(/^#/,'')),continent=params.get('endpoint-continent')??'all',airport=params.get('endpoint-airport')?.toUpperCase()??''
 return {side:params.get('endpoint-side')==='origin'?'origin':'destination',continent:continent==='unresolved'||Object.hasOwn(CONTINENTS,continent)?continent as EndpointFilter['continent']:'all',airport:options.endpointAirports?.has(airport)?airport:'',includeCandidates:params.get('candidates')==='true'}
}
export function selectionHash(selection:Selection,endpoint:EndpointFilter=EMPTY_ENDPOINT_FILTER):string{
 const params=new URLSearchParams()
 for(const group of groups)if(selection[group].length)params.set(group,[...new Set(selection[group])].join(','))
 if(endpoint.side!=='destination')params.set('endpoint-side',endpoint.side)
 if(endpoint.continent!=='all')params.set('endpoint-continent',endpoint.continent)
 if(endpoint.airport)params.set('endpoint-airport',endpoint.airport)
 if(endpoint.includeCandidates)params.set('candidates','true')
 const hash=params.toString()
 return hash?`#${hash}`:''
}
