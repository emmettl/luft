import {expect,it} from 'vitest'
import {createEndpointResolver,readAirEnrichment,endpointCoverage,usableEndpoint} from '@motionstudies/core/air-enrichment'
import {EMPTY_ENDPOINT_FILTER,matchesEndpointFilter} from '../src/endpoint-filters'
import {index,resolveEndpoint as resolve} from '../tests/release-expectations'
import fixture from '../tests/fixtures/enrichment-reviewed.json'
it('binds the daily evidence to canonical segments and preserves observed endpoints',()=>{
 const before=JSON.stringify(index.aircraft)
 for(const side of ['origin','destination'] as const){
  const coverage=endpointCoverage(index.aircraft,resolve,side)
  expect(coverage.segments).toBe(index.aircraft.length)
  expect(coverage.observed).toBe(index.aircraft.filter(t=>t[side]).length)
  expect(coverage.observed+coverage.corroborated+coverage.candidate+coverage.conflicting+coverage.unknown).toBe(index.aircraft.length)
  expect(coverage.usable).toBe(coverage.observed+coverage.corroborated)
  for(const track of index.aircraft.filter(t=>t[side])){
   expect(resolve(track,side).status).toBe('observed')
   expect(resolve(track,side).airport?.icao).toBe(track[side]!.icao)
  }
 }
 expect(JSON.stringify(index.aircraft)).toBe(before)
})
it('keeps unknown tracks unfiltered and only matches usable evidence',()=>{
 expect(index.aircraft.filter(t=>matchesEndpointFilter(t,EMPTY_ENDPOINT_FILTER,resolve))).toHaveLength(index.aircraft.length)
 for(const side of ['origin','destination'] as const){
  for(const includeCandidates of [false,true]){
   const filter={...EMPTY_ENDPOINT_FILTER,side,includeCandidates,continent:'NA' as const}
   const expected=index.aircraft.filter(t=>{const label=resolve(t,side);return usableEndpoint(label,includeCandidates)&&label.airport?.continent==='NA'})
   expect(index.aircraft.filter(t=>matchesEndpointFilter(t,filter,resolve))).toEqual(expected)
  }
 }
})
// Retain reviewed September 14 regressions independently of the current day.
it('preserves corroborated direction, candidate opt-in and conflict exclusion in the archived review fixture',()=>{
 const enrichment=readAirEnrichment(fixture.enrichment,{date:fixture.enrichment.date,sourceManifestSha256:fixture.enrichment.sourceManifestSha256,tracks:fixture.tracks})
 const resolve=createEndpointResolver(enrichment)
 const qfa=fixture.tracks.find(t=>t.callsign==='QFA10')!
 expect(matchesEndpointFilter(qfa,{...EMPTY_ENDPOINT_FILTER,airport:'YPPH'},resolve)).toBe(true)
 expect(matchesEndpointFilter(qfa,{...EMPTY_ENDPOINT_FILTER,side:'origin',airport:'YPPH'},resolve)).toBe(false)
 expect(qfa.destination).toBeUndefined()
 for(const status of ['candidate','conflicting'] as const){
  const track=fixture.tracks.find(t=>resolve(t,'destination').status===status)!
  const filter={...EMPTY_ENDPOINT_FILTER,airport:resolve(track,'destination').airport!.icao}
  expect(matchesEndpointFilter(track,filter,resolve)).toBe(false)
  expect(matchesEndpointFilter(track,{...filter,includeCandidates:true},resolve)).toBe(status==='candidate')
 }
})
