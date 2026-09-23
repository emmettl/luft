import {test,expect} from '@playwright/test'
import {pauseAtStart} from './playback-helpers'
import {manifest} from './release-expectations'

test('airport rhythm scrubs paused playback and keeps the airport selected',async({page})=>{
 await page.goto('./#airports=LSZH');await pauseAtStart(page)
 await page.getByRole('button',{name:'ZRH board'}).click()
 const board=page.getByRole('region',{name:'ZRH airport board'}),slider=board.getByRole('slider',{name:'Airport activity time UTC'})
 await expect(board.locator('.activity-legend')).toContainText('Arrivals')
 await expect(board.locator('.activity-legend')).toContainText('Departures')
 await slider.focus();await slider.press('Home');await slider.press('ArrowRight')
 await expect(page.getByRole('slider',{name:'Time of day UTC'})).toHaveValue('1')
 await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled()
 await expect(page.getByRole('button',{name:'Remove ZRH',exact:true})).toBeVisible()
})

for(const renderer of ['canvas','three'])test(`${renderer}: comparison survives sharing, and exports a PNG`,async({page,context})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
 await page.goto(`./?renderer=${renderer}`);await pauseAtStart(page)
 await page.getByRole('button',{name:'View settings',exact:true}).click()
 await page.getByRole('button',{name:'Compare two airlines',exact:true}).click()
 const comparison=page.getByRole('region',{name:'Compare airlines'})
 await expect(comparison).toBeVisible()
 await expect(comparison.getByLabel('First airline',{exact:true})).toHaveValue('swiss')
 await comparison.getByLabel('Second airline',{exact:true}).selectOption('lufthansa')
 await expect(page.getByRole('button',{name:'Remove Lufthansa',exact:true})).toBeVisible()
 await comparison.getByRole('slider',{name:'Comparison time UTC'}).focus()
 await comparison.getByRole('slider',{name:'Comparison time UTC'}).press('Home')
 await expect(page.getByRole('slider',{name:'Time of day UTC'})).toHaveValue('0')
 await page.getByRole('slider',{name:'Time of day UTC'}).fill('43200')
 await expect(page.getByRole('slider',{name:'Time of day UTC'})).toHaveValue('43200')
 await page.getByRole('button',{name:'View settings',exact:true}).click()
 await page.getByRole('button',{name:'Share scene',exact:true}).click()
 const link=await page.getByRole('textbox',{name:'Scene link'}).inputValue()
 expect(new URL(link).hash).toContain(`day=${manifest.date}`)
 expect(new URL(link).hash).toContain('compare=1')
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Save image',exact:true}).click();const download=await downloadPromise
 expect(download.suggestedFilename()).toBe(`luft-${manifest.date}-1200.png`)
 await download.saveAs(`test-results/${test.info().project.name}-${renderer}-scene.png`)
 const file=await download.path();const {readFile}=await import('node:fs/promises');const bytes=await readFile(file!)
 expect(bytes.subarray(1,4).toString()).toBe('PNG');expect(bytes.length).toBeGreaterThan(20000)
 const restored=await context.newPage();await restored.goto(link)
 await expect(restored.getByRole('button',{name:'Play',exact:true})).toBeEnabled()
 await expect(restored.getByRole('slider',{name:'Time of day UTC'})).toHaveValue('43200')
 await expect(restored.getByRole('region',{name:'Compare airlines'})).toBeVisible()
 await expect(restored.getByLabel('Second airline',{exact:true})).toHaveValue('lufthansa')
 await restored.getByRole('button',{name:'Minimise comparison'}).click()
 await expect(restored.getByRole('button',{name:'Expand comparison'})).toBeVisible()
 await expect(restored.getByRole('slider',{name:'Comparison time UTC'})).toHaveCount(0)
 await restored.getByRole('button',{name:'Close airline comparison'}).click()
 await expect(restored.getByRole('region',{name:'Compare airlines'})).toHaveCount(0)
 await restored.close();expect(errors).toEqual([])
})

test('old scene dates cannot silently replay a different recorded day',async({page})=>{
 await page.goto('./#day=2020-01-01&time=3600&flight=missing')
 await expect(page.getByText('This scene was recorded on 2020-01-01.')).toBeVisible()
 await expect(page.getByRole('button',{name:'Pause',exact:true})).toHaveCount(0)
 await page.getByRole('button',{name:'Explore the current day'}).click();await pauseAtStart(page)
})

test('scene links restore a selected aircraft, camera and display settings',async({page,context})=>{
 await page.goto('./#airports=LSZH');await pauseAtStart(page)
 await page.getByRole('button',{name:'ZRH board'}).click()
 await page.locator('.ms-split-flap-board__select').first().click()
 await expect(page.locator('.flight-caption')).toHaveAttribute('data-route-state','ready')
 const callsign=await page.locator('.flight-caption strong').innerText()
 await page.getByRole('button',{name:'Close airport board'}).click()
 await page.getByRole('button',{name:'Fit route',exact:true}).click()
 await page.getByRole('button',{name:'View settings',exact:true}).click()
 await page.getByLabel('Day / night shading',{exact:true}).uncheck()
 await page.getByLabel('Dim other flights',{exact:true}).uncheck()
 await page.getByRole('button',{name:'Share scene',exact:true}).click()
 const link=await page.getByRole('textbox',{name:'Scene link'}).inputValue(),params=new URLSearchParams(new URL(link).hash.slice(1))
 expect(params.get('flight')).toBeTruthy();expect(params.get('view')?.split(',')).toHaveLength(4)
 const restored=await context.newPage();await restored.goto(link)
 await expect(restored.getByRole('button',{name:'Play',exact:true})).toBeEnabled()
 await expect(restored.locator('.flight-caption strong')).toHaveText(callsign)
 await expect(restored.getByRole('slider',{name:'Time of day UTC'})).toHaveValue(params.get('time')!)
 await restored.getByRole('button',{name:'View settings',exact:true}).click()
 await expect(restored.getByLabel('Day / night shading',{exact:true})).not.toBeChecked()
 await expect(restored.getByLabel('Dim other flights',{exact:true})).not.toBeChecked()
 await restored.getByRole('button',{name:'Share scene',exact:true}).click()
 const again=new URLSearchParams(new URL(await restored.getByRole('textbox',{name:'Scene link'}).inputValue()).hash.slice(1))
 expect(again.get('view')).toBe(params.get('view'))
 expect(again.get('flight')).toBe(params.get('flight'))
 await restored.close()
})

test('comparison colours and aircraft survive image capture in both renderers',async({page})=>{
 await page.goto('./');await pauseAtStart(page)
 const result=await page.evaluate(async()=>{
  const {AirMap}=await import('/luft/src/map.ts' as string),{GpuAircraftPainter}=await import('/luft/src/gpu-aircraft.ts' as string)
  const outputs=[]
  for(const gpu of [false,true]){
   const host=document.createElement('div'),canvas=document.createElement('canvas');host.append(canvas);document.body.append(host);canvas.style.width='400px';canvas.style.height='400px'
   const map=new AirMap(canvas,{features:[]},[],{west:0,south:0,east:20,north:20}),failures:string[]=[]
   if(gpu)map.setPainter(new GpuAircraftPainter(host,(message:string)=>failures.push(message)))
   const tracks=[0,1].map(i=>({id:String(i),callsign:String(i),start:0,end:10,samples:[[0,5+i*8,10,12000,300],[10,5+i*8,10,12000,300]]}))
   const read=()=>{const image=map.snapshot(),ctx=image.getContext('2d')!;return [5,13].map(lon=>{const [x,y]=map.project(lon,10);return [...ctx.getImageData(Math.round(x*image.width/400),Math.round(y*image.height/400),1,1).data]})}
   map.setMotionEffectsEnabled(false);map.setComparison(new Map([['0',1],['1',2]]));map.draw(tracks,5,undefined,'motion',[]);const compared=read()
   map.setComparison();map.draw(tracks,5,undefined,'motion',[]);const ordinary=read()
   outputs.push({gpu,compared,ordinary,failures});map.dispose();host.remove()
  }
  return outputs
 })
 for(const {compared,ordinary,failures} of result){
  expect(failures).toEqual([])
  expect(compared[0][3]).toBeGreaterThan(0);expect(compared[1][3]).toBeGreaterThan(0)
  expect(compared[0][2]).toBeGreaterThan(compared[0][0])
  expect(compared[1][0]).toBeGreaterThan(compared[1][2])
  expect(ordinary[0][2]).toBeGreaterThan(ordinary[0][0]);expect(ordinary[1][2]).toBeGreaterThan(ordinary[1][0])
 }
})
