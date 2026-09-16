import {pauseAtStart} from './playback-helpers'
import {test,expect} from '@playwright/test'

test('retained shaders preserve exact-time heads, gaps and tail expiry without rebuilding on time or view changes',async({page})=>{
 await page.goto('./');await pauseAtStart(page)
 const result=await page.evaluate(async()=>{
  const {GpuAircraftPainter}=await import('/luft/src/gpu-aircraft.ts' as string)
  const {positionForAirTrack}=await import('/luft/node_modules/@motionstudies/core/domain/air.js' as string)
  const host=document.createElement('div');document.body.append(host)
  const failures:string[]=[],painter=new GpuAircraftPainter(host,(message:string)=>failures.push(message))
  const track={id:'test',callsign:'TEST',start:0,end:310,samples:[[0,0,20,12000,300],[10,1,20,12000,300],[20,2,20,12000,300],[90,9,20,12000,300],[100,10,20,12000,300],[300,14,20,12000,300],[310,15,20,12000,300]]},tracks=[track]
  const projection={xScale:20,yScale:-10,xOffset:30,yOffset:400}
  const canvas=host.querySelector('canvas')!,gl=canvas.getContext('webgl2')!,pixel=new Uint8Array(4)
  const ink=(x:number)=>{let alpha=0;for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){gl.readPixels(x+dx,400-200+dy,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);alpha=Math.max(alpha,pixel[3])}return alpha}
  const frames=[]
  for(const time of [15,20,90,95,305,15]){
   painter.begin(400,400,1,projection,time);painter.prepare(tracks);painter.aircraft(0,positionForAirTrack(track,time),true);painter.end()
   frames.push({time,completed:ink(40),head:ink(time===20?70:60),gap:ink(150),recent:ink(220),late:ink(320),stats:painter.stats()})
  }
  painter.begin(400,400,2,{...projection,xOffset:31},16);painter.prepare(tracks);painter.aircraft(0,positionForAirTrack(track,16),true);painter.end();const resized=painter.stats()
  painter.clear();const density=painter.stats()
  painter.prepare(tracks,'AIRPORT','test');const selected=painter.stats()
  painter.prepare([]);painter.end();const empty=painter.stats()
  painter.dispose();host.remove();return {frames,resized,density,selected,empty,failures}
 })
 expect(result.failures).toEqual([])
 const [first,exact,gap,resumed,expired,backward]=result.frames
 expect(first.completed).toBeGreaterThan(0);expect(first.head).toBeGreaterThan(0);expect(first.recent).toBe(0)
 expect(exact.head).toBeGreaterThan(0)
 for(const key of ['completed','head','gap','recent','late'] as const)expect(gap[key]).toBe(0)
 expect(resumed.completed).toBeGreaterThan(0);expect(resumed.recent).toBeGreaterThan(0);expect(resumed.gap).toBe(0)
 expect(expired.completed).toBe(0);expect(expired.recent).toBe(0);expect(expired.late).toBeGreaterThan(0)
 expect(backward.completed).toBeGreaterThan(0);expect(backward.head).toBeGreaterThan(0)
 expect(first.stats.geometryPreparedBytes).toBeGreaterThan(0)
 for(const frame of result.frames.slice(1)){expect(frame.stats.geometryBuilds).toBe(1);expect(frame.stats.geometryPreparedBytes).toBe(0)}
 expect(result.resized.geometryBuilds).toBe(1);expect(result.resized.geometryPreparedBytes).toBe(0)
 expect(result.density.calls).toBe(0);expect(result.density.stateUploadBytes).toBe(0)
 expect(result.selected.geometryBuilds).toBe(2);expect(result.empty.calls).toBe(0)
})
