// Test oracles read the pinned release, so daily traffic changes do not weaken assertions.
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {positionForAirTrack} from '@motionstudies/core/domain/air'
import {createEndpointResolver,readAirEnrichment,endpointCoverage} from '@motionstudies/core/air-enrichment'
import {EMPTY_SELECTION,matchesSelection,type Selection} from '../src/filters'
import {EMPTY_ENDPOINT_FILTER,matchesEndpointFilter,type EndpointFilter} from '../src/endpoint-filters'
import type {Index,Chunk} from '../src/data'
import lock from '../enrichment-release.json' with {type:'json'}
export const manifest=JSON.parse(readFileSync('public/data/manifest.json','utf8'))
export const index=JSON.parse(gunzipSync(readFileSync(`public/data/${manifest.index.path}`)).toString()) as Index
export const enrichment=readAirEnrichment(JSON.parse(gunzipSync(readFileSync(`public/${lock.path}`)).toString()),{date:lock.date,sourceManifestSha256:lock.sourceManifestSha256,tracks:index.aircraft})
export const resolveEndpoint=createEndpointResolver(enrichment)
export const selectedTracks=(selection:Partial<Selection>={},endpoint:Partial<EndpointFilter>={})=>index.aircraft.filter(t=>matchesSelection(t,{...EMPTY_SELECTION,...selection})&&matchesEndpointFilter(t,{...EMPTY_ENDPOINT_FILTER,...endpoint},resolveEndpoint))
export const aircraftCount=(selection:Partial<Selection>={},endpoint:Partial<EndpointFilter>={})=>new Set(selectedTracks(selection,endpoint).map(t=>t.icaoAddress??t.id)).size
export const aircraftText=(selection:Partial<Selection>={},endpoint:Partial<EndpointFilter>={})=>`${aircraftCount(selection,endpoint).toLocaleString('en-US')} aircraft`
export const coverage=(side:'origin'|'destination')=>endpointCoverage(index.aircraft,resolveEndpoint,side)
export function frameText(time=25200,selection:Partial<Selection>={}){
 const descriptor=manifest.chunks[Math.floor(time/600)]
 const chunk=JSON.parse(gunzipSync(readFileSync(`public/data/${descriptor.path}`)).toString()) as Chunk
 const selected=new Set(selectedTracks(selection).map(t=>t.id))
 return `${chunk.tracks.filter(t=>selected.has(t.id)&&positionForAirTrack(t,time)).length.toLocaleString('en-US')} aircraft`
}
