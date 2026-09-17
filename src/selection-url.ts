import {AIRLINES} from './airlines'
import type {Index} from './data'
import {EMPTY_SELECTION,routeKey,type Selection} from './filters'
import {airportGeography} from './geography'

const groups=['airlines','airports','routes','countries','continents'] as const
export type SelectionOptions=Record<keyof Selection,ReadonlySet<string>>
export function selectionOptions(index:Index):SelectionOptions{
 const airports=new Set(index.airports.map(airport=>airport.icao)),routes=new Set<string>()
 const countries=new Set<string>(),continents=new Set<string>()
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
export function selectionHash(selection:Selection):string{
 const params=new URLSearchParams()
 for(const group of groups)if(selection[group].length)params.set(group,[...new Set(selection[group])].join(','))
 const hash=params.toString()
 return hash?`#${hash}`:''
}
