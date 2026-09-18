import {test,expect} from '@playwright/test'
import {pauseAtStart} from './playback-helpers'

test('sound is opt-in, fades to suspended, and stays controllable in Watch mode',async({page})=>{
 await page.addInitScript(()=>{
  const contexts:AudioContext[]=[]
  Object.assign(window,{soundContexts:contexts})
  const Original=window.AudioContext
  window.AudioContext=class extends Original{constructor(){super();contexts.push(this)}}
  HTMLElement.prototype.requestFullscreen=()=>Promise.reject(new Error('Unavailable'))
 })
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
 await page.goto('./');await pauseAtStart(page)
 const sound=page.getByRole('button',{name:'Sound',exact:true})
 await expect(sound).toHaveAttribute('aria-pressed','false')
 expect(await page.evaluate(()=>(window as any).soundContexts.length)).toBe(0)
 await sound.click()
 await expect(sound).toHaveAttribute('title','Turn off ambient soundtrack')
 expect(await page.evaluate(()=>(window as any).soundContexts[0].state)).toBe('running')
 // The soundtrack is independent of the paused map clock.
 await expect(page.locator('.play')).toHaveText('Play')
 await page.getByRole('button',{name:'Enter watch mode'}).click()
 await expect(sound).toBeVisible();await expect(sound).toHaveAttribute('aria-pressed','true')
 await sound.click();await expect(sound).toHaveAttribute('aria-pressed','false')
 await expect.poll(()=>page.evaluate(()=>(window as any).soundContexts[0].state)).toBe('suspended')
 // A restart during a fade must cancel the pending suspension and reuse the graph.
 await sound.click();await expect(sound).toHaveAttribute('title','Turn off ambient soundtrack')
 await sound.click();await sound.click()
 await expect(sound).toHaveAttribute('title','Turn off ambient soundtrack')
 await page.waitForTimeout(1600)
 expect(await page.evaluate(()=>(window as any).soundContexts.map((c:AudioContext)=>c.state))).toEqual(['running'])
 await page.getByRole('button',{name:'Exit watch mode'}).click()
 await expect(sound).toHaveAttribute('aria-pressed','true')
 await page.evaluate(()=>{
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>true})
  document.dispatchEvent(new Event('visibilitychange'))
 })
 await expect(sound).toHaveAttribute('aria-pressed','false')
 await expect.poll(()=>page.evaluate(()=>(window as any).soundContexts[0].state)).toBe('suspended')
 await page.evaluate(()=>{delete (document as any).hidden;document.dispatchEvent(new Event('visibilitychange'))})
 await expect(sound).toHaveAttribute('aria-pressed','false')
 expect(errors).toEqual([])
})

test('audio failure leaves playback usable and Sound can retry',async({page})=>{
 await page.addInitScript(()=>{
  const original=AudioContext.prototype.resume
  let fail=true
  AudioContext.prototype.resume=function(){if(fail){fail=false;return Promise.reject(new Error('Unavailable'))}return original.call(this)}
 })
 await page.goto('./');await pauseAtStart(page)
 const sound=page.getByRole('button',{name:'Sound',exact:true})
 await sound.click();await expect(page.getByText('Sound unavailable. Tap Sound to retry.')).toBeVisible()
 await expect(sound).toHaveAttribute('aria-pressed','false')
 await sound.click();await expect(sound).toHaveAttribute('title','Turn off ambient soundtrack')
 await page.getByRole('button',{name:'Play',exact:true}).click()
 await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeEnabled()
})

test('the composed loop has stereo audio, headroom and a continuous seam',async({page})=>{
 await page.goto('./');await pauseAtStart(page)
 const result=await page.evaluate(async()=>{
  const {renderSoundtrack}=await import('/luft/src/soundtrack.ts')
  const buffer:AudioBuffer=await renderSoundtrack()
  return {duration:buffer.duration,channels:buffer.numberOfChannels,stats:Array.from({length:2},(_,channel)=>{
   const samples=buffer.getChannelData(channel)
   let peak=0,energy=0,step=0,finite=true
   for(let i=0;i<samples.length;i++){
    peak=Math.max(peak,Math.abs(samples[i]));energy+=samples[i]**2
    if(i)step=Math.max(step,Math.abs(samples[i]-samples[i-1]))
    if(!Number.isFinite(samples[i]))finite=false
   }
   return {peak,rms:Math.sqrt(energy/samples.length),finite,step,seam:Math.abs(samples[0]-samples[samples.length-1])}
  })}
 })
 expect(result.duration).toBe(64);expect(result.channels).toBe(2)
 for(const channel of result.stats){
  expect(channel.finite).toBe(true);expect(channel.peak).toBeLessThan(.8)
  expect(channel.rms).toBeGreaterThan(.015)
  expect(channel.seam).toBeLessThan(channel.step)
  expect(channel.seam).toBeLessThan(.02)
 }
})
