import {pauseAtStart} from './playback-helpers'
import {test,expect} from '@playwright/test'

test('repeatable renderer work profile',async({page},info)=>{
 test.setTimeout(240000)
 test.skip(!process.env.LUFT_GPU_PROFILE||info.project.name!=='chromium','Opt-in local work evidence, not a device performance gate')
 await page.goto('./');await pauseAtStart(page)
 const reports=await page.evaluate(async()=>{
  // Replay identical times and inputs outside the UI, with one frame per browser tick.
  const {AirMap}=await import('/luft/src/map.ts' as string)
  const {GpuAircraftPainter}=await import('/luft/src/gpu-aircraft.ts' as string)
  const {AirMap:OldMap}=await import('/luft/tests/fixtures/v020/map.ts' as string)
  const {GpuAircraftPainter:OldPainter}=await import('/luft/tests/fixtures/v020/gpu-aircraft.ts' as string)
  const {loadRelease,verifiedJson}=await import('/luft/src/data.ts' as string)
  const release=await loadRelease(),chunk=await verifiedJson(release.manifest.chunks[42])
  const host=document.createElement('div');host.style.cssText='position:fixed;inset:0;z-index:99999;background:#07121b';document.body.append(host)
  const canvas=document.createElement('canvas');canvas.style.cssText='width:100%;height:100%';host.append(canvas)
  const results=[]
  for(const renderer of ['canvas','three-v020','three-retained']){
   const map=renderer==='three-v020'?new OldMap(canvas,release.land,release.index.airports):new AirMap(canvas,release.land,release.index.airports)
   if(renderer!=='canvas'){const Painter=renderer==='three-v020'?OldPainter:GpuAircraftPainter;map.setPainter(new Painter(host,(message:string)=>{throw Error(message)}))}
   for(let frame=0;frame<80;frame++){
    await new Promise(requestAnimationFrame)
    map.draw(chunk.tracks,25200+frame*3,undefined,'motion',release.index.cells[7])
    if(frame===9){map.durations=[];if(map.stages)map.stages=[]}
   }
   const p95=(values:number[])=>values.toSorted((a,b)=>a-b)[Math.floor(values.length*.95)]??0
   results.push({renderer,frames:map.durations.length,cpuP95:p95(map.durations),stages:map.stages?Object.fromEntries(['setup','sampling','geometry','submission'].map(key=>[key,p95((map.stages??[]).map((s:Record<string,number>)=>s[key]))])):null,gpu:map.gpuStats()});map.dispose()
  }
  host.remove();return results
 })
 const output={label:process.env.LUFT_GPU_PROFILE,browser:page.context().browser()?.version(),viewport:page.viewportSize(),reports}
 console.log('LUFT_GPU_PROFILE '+JSON.stringify(output));await info.attach('gpu-profile.json',{body:JSON.stringify(output,null,2),contentType:'application/json'})
})
