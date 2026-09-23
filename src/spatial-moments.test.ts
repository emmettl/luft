import {expect,it} from 'vitest'
import {airportMoments} from './spatial-moments'
import type {Index} from './data'
const airports=[{icao:'TEST',iata:'TST',city:'Test city'}] as Index['airports']
const arrival=(id:string,time:number,icao='TEST')=>({id,icaoAddress:id,destination:{icao,time}} as Index['aircraft'][number])
it('finds a spatial window, deduplicates identities, and uses earliest ties',()=>{
 const tracks=[arrival('a',1200),arrival('b',1500),arrival('c',1800),arrival('a',1300)]
 const scenes=airportMoments(tracks,airports)
 expect(scenes).toHaveLength(1)
 expect(scenes[0]).toMatchObject({id:'arrival-wave',airport:'TEST',time:300,endTime:2100})
 expect(scenes[0].caption).toContain('3 distinct aircraft')
 expect(airportMoments(tracks.slice(0,2),airports)).toEqual([])
})
it('excludes unknown, invalid, and out-of-day evidence and keeps midnight windows within the day',()=>{
 expect(airportMoments([arrival('a',NaN),arrival('b',-1),arrival('c',86400),arrival('d',500,'UNKNOWN')],airports)).toEqual([])
 const end=airportMoments([arrival('a',86100),arrival('b',86300),arrival('c',86399)],airports)[0]
 expect(end.time).toBe(84600);expect(end.endTime).toBe(86400)
})
it('keeps arrivals and departures distinct and respects the supplied filtered tracks',()=>{
 const tracks=[arrival('a',1200),arrival('b',1500),arrival('c',1800)]
 const departures=tracks.map(track=>({...track,origin:track.destination,destination:undefined}))
 expect(airportMoments(departures,airports)[0].id).toBe('departure-wave')
 expect(airportMoments(tracks.filter(track=>track.id!=='a'),airports)).toEqual([])
})
