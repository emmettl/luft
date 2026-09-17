import {expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createEndpointResolver,readAirEnrichment,endpointCoverage} from '@motionstudies/core/air-enrichment'
import {EMPTY_ENDPOINT_FILTER,matchesEndpointFilter} from '../src/endpoint-filters'
import type {Index} from '../src/data'
import lock from '../enrichment-release.json'
const manifest=JSON.parse(readFileSync(new URL('../public/data/manifest.json',import.meta.url),'utf8'))
const index=JSON.parse(gunzipSync(readFileSync(new URL(`../public/data/${manifest.index.path}`,import.meta.url))).toString()) as Index
const enrichment=readAirEnrichment(JSON.parse(gunzipSync(readFileSync(new URL(`../public/${lock.path}`,import.meta.url))).toString()),{date:lock.date,sourceManifestSha256:lock.sourceManifestSha256,tracks:index.aircraft})
const resolve=createEndpointResolver(enrichment)
it('binds the exported evidence to all canonical segments and preserves observed endpoints',()=>{
 const before=JSON.stringify(index.aircraft)
 expect(endpointCoverage(index.aircraft,resolve,'destination')).toMatchObject({segments:40945,observed:22000,corroborated:8,candidate:7238,conflicting:11,unknown:11688,usable:22008,unresolved:18937})
 expect(endpointCoverage(index.aircraft,resolve,'origin')).toMatchObject({observed:22499,corroborated:9,usable:22508})
 expect(JSON.stringify(index.aircraft)).toBe(before)
})
it('keeps unknown tracks unfiltered by default and requires candidate opt-in for matching',()=>{
 expect(index.aircraft.filter(t=>matchesEndpointFilter(t,EMPTY_ENDPOINT_FILTER,resolve))).toHaveLength(40945)
 const north={...EMPTY_ENDPOINT_FILTER,continent:'NA' as const}
 expect(index.aircraft.filter(t=>matchesEndpointFilter(t,north,resolve))).toHaveLength(4)
 expect(index.aircraft.filter(t=>matchesEndpointFilter(t,{...north,includeCandidates:true},resolve)).length).toBeGreaterThan(4)
 const unresolved=index.aircraft.filter(t=>matchesEndpointFilter(t,{...EMPTY_ENDPOINT_FILTER,continent:'unresolved'},resolve))
 expect(unresolved).toHaveLength(18937)
 const conflict=index.aircraft.find(t=>resolve(t,'destination').status==='conflicting')!
 expect(matchesEndpointFilter(conflict,{...EMPTY_ENDPOINT_FILTER,airport:resolve(conflict,'destination').airport!.icao,includeCandidates:true},resolve)).toBe(false)
})
it('uses exact endpoint direction and airport without changing observed airport/route semantics',()=>{
 const t=index.aircraft.find(t=>t.callsign==='QFA10'&&resolve(t,'destination').status==='corroborated')!
 expect(matchesEndpointFilter(t,{...EMPTY_ENDPOINT_FILTER,airport:'YPPH'},resolve)).toBe(true)
 expect(matchesEndpointFilter(t,{...EMPTY_ENDPOINT_FILTER,side:'origin',airport:'YPPH'},resolve)).toBe(false)
 expect(t.destination).toBeUndefined()
})
