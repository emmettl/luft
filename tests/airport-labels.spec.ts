import {test,expect} from '@playwright/test'
import {pauseAtStart} from './playback-helpers'
test.use({hasTouch:true})
test('airport codes fit completely inside their labels',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('./');await pauseAtStart(page)
 const labels=page.locator('.airport-map-label');await expect.poll(()=>labels.count()).toBeGreaterThan(0)
 await page.getByRole('button',{name:'Britain',exact:true}).click()
 await expect.poll(()=>labels.count()).toBeGreaterThan(10)
 const clipped=await labels.evaluateAll(elements=>elements.flatMap(element=>{
  const span=element.querySelector('span')!,range=document.createRange();range.selectNodeContents(span)
  const available=span.getBoundingClientRect().width,needed=range.getBoundingClientRect().width
  const allowance=element.getBoundingClientRect().right-parseFloat(getComputedStyle(element).paddingRight)-span.getBoundingClientRect().left
  // Integer scroll/client widths miss Safari's subpixel overflow (20.40px into 20.09px).
  return needed>available+.01||needed+1>allowance?[{text:span.textContent,available,needed,allowance}]:[]
 }))
 expect(clipped).toEqual([])
})
test('hierarchical airport labels add filters and boards with pointer and keyboard in either renderer',async({page})=>{
 await page.goto('./');await pauseAtStart(page)
 const labels=page.locator('.airport-map-label')
 await expect.poll(()=>labels.count()).toBeGreaterThan(0)
 const label=labels.first(),name=await label.getAttribute('aria-label'),code=name!.split(' ')[2]
 await label.click()
 await expect(page.getByRole('button',{name:`Remove ${code}`,exact:true})).toBeVisible()
 await expect(page.getByRole('region',{name:`${code} airport board`})).toBeVisible()
 await page.getByRole('button',{name:'Close airport board'}).click()
 await page.getByRole('button',{name:'Clear all',exact:true}).click()
 await page.getByRole('button',{name:'View settings',exact:true}).click();await page.getByLabel('Aircraft renderer').selectOption('three');await page.getByRole('button',{name:'Close view settings'}).click()
 await expect(page.locator('.gpu-layer')).toBeVisible()
 await labels.first().focus();await page.keyboard.press('Enter')
 await expect(page.locator('.airport-panel')).toBeVisible();await expect(page.locator('.filter-pill')).toHaveCount(1)
})
test('label boxes avoid each other and fixed UI; zoom reveals more airports without per-clock relayout',async({page})=>{
 await page.goto('./');await pauseAtStart(page)
 await expect.poll(()=>page.locator('.airport-map-label').count()).toBeGreaterThan(0)
 const overlap=await page.evaluate(()=>{
  const boxes=[...document.querySelectorAll('.airport-map-label')].map(e=>e.getBoundingClientRect())
  const controls=[...document.querySelectorAll('.study>header .identity,.study>header .date,.selection-tools,.insights-panel,.map-caption,.view-controls,.study>footer')].map(e=>e.getBoundingClientRect())
  const collides=(a:DOMRect,b:DOMRect)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top
  return boxes.some((a,i)=>a.width<44||a.height<44||boxes.slice(i+1).some(b=>collides(a,b))||controls.some(b=>collides(a,b)))
 })
 expect(overlap).toBe(false)
 const before=await page.locator('.airport-labels').innerHTML()
 await page.locator('.play').click();const start=await page.getByRole('slider').inputValue()
 await expect.poll(()=>page.getByRole('slider').inputValue()).not.toBe(start)
 expect(await page.locator('.airport-labels').innerHTML()).toBe(before)
 await page.locator('.play').click();await page.getByRole('button',{name:'Britain',exact:true}).click()
 await expect.poll(()=>page.locator('.airport-labels').innerHTML()).not.toBe(before)
})
test('touch label taps select airports while dragging from a label pans without selecting',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('./');await pauseAtStart(page)
 const labels=page.locator('.airport-map-label');await expect.poll(()=>labels.count()).toBeGreaterThan(0)
 const first=labels.first(),box=(await first.boundingBox())!
 await page.evaluate(()=>{HTMLButtonElement.prototype.setPointerCapture=()=>{}})
 await first.dispatchEvent('pointerdown',{pointerId:1,clientX:box.x+20,clientY:box.y+22,pointerType:'touch'})
 await first.dispatchEvent('pointermove',{pointerId:1,clientX:box.x+24,clientY:box.y+23,pointerType:'touch'})
 await first.dispatchEvent('pointerup',{pointerId:1,clientX:box.x+24,clientY:box.y+23,pointerType:'touch'})
 await expect(page.locator('.filter-pill')).toHaveCount(0)
 const target=labels.first();const name=await target.getAttribute('aria-label'),code=name!.split(' ')[2]
 await target.tap()
 await expect(page.getByRole('button',{name:`Remove ${code}`,exact:true})).toBeVisible()
 await expect(page.locator('.airport-panel')).toBeVisible()
})
