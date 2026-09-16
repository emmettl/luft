import {test,expect} from '@playwright/test'
import {pauseAtStart} from './playback-helpers'

test('dim toggle restores background traffic without changing the selected counts or timeline',async({page})=>{
 await page.goto('./');await pauseAtStart(page)
 const search=page.getByRole('combobox',{name:'Search flights'})
 await search.fill('SWISS');await page.getByRole('option',{name:/^SWISS/}).click()
 await expect(page.locator('.count')).toHaveText('27 aircraft · SWISS')
 const count=await page.locator('.count').innerText(),timeline=await page.locator('.ms-study-timeline__heading').innerText()
 const pixels=()=>page.locator('canvas').first().evaluate(canvas=>(canvas as HTMLCanvasElement).toDataURL())
 const hidden=await pixels()
 await page.getByRole('button',{name:'View settings',exact:true}).click()
 const toggle=page.getByRole('checkbox',{name:'Dim other flights'})
 await expect(toggle).not.toBeChecked();await toggle.check()
 await expect(page.locator('.selection-summary')).toContainText('other flights dimmed')
 await expect.poll(pixels).not.toBe(hidden)
 await expect(page.locator('.count')).toHaveText(count)
 await expect(page.locator('.ms-study-timeline__heading')).toHaveText(timeline,{useInnerText:true})
 await page.screenshot({path:`test-results/${test.info().project.name}-dim-flights.png`,fullPage:true})
 await toggle.uncheck();await expect.poll(pixels).toBe(hidden)
 await toggle.check()
 await page.getByRole('button',{name:'Close view settings'}).click()
 await page.getByRole('button',{name:'Clear all',exact:true}).click()
 await expect(page.locator('.count')).toContainText('over Europe')
 const clear=await pixels()
 await page.getByRole('button',{name:'View settings',exact:true}).click()
 await toggle.uncheck();await expect.poll(pixels).toBe(clear)
})

test('GPU dims non-matching heads and trails and refreshes a paused filter',async({page})=>{
 await page.goto('./');await pauseAtStart(page)
 const result=await page.evaluate(async()=>{
  const {GpuAircraftPainter}=await import('/luft/src/gpu-aircraft.ts' as string)
  const host=document.createElement('div');document.body.append(host)
  const failures:string[]=[],painter=new GpuAircraftPainter(host,(message:string)=>failures.push(message))
  const tracks=[0,1].map(i=>({id:String(i),callsign:String(i),start:0,end:10,samples:[[0,0,10+i*10,12000,300],[10,10,10+i*10,12000,300]]}))
  const gl=host.querySelector('canvas')!.getContext('webgl2')!,pixel=new Uint8Array(4)
  const ink=(x:number,y:number)=>{let alpha=0;for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){gl.readPixels(x+dx,400-y+dy,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);alpha=Math.max(alpha,pixel[3])}return alpha}
  const draw=(matching?:Set<string>)=>{
   painter.begin(400,400,1,{xScale:20,yScale:-10,xOffset:30,yOffset:400},5);painter.prepare(tracks,undefined,undefined,matching)
   for(let i=0;i<2;i++)painter.aircraft(i,{longitude:5,latitude:10+i*10,altitudeFeet:12000},true)
   painter.end();return {heads:[ink(130,300),ink(130,200)],trails:[ink(70,300),ink(70,200)]}
  }
  const first=draw(new Set(['0'])),changed=draw(new Set(['1'])),cleared=draw()
  painter.dispose();host.remove();return {first,changed,cleared,failures}
 })
 expect(result.failures).toEqual([])
 for(const shape of ['heads','trails'] as const){
  expect(result.first[shape][1]).toBeGreaterThan(0)
  expect(result.first[shape][0]).toBeGreaterThan(result.first[shape][1]*3)
  expect(result.changed[shape][1]).toBeGreaterThan(result.changed[shape][0]*3)
  expect(result.cleared[shape][0]).toBe(result.cleared[shape][1])
 }
})
