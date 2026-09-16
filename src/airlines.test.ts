import {describe,it,expect} from 'vitest'
import {airlineForTrack,matchesAirline} from './airlines'
import {createAirlineAccumulator,accumulateAirlines,finishAirlines} from './airline-aggregate'
import type {AirTrack} from '@motionstudies/core/domain/air'
describe('operating callsign families',()=>{
 it('includes all verified easyJet and BA operators',()=>{
  for(const callsign of ['EZY12AB','EJU53XA','EZS4PW'])expect(airlineForTrack({callsign})).toBe('easyjet')
  for(const callsign of ['BAW123','SHT3G','CFE221','EFW8MC'])expect(airlineForTrack({callsign})).toBe('british-airways')
  expect(airlineForTrack({callsign:' swr18k '})).toBe('swiss')
 })
 it('keeps unknowns and partners separate, and excludes ICAO fallback collisions',()=>{
  for(const callsign of ['OAW18','SWW21','EDW32','GSWR1','SWR','SWR 123','BA123'])expect(airlineForTrack({callsign})).toBeUndefined()
  expect(airlineForTrack({callsign:'CFE123',icaoAddress:'cfe123'})).toBeUndefined()
  expect(matchesAirline({callsign:'UNKNOWN'},'all')).toBe(true)
  expect(matchesAirline({callsign:'SWR12'},'easyjet')).toBe(false)
 })
})
const track=(id:string,callsign:string,times:number[]):AirTrack=>({id,icaoAddress:id.split('-')[0],callsign,start:times[0],end:times.at(-1)!,samples:times.map(t=>[t,0,51,10000,300])})
it('does not double-count delivery overlap or count track fragments as aircraft',()=>{
 const accumulator=createAirlineAccumulator()
 accumulateAirlines(accumulator,[track('abcdef-0','EZY123',[0,300,590,600,610]),track('123abc-0','SWR123',[0,300])],0,600)
 accumulateAirlines(accumulator,[track('abcdef-0','EZY123',[590,600,610]),track('abcdef-900','EJU456',[900,910])],600,1200)
 const result=finishAirlines(accumulator)
 expect(result.easyjet.aircraft).toBe(1);expect(result.easyjet.samples).toBe(7)
 expect(result.easyjet.bins.slice(0,4).map(b=>b.count)).toEqual([1,1,1,1])
 expect(result.easyjet.cells[0]).toEqual([[0,51,7]])
 expect(result.swiss.aircraft).toBe(1);expect(result.swiss.samples).toBe(2)
 expect(result['british-airways'].samples).toBe(0)
})
