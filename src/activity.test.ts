import {expect,it} from 'vitest'
import {airportActivity,activityPath} from './activity'
import type {Index} from './data'
it('counts unique identities per half-hour and separates observed airport endpoints',()=>{
 const tracks=[
  {id:'a',icaoAddress:'one',origin:{icao:'TEST',time:1800},destination:{icao:'TEST',time:3600}},
  {id:'b',icaoAddress:'one',origin:{icao:'TEST',time:1850}},
  {id:'c',icaoAddress:'two',destination:{icao:'TEST',time:3599}},
  {id:'d',origin:{icao:'OTHER',time:1800}},
  {id:'e',origin:{icao:'TEST',time:NaN}},
  {id:'f',origin:{icao:'TEST',time:86400}},
 ] as Index['aircraft']
 const [arrivals,departures]=airportActivity(tracks,'TEST')
 expect(arrivals.values[1]).toBe(1);expect(arrivals.values[2]).toBe(1)
 expect(departures.values[1]).toBe(1);expect(departures.values.reduce((a,b)=>a+b,0)).toBe(1)
 expect(airportActivity([], 'TEST')[0].values.every(value=>value===0)).toBe(true)
})
it('uses a supplied common scale instead of normalizing each airline separately',()=>{
 expect(activityPath([0,5,10],10)).toBe('M6.00,64.00 L150.00,36.00 L294.00,8.00')
 expect(activityPath([0,5,10],20)).toBe('M6.00,64.00 L150.00,50.00 L294.00,36.00')
})
