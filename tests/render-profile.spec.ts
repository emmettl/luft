import {test,expect} from '@playwright/test'

test('local Canvas work profile',async({page},info)=>{
 test.skip(!process.env.LUFT_PROFILE,'Opt-in measurement, not a device performance gate')
 await page.addInitScript(()=>{
  const counters:Record<string,number>={};(window as any).__canvasWork=counters
  for(const method of ['clearRect','lineTo','stroke','fill','drawImage'] as const){
   const original=CanvasRenderingContext2D.prototype[method]
   ;(CanvasRenderingContext2D.prototype as any)[method]=function(...args:unknown[]){
    if(this.canvas.matches('.stage canvas'))counters[method]=(counters[method]??0)+1
    return Reflect.apply(original,this,args)
   }
  }
 })
 await page.goto('./');await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled()
 const results=[]
 for(const view of ['Europe','Britain']){
  await page.getByRole('button',{name:view,exact:true}).click()
  await page.getByRole('slider').fill('25200');await expect(page.getByRole('slider')).toHaveValue('25200')
  await page.waitForTimeout(300)
  const before=await page.evaluate(()=>({...(window as any).__canvasWork}))
  await page.waitForTimeout(1000)
  const idle=await page.evaluate(()=>({...(window as any).__canvasWork}))
  await page.getByRole('combobox',{name:'Playback speed'}).selectOption('900')
  await page.getByRole('button',{name:'Play',exact:true}).click()
  await page.waitForTimeout(2500)
  await page.getByRole('button',{name:'Pause',exact:true}).click()
  const playing=await page.evaluate(()=>({...(window as any).__canvasWork}))
  const delta=(a:Record<string,number>,b:Record<string,number>)=>Object.fromEntries(Object.keys(a).map(key=>[key,a[key]-(b[key]??0)]))
  await page.getByRole('button',{name:'Device details'}).click()
  results.push({view,idleWork:delta(idle,before),playingWork:delta(playing,idle),diagnostics:await page.locator('.diagnostics').innerText()})
  await page.getByRole('button',{name:'Device details'}).click()
 }
 const output={project:info.project.name,browser:page.context().browser()?.version(),viewport:page.viewportSize(),results}
 console.log('LUFT_RENDER_PROFILE '+JSON.stringify(output))
 await info.attach('render-profile.json',{body:JSON.stringify(output,null,2),contentType:'application/json'})
})
