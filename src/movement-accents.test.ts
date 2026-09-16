import {expect,it} from 'vitest'
import type {AirEndpoint,AirTrack} from '@motionstudies/core/domain/air'
import {ACCENT_SECONDS,MovementAccents,movementEvents} from './movement-accents'
const endpoint=(time:number):AirEndpoint=>({icao:'TEST',iata:'TST',name:'Test',city:'Test',time,evidence:'observed-endpoint'})
const flight=(id='flight'):AirTrack=>({id,icaoAddress:'abc123',callsign:'TEST',start:0,end:90,origin:endpoint(10),destination:endpoint(80),samples:[[0,0,50,100,130],[30,1,50,1500,180],[60,2,50,1500,180],[90,3,50,100,130]]})
it('uses observed airport endpoints with a valid position, not chunk edges or coverage gaps',()=>{
 const t=flight(),events=movementEvents([t])
 expect(events.map(e=>[e.kind,e.time])).toEqual([['departure',10],['arrival',80]])
 expect(events[0].longitude).toBeCloseTo(1/3)
 expect(movementEvents([{...t,origin:undefined,destination:undefined}])).toEqual([])
 expect(movementEvents([{...t,origin:endpoint(-1),destination:endpoint(100)}])).toEqual([])
 expect(movementEvents([{...t,origin:endpoint(40),destination:undefined,samples:[[0,0,50,0,100],[90,3,50,100,130]]}])).toEqual([])
 expect(movementEvents([t,{...t,id:'overlapping-segment'}])).toHaveLength(2)
})
it('lasts one playback second at slow and fast paces and freezes on pause',()=>{
 for(const speed of [60,300,900]){
  const accents=new MovementAccents(),tracks=[flight()]
  expect(accents.advance(tracks,9,0)).toHaveLength(0)
  const active=accents.advance(tracks,11,.02);expect(active).toHaveLength(1)
  expect(accents.advance(tracks,11,.02)).toEqual(active)
  expect(accents.advance(tracks,11+speed*.03,.05).some(e=>e.kind==='departure')).toBe(true)
  expect(accents.advance(tracks,Math.min(70,11+speed*.2),.02+ACCENT_SECONDS).some(e=>e.kind==='departure')).toBe(false)
 }
})
it('keeps an arrival hint after its aircraft disappears and across chunk replacement',()=>{
 const accents=new MovementAccents(),tracks=[flight()]
 accents.advance(tracks,79,0)
 expect(accents.advance(tracks,85,.01).map(e=>e.kind)).toEqual(['arrival'])
 const empty:AirTrack[]=[]
 expect(accents.advance(empty,100,.5)).toHaveLength(1)
 expect(accents.advance(empty,110,1.02)).toHaveLength(0)
})
it('does not replay hints when loading, seeking, looping or resetting filters',()=>{
 const accents=new MovementAccents(),tracks=[flight()]
 expect(accents.advance(tracks,50,0)).toEqual([])
 accents.advance(tracks,85,.1);accents.reset()
 expect(accents.advance(tracks,11,.2)).toEqual([])
 expect(accents.advance(tracks,0,.3)).toEqual([])
 expect(accents.advance(tracks,11,.4)).toHaveLength(1)
 expect(accents.advance(tracks,500,.5)).toEqual([])
})
