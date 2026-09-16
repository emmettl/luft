import {AIR_CONTINENTS,type AirContinent} from '@motionstudies/core/air-continents'
import {usableEndpoint,type EndpointSide,type EndpointLabel,type createEndpointResolver} from '@motionstudies/core/air-enrichment'
import type {AirSearchTrack} from '@motionstudies/core/air-search'
export type EndpointFilter={side:EndpointSide;continent:AirContinent|'all'|'unresolved';airport:string;includeCandidates:boolean}
export const EMPTY_ENDPOINT_FILTER:EndpointFilter={side:'destination',continent:'all',airport:'',includeCandidates:false}
export const endpointFilterActive=(f:EndpointFilter)=>f.continent!=='all'||!!f.airport
export function matchesEndpointFilter(track:AirSearchTrack,f:EndpointFilter,resolve:ReturnType<typeof createEndpointResolver>){
 if(!endpointFilterActive(f))return true
 const label=resolve(track,f.side),usable=usableEndpoint(label,f.includeCandidates)
 if(f.continent==='unresolved')return (!usable||!label.airport?.continent)&&(!f.airport||label.airport?.icao===f.airport)
 return usable&&(!f.airport||label.airport?.icao===f.airport)&&(f.continent==='all'||label.airport?.continent===f.continent)
}
export const evidenceName=(status:EndpointLabel['status'])=>({observed:'Observed',corroborated:'Corroborated',candidate:'Candidate only',conflicting:'Conflicting',unknown:'Unknown'}[status])
export function endpointFilterTitle(f:EndpointFilter,airportName?:string){
 if(!endpointFilterActive(f))return ''
 const place=airportName||(f.continent==='unresolved'?'unresolved endpoints':f.continent==='all'?'all continents':AIR_CONTINENTS[f.continent])
 return `${f.side==='destination'?'To':'From'} ${place}${f.includeCandidates?' · candidates included':''}`
}
