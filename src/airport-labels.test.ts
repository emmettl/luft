import {expect,it} from 'vitest'
import {airportLabelRanks,layoutAirportLabels} from './airport-labels'
import type {Airport} from './data'
import type {AirSearchTrack} from '@motionstudies/core/air-search'
const airports=Array.from({length:12},(_,i)=>({id:`A${i}`,icao:`A${i}`,iata:`A${i}`,name:`Airport ${i}`,city:`City ${i}`,longitude:50+(i%4)*100,latitude:50+Math.floor(i/4)*70,hasObservedMovements:true}) as Airport)
const ranks=new Map(airports.map((a,i)=>[a.icao,i])),project=(x:number,y:number)=>[x,y]
it('promotes country airports without movement evidence while preserving individual selection semantics',()=>{
 const hidden={...airports[11],hasObservedMovements:false}
 const labels=layoutAirportLabels([hidden],ranks,new Set(),new Set(),38,500,400,project,[],new Set([hidden.icao]))
 expect(labels).toHaveLength(1);expect(labels[0].highlighted).toBe(true);expect(labels[0].selected).toBe(false)
})
it('ranks deduplicated observed endpoint associations and keeps unknown airports searchable only when selected',()=>{
 const endpoint={icao:'A5',time:10},t={id:'a',icaoAddress:'abc',origin:endpoint} as AirSearchTrack
 const rank=airportLabelRanks(airports,[t,{...t,id:'fragment'},...Array.from({length:2},(_,i)=>({id:`b${i}`,icaoAddress:`b${i}`,destination:{icao:'A2',time:10}} as AirSearchTrack))])
 expect(rank.get('A2')).toBe(0);expect(rank.get('A5')).toBe(1)
 const noEvidence={...airports[0],hasObservedMovements:false}
 expect(layoutAirportLabels([noEvidence],ranks,new Set(),new Set(),38,500,400,project,[])).toEqual([])
 expect(layoutAirportLabels([noEvidence],ranks,new Set(['A0']),new Set(),38,500,400,project,[])[0].selected).toBe(true)
})
it('shows hubs first, expands with zoom, and promotes selected airports outside the normal tier',()=>{
 const labels=(height:number,selected=new Set<string>())=>layoutAirportLabels(airports,ranks,selected,new Set(),height,500,400,project,[])
 expect(labels(38)).toHaveLength(8);expect(labels(15)).toHaveLength(12)
 expect(labels(38,new Set(['A11']))[0].airport.icao).toBe('A11')
 for(const label of labels(15)){expect(label.box.bottom-label.box.top).toBe(44);expect(label.box.right-label.box.left).toBeGreaterThanOrEqual(44)}
})
