import {pauseAtStart} from './playback-helpers'
import {test,expect} from '@playwright/test'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

test('evicted decoded chunks reuse verified disk data without another request',async({page})=>{
 const requests=new Map<string,number>()
 page.on('request',request=>{const path=new URL(request.url()).pathname;if(/chunk-\d+\.json\.gz\.bin$/.test(path))requests.set(path,(requests.get(path)??0)+1)})
 await page.goto('./');await pauseAtStart(page)
 const saved=()=>page.evaluate(async()=>{const cache=await caches.open('luft-track-data-v1');return (await cache.keys()).length})
 await expect.poll(saved).toBe(4)
 const original=new Map(requests)
 await page.getByRole('slider').fill('43200');await expect(page.getByRole('slider')).toHaveValue('43200');await expect.poll(saved).toBe(8)
 await page.getByRole('slider').fill('25200');await expect(page.getByRole('slider')).toHaveValue('25200')
 await page.getByRole('button',{name:'Device details'}).click()
 await expect(page.locator('.diagnostics')).toContainText('4 / 4 chunks in memory')
 await expect(page.locator('.diagnostics')).toContainText('4 cache hits')
 for(const [path,count] of original)expect(requests.get(path)).toBe(count)

})

test('storage failure keeps ordinary playback and reports the fallback',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(window,'caches',{value:{open:async()=>{throw new DOMException('blocked','SecurityError')}},configurable:true})})
 await page.goto('./');await pauseAtStart(page)
 await page.getByRole('button',{name:'Device details'}).click()
 await expect(page.locator('.diagnostics')).toContainText('Local storage unavailable')
 await page.getByRole('button',{name:'Device details'}).click()
 await page.getByRole('button',{name:'Play',exact:true}).click()
 await expect.poll(async()=>Number(await page.getByRole('slider').inputValue())).toBeGreaterThan(25200)
})

// WebKit's ephemeral test contexts discard Cache Storage when the page closes.
// Use a real isolated profile to exercise persistence, without touching user data.
test('saved chunks survive reload in a persistent browser profile',async({playwright,browserName},info)=>{
 const profile=await mkdtemp(join(tmpdir(),'luft-cache-test-'))
 const context=await playwright[browserName].launchPersistentContext(profile,{headless:true,baseURL:String(info.project.use.baseURL),viewport:info.project.use.viewport})
 try{
  const page=await context.newPage();let requests=0
  page.on('request',r=>{if(/chunk-\d+\.json\.gz\.bin$/.test(new URL(r.url()).pathname))requests++})
  await page.goto('./');await pauseAtStart(page)
  await expect.poll(()=>page.evaluate(async()=>{const c=await caches.open('luft-track-data-v1');return (await c.keys()).length})).toBe(4)
  const before=requests
  await page.reload();await pauseAtStart(page)
  await page.getByRole('button',{name:'Device details'}).click()
  await expect(page.locator('.diagnostics')).toContainText('4 cache hits')
  await expect(page.locator('.diagnostics')).toContainText('0.0 MiB track response data')
  expect(requests).toBe(before)
 }finally{await context.close();await rm(profile,{recursive:true,force:true})}
})
