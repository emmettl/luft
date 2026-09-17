import {expect,it} from 'vitest'
import type {Index} from './data'
import {buildInsights} from './insights'
import {EMPTY_SELECTION,matchesSelection} from './filters'
import type {AirportGeography} from './geography'

const geography:AirportGeography={LSZH:{country:'CH',continent:'EU'},EGLL:{country:'GB',continent:'EU'},KJFK:{country:'US',continent:'NA'}}
const track=(id:string,icaoAddress:string,callsign:string,origin?:string,destination?:string)=>({id,icaoAddress,callsign,start:0,end:100,origin:origin?{icao:origin,iata:origin}:undefined,destination:destination?{icao:destination,iata:destination}:undefined}) as Index['aircraft'][number]
const index:Index={airports:[],bins:[],cells:[],aircraft:[track('a','one','SWR1','LSZH','EGLL'),track('b','one','SWR2','EGLL','LSZH'),track('c','two','BAW1','EGLL','KJFK'),track('d','three','EZY1','LSZH','LSZH'),track('e','four','PRIVATE')]}
it('counts distinct aircraft, not legs or endpoints, and reports missing coverage',()=>{
 const stats=buildInsights(index,EMPTY_SELECTION,'countries',geography)
 expect(stats.rows.map(row=>[row.id,row.count])).toEqual([['CH',2],['GB',2],['US',1]])
 expect(stats.total).toBe(4);expect(stats.covered).toBe(3)
 expect(buildInsights(index,EMPTY_SELECTION,'airports',geography).rows.find(r=>r.id==='LSZH')?.count).toBe(2)
 expect(buildInsights(index,EMPTY_SELECTION,'continents',geography).rows.map(r=>[r.id,r.count])).toEqual([['EU',3],['NA',1]])
})
it('keeps alternatives within the active category while respecting other filters',()=>{
 const selection={...EMPTY_SELECTION,airlines:['swiss'] as ['swiss'],countries:['GB']}
 expect(buildInsights(index,selection,'airlines',geography).rows.map(r=>r.id)).toEqual(['british-airways','swiss'])
 expect(buildInsights(index,selection,'countries',geography).rows.map(r=>r.id)).toEqual(['CH','GB'])
 expect(buildInsights(index,{...selection,airports:['KJFK']},'countries',geography).rows).toEqual([])
})
it('unions countries and continents within groups, intersects across groups, and excludes unknown endpoints',()=>{
 const selection={...EMPTY_SELECTION,countries:['CH','US'],continents:['NA']}
 expect(index.aircraft.filter(t=>matchesSelection(t,selection,geography)).map(t=>t.id)).toEqual(['c'])
 expect(matchesSelection(index.aircraft[4],{...EMPTY_SELECTION,countries:['GB']},geography)).toBe(false)
 expect(matchesSelection(index.aircraft[4],EMPTY_SELECTION,geography)).toBe(true)
})
it('uses endpoint continent evidence when reference geography is unavailable',()=>{
 const observed={...index.aircraft[0],origin:{...index.aircraft[0].origin!,continent:'AS' as const},destination:undefined}
 expect(matchesSelection(observed,{...EMPTY_SELECTION,continents:['AS']},{})).toBe(true)
 expect(buildInsights({...index,aircraft:[observed]},EMPTY_SELECTION,'continents',{}).rows[0].label).toBe('Asia')
})
