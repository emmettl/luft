import {expect,it} from 'vitest'
import {matchesSelection,routeKey,selectionActivity,EMPTY_SELECTION,type SnapshotIndex} from './filters'
import type {Index} from './data'
import {trackDirection} from './retained-trails'
const make=(id:string,identity:string,callsign:string,origin?:string,destination?:string)=>({id,icaoAddress:identity,callsign,start:0,end:86400,origin:origin?{icao:origin}:undefined,destination:destination?{icao:destination}:undefined}) as Index['aircraft'][number]
const a=make('a','one','SWR1','LSZH','EGLL'),b=make('b','two','EZY2','LFPG','EGLL'),c=make('c','three','BAW3'),d=make('d','one','SWR4','EGLL','LSZH')
it('unions within categories and intersects across categories, excluding unknown endpoints',()=>{
 const s={airlines:['swiss','easyjet'] as const,airports:['LSZH','EGLL'],routes:['EGLL|LSZH'],countries:[]}
 expect([a,b,c,d].filter(t=>matchesSelection(t,{...s,airlines:[...s.airlines]})).map(t=>t.id)).toEqual(['a','d'])
 expect(routeKey(a)).toBe(routeKey(d))
 expect(matchesSelection(c,EMPTY_SELECTION)).toBe(true)
 expect(matchesSelection(c,{...EMPTY_SELECTION,routes:['EGLL|LSZH']})).toBe(false)
 expect(matchesSelection(b,{...EMPTY_SELECTION,airports:['LSZH','EGLL']})).toBe(true)
})
it('deduplicates aircraft identities per tick and includes zero bins without inventing observations',()=>{
 const snapshots:SnapshotIndex={date:'test',sourceManifestSha256:'test',tracks:[['a',[0,10,20,12,20,30]],['d',[0,10,20,1,12,22]],['b',[0,30,40]]]}
 const summary=selectionActivity([a,b,d],snapshots)
 expect(summary.aircraft).toBe(2)
 expect(summary.bins.slice(0,3).map(b=>b.count)).toEqual([2,1,0])
 expect(summary.cells[0]).toEqual([[5,10,1],[6,11,1],[15,20,1]])
 expect(summary.cells[1]).toEqual([[10,15,1]])
 expect(selectionActivity([],snapshots).bins.every(b=>b.count===0)).toBe(true)
})
it('highlights arrivals and departures for every selected airport on both renderer paths',()=>{
 expect(trackDirection(a,['LSZH'])).toBe('outbound')
 expect(trackDirection(a,['LFPG','EGLL'])).toBe('inbound')
 expect(trackDirection(a,[])).toBeUndefined()
})
