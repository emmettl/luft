import lock from '../data-release.json'
import {routeBucket,type FlightRoute,type RouteSegments} from './flight-route'
const urls=import.meta.glob('./generated/flight-routes/*.json',{eager:true,query:'?url',import:'default'}) as Record<string,string>
export async function loadFlightRoute(id:string,signal:AbortSignal):Promise<FlightRoute>{
 const url=urls[`./generated/flight-routes/${routeBucket(id)}.json`]
 if(!url)throw Error('Route unavailable')
 const response=await fetch(url,{signal});if(!response.ok)throw Error('Route unavailable')
 const data=await response.json() as {sourceManifestSha256:string;routes:Record<string,RouteSegments>}
 if(data.sourceManifestSha256!==lock.manifestSha256||!data.routes[id])throw Error('Route belongs to another recorded day')
 return {id,segments:data.routes[id]}
}
