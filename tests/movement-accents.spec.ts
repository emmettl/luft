import {test,expect} from '@playwright/test'
import {pauseAtStart} from './playback-helpers'

test('departure and arrival accents render alike over Canvas and Three.js and survive an aircraft ending',async({page})=>{
 await page.goto('./');await pauseAtStart(page)
 const result=await page.evaluate(async()=>{
  const {AirMap,EUROPE}=await import('/luft/src/map.ts' as string)
  const {GpuAircraftPainter}=await import('/luft/src/gpu-aircraft.ts' as string)
  const host=document.createElement('div');host.style.cssText='position:relative;width:400px;height:400px';document.body.append(host)
  const base=document.createElement('canvas'),overlay=document.createElement('canvas');base.style.cssText='width:400px;height:400px';host.append(base,overlay)
  const map=new AirMap(base,{features:[]},[],EUROPE,overlay),cells:number[][]=[],failures:string[]=[]
  const endpoint=(time:number)=>({icao:'TEST',iata:'TST',name:'Test',city:'Test',time,evidence:'observed-endpoint'})
  const track={id:'flight',callsign:'TEST',start:0,end:90,origin:endpoint(10),destination:endpoint(80),samples:[[0,0,50,100,130],[30,1,50,1500,180],[60,2,50,1500,180],[90,3,50,100,130]]},tracks=[track]
  const pixels=()=>overlay.getContext('2d')!.getImageData(0,0,overlay.width,overlay.height).data
  const ink=()=>{const p=pixels();let n=0;for(let i=3;i<p.length;i+=4)if(p[i])n++;return n}
  const colour=()=>{const p=pixels();let best=3;for(let i=3;i<p.length;i+=4)if(p[i]>p[best])best=i;return [...p.slice(best-3,best)]}
  map.draw(tracks,9,undefined,'motion',cells,0)
  map.draw(tracks,11,undefined,'motion',cells,.1)
  map.draw(tracks,20,undefined,'motion',cells,.6)
  const departure={ink:ink(),colour:colour(),image:overlay.toDataURL()}
  map.draw(tracks,20,undefined,'motion',cells,.6);const paused=overlay.toDataURL()
  const painter=new GpuAircraftPainter(host,(message:string)=>failures.push(message));map.setPainter(painter)
  map.draw(tracks,20,undefined,'motion',cells,.6);const gpuImage=overlay.toDataURL()
  map.draw(tracks,21,undefined,'motion',cells,.7);const retained=painter.stats()
  map.resetAccents();const cleared=ink()
  map.draw(tracks,79,undefined,'motion',cells,1)
  map.draw(tracks,81,undefined,'motion',cells,1.02)
  map.draw(tracks,85,undefined,'motion',cells,1.52)
  const arrival={ink:ink(),colour:colour()}
  const counts=map.draw([],91,undefined,'motion',cells,1.7),afterEnd=ink()
  map.draw([],93,undefined,'motion',cells,2.1);const expired=ink()
  map.resetAccents();map.draw(tracks,9,undefined,'motion',cells,3);map.draw(tracks,11,undefined,'motion',cells,3.1);map.draw(tracks,20,undefined,'motion',cells,3.6)
  map.setAccentsEnabled(false);const disabled=ink();map.draw(tracks,81,undefined,'motion',cells,4);const disabledAfterEvent=ink()
  map.dispose();host.remove()
  return {departure,paused,gpuImage,retained,cleared,arrival,counts,afterEnd,expired,disabled,disabledAfterEvent,failures}
 })
 expect(result.failures).toEqual([])
 expect(result.departure.ink).toBeGreaterThan(0);expect(result.departure.colour[0]).toBeGreaterThan(result.departure.colour[2])
 expect(result.paused).toBe(result.departure.image);expect(result.gpuImage).toBe(result.departure.image)
 expect(result.retained.geometryPreparedBytes).toBe(0)
 expect(result.cleared).toBe(0)
 expect(result.arrival.ink).toBeGreaterThan(0);expect(result.arrival.colour[2]).toBeGreaterThan(result.arrival.colour[0])
 expect(result.counts.total).toBe(0);expect(result.afterEnd).toBeGreaterThan(0)
 expect(result.expired).toBe(0);expect(result.disabled).toBe(0);expect(result.disabledAfterEvent).toBe(0)
})

test('seeking and reduced-motion preference keep the accent overlay clear',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'})
 await page.goto('./');await pauseAtStart(page)
 await expect(page.locator('.movement-layer')).toHaveCSS('pointer-events','none')
 const ink=()=>page.locator('.movement-layer').evaluate((canvas:HTMLCanvasElement)=>{
  const pixels=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data
  for(let i=3;i<pixels.length;i+=4)if(pixels[i])return true
  return false
 })
 await page.getByRole('slider').fill('25659');await page.locator('.play').click()
 await expect.poll(async()=>Number(await page.getByRole('slider').inputValue())).toBeGreaterThan(25700)
 expect(await ink()).toBe(false)
 await page.emulateMedia({reducedMotion:'no-preference'})
 await page.locator('.play').click();await page.getByRole('slider').fill('25661')
 expect(await ink()).toBe(false)
})
