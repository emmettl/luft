import {test,expect} from '@playwright/test'
import {pauseAtStart} from './playback-helpers'
test('both renderers fade valid heads and trails without bridging gaps or rebuilding retained geometry',async({page})=>{
 await page.goto('./');await pauseAtStart(page)
 const result=await page.evaluate(async()=>{
  const {AirMap,EUROPE}=await import('/luft/src/map.ts' as string)
  const {GpuAircraftPainter}=await import('/luft/src/gpu-aircraft.ts' as string)
  const rows=[],failures:string[]=[]
  for(const renderer of ['canvas','three'])for(const dimmed of [false,true]){
   const host=document.createElement('div');host.style.cssText='position:relative;width:400px;height:400px';document.body.append(host)
   const canvas=document.createElement('canvas');canvas.style.cssText='width:400px;height:400px';host.append(canvas)
   const map=new AirMap(canvas,{features:[]},[],EUROPE),cells:number[][]=[]
   if(renderer==='three')map.setPainter(new GpuAircraftPainter(host,(s:string)=>failures.push(s)))
   const track={id:'test',callsign:'TEST',start:100,end:240,samples:[100,110,120,200,210,220,230,240].map(t=>[t,0,50,30000,400])},tracks=[track],matches=dimmed?new Set<string>():undefined
   const draw=(time:number,clock:number)=>map.draw(tracks,time,undefined,'motion',cells,clock,matches)
   const ink=()=>{
    const layer=renderer==='three'?host.querySelector('.gpu-layer') as HTMLCanvasElement:canvas
    const copy=document.createElement('canvas');copy.width=layer.width;copy.height=layer.height
    const ctx=copy.getContext('2d')!;ctx.drawImage(layer,0,0)
    const data=ctx.getImageData(0,0,copy.width,copy.height).data;let sum=0
    for(let i=3;i<data.length;i+=4)sum+=data[i]
    return sum
   }
   draw(90,0);draw(100,.1);const onset=ink()
   const midCounts=draw(105,.4),mid=ink()
   draw(110,.7);const full=ink(),stats=map.gpuStats()
   // No invalid frame is painted between 110 and 201, but the >45s gap still triggers a fade.
   draw(201,.8);const reappearance=ink();draw(205,1.1);const resumed=ink()
   const before=map.renderedFrames;draw(205,1.1);const pausedDraws=map.renderedFrames-before
   map.resetMotionEffects();draw(205,1.1);const seek=ink()
   map.setMotionEffectsEnabled(false);draw(210,1.2);const reduced=ink()
   draw(160,1.3);const missing=ink()
   rows.push({renderer,dimmed,onset,mid,full,reappearance,resumed,pausedDraws,seek,reduced,missing,midCounts,stats})
   map.dispose();host.remove()
  }
  return {rows,failures}
 })
 expect(result.failures).toEqual([])
 for(const r of result.rows){
  expect(r.onset).toBe(0);expect(r.full).toBeGreaterThan(0)
  expect(r.mid/r.full).toBeGreaterThan(.35);expect(r.mid/r.full).toBeLessThan(.7)
  expect(r.reappearance).toBe(0);expect(r.resumed/r.full).toBeGreaterThan(.35);expect(r.resumed/r.full).toBeLessThan(.7)
  expect(r.pausedDraws).toBe(0);expect(r.seek).toBe(r.full);expect(r.reduced).toBe(r.full);expect(r.missing).toBe(0)
  expect(r.midCounts.total).toBe(r.dimmed?0:1)
  if(r.stats)expect(r.stats.geometryPreparedBytes).toBe(0)
 }
 for(const renderer of ['canvas','three']){
  const normal=result.rows.find(r=>r.renderer===renderer&&!r.dimmed)!,dim=result.rows.find(r=>r.renderer===renderer&&r.dimmed)!
  expect(dim.full/normal.full).toBeGreaterThan(.1);expect(dim.full/normal.full).toBeLessThan(.2)
 }
})
