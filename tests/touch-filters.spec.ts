import {aircraftText} from './release-expectations'
import {test,expect} from '@playwright/test'
import {pauseAtStart} from './playback-helpers'

test.use({hasTouch:true,viewport:{width:390,height:664}})

test('a touch selects once even when the browser never delivers a compatibility click',async({page})=>{
 await page.goto('./');await pauseAtStart(page)
 // Desktop touch emulation normally supplies a click. Remove that fallback
 // to cover the missing activation reported on iPhone.
 await page.evaluate(()=>document.addEventListener('click',event=>{
  if((event.target as Element).closest('[role="option"]')){
   event.preventDefault();event.stopImmediatePropagation()
  }
 },true))
 const search=page.getByRole('combobox',{name:'Search flights'})
 for(const [query,name,pill] of [['Switzerland',/^Switzerland/,'Switzerland'],['SWISS',/^SWISS/,'SWISS'],['ZRH',/^ZRH Zurich/,'ZRH'],['LHR ZRH',/^LHR ↔ ZRH/,'LHR ↔ ZRH']] as const){
  await search.tap();await search.fill(query)
  await page.getByRole('option',{name}).tap()
  await expect(page.getByRole('button',{name:`Remove ${pill}`,exact:true})).toHaveCount(1)
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(search).not.toBeFocused()
 }
 await expect(page.locator('.filter-pill')).toHaveCount(4)
 await expect(page.locator('.play')).toHaveText('Play')
})

test('touch selection survives the search keyboard blurring before activation',async({page})=>{
 await page.goto('./');await pauseAtStart(page)
 const search=page.getByRole('combobox',{name:'Search flights'})
 // iOS can dismiss the keyboard before delivering the result's click, with
 // no related focus target. Exercise that ordering in both browser engines.
 await page.evaluate(()=>document.addEventListener('pointerup',event=>{
  if((event.target as Element).closest('[role="option"]'))(document.querySelector('[role="combobox"]') as HTMLInputElement).blur()
 },true))
 for(const [query,name,pill] of [['SWISS',/^SWISS/,'SWISS'],['ZRH',/^ZRH Zurich/,'ZRH'],['LHR ZRH',/^LHR ↔ ZRH/,'LHR ↔ ZRH']] as const){
  await search.tap();await search.fill(query)
  await page.getByRole('option',{name}).tap()
  await expect(page.getByRole('button',{name:`Remove ${pill}`,exact:true})).toBeVisible()
  await expect(page.getByRole('listbox')).toHaveCount(0)
 }
 await expect(page.locator('.count')).toContainText('SWISS')
 await expect(page.locator('.ms-study-timeline__heading')).toContainText('LHR ↔ ZRH')
 await page.getByRole('button',{name:'Remove ZRH',exact:true}).tap()
 await expect(page.locator('.filter-pill')).toHaveCount(2)
 await page.getByRole('button',{name:'Clear all',exact:true}).tap()
 await expect(page.locator('.filter-pill')).toHaveCount(0)
})

test('scrolling, dragging, multiple fingers and cancellation never select a touched result',async({page})=>{
 await page.goto('./');await pauseAtStart(page)
 await page.getByRole('combobox',{name:'Search flights'}).tap()
 const option=page.getByRole('option',{name:/^LHR London/})
 for(const gesture of ['drag','scroll','multitouch','cancel','pointercancel','release-outside'] as const){
  await option.evaluate((button,gesture)=>{
   const panel=button.closest('.search-popover')!,bounds=button.getBoundingClientRect()
   const point={identifier:1,clientX:bounds.left+20,clientY:bounds.top+20,target:button}
   const send=(type:string,touches:typeof point[],changedTouches=touches)=>button.dispatchEvent(Object.assign(new Event(type,{bubbles:true,cancelable:true}),{touches,changedTouches}))
   send('touchstart',[point])
   if(gesture==='drag'){
    send('touchmove',[{...point,clientY:point.clientY+30}])
    send('touchmove',[point]) // Returning to the starting point is still a drag.
   }
   if(gesture==='scroll')panel.scrollTop+=20
   if(gesture==='multitouch'){
    send('touchstart',[point,{...point,identifier:2}])
    send('touchend',[point],[{...point,identifier:2}])
   }
   if(gesture==='cancel')send('touchcancel',[],[point])
   if(gesture==='pointercancel')button.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerType:'touch'}))
   send('touchend',[],[gesture==='release-outside'?{...point,clientX:bounds.right+20}:point])
   panel.scrollTop=0
  },gesture)
  await expect(page.locator('.filter-pill')).toHaveCount(0)
  await expect(option).toBeVisible()
 }
 // Rejected gestures must not disable the next actual tap.
 await option.tap()
 await expect(page.getByRole('button',{name:'Remove LHR',exact:true})).toHaveCount(1)
})

test('mouse and keyboard activation still select search results',async({page})=>{
 await page.goto('./');await pauseAtStart(page)
 const search=page.getByRole('combobox',{name:'Search flights'})
 await search.fill('SWISS');await page.getByRole('option',{name:/^SWISS/}).click()
 await expect(page.getByRole('button',{name:'Remove SWISS',exact:true})).toHaveCount(1)
 await search.fill('ZRH');await search.press('Enter')
 await expect(page.getByRole('button',{name:'Remove ZRH',exact:true})).toHaveCount(1)
 await search.fill('easyJet')
 const option=page.getByRole('option',{name:/^easyJet/})
 await option.focus();await option.press('Space')
 await expect(page.getByRole('button',{name:'Remove easyJet',exact:true})).toHaveCount(1)
})

test('native touch taps add filters while cancelled gestures and outside taps only dismiss',async({page})=>{
 await page.goto('./');await pauseAtStart(page)
 const search=page.getByRole('combobox',{name:'Search flights'})
 await search.tap();await search.fill('SWISS')
 await page.getByRole('option',{name:/^SWISS/}).tap()
 await expect(page.locator('.selection-summary')).toContainText(aircraftText({airlines:['swiss']}))
 await search.tap();await search.fill('easyJet')
 const option=page.getByRole('option',{name:/^easyJet/})
 await option.dispatchEvent('pointerdown',{pointerType:'touch',pointerId:9,isPrimary:true,bubbles:true})
 await option.dispatchEvent('pointercancel',{pointerType:'touch',pointerId:9,isPrimary:true,bubbles:true})
 await expect(page.locator('.filter-pill')).toHaveCount(1)
 await expect(option).toBeVisible()
 await page.locator('.play').tap()
 await expect(page.getByRole('listbox')).toHaveCount(0)
 await search.tap();await search.fill('easyJet');await option.tap()
 await expect(page.locator('.selection-summary')).toContainText(aircraftText({airlines:['swiss','easyjet']}))
 await search.tap();await search.press('Escape');await expect(page.getByRole('listbox')).toHaveCount(0)
 await search.tap()
 // Explicit keyboard focus leaving the widget also dismisses the results.
 await page.locator('.play').focus();await expect(page.getByRole('listbox')).toHaveCount(0)
})

test('untyped airline suggestions receive taps above the phone playback dock',async({page})=>{
 await page.goto('./');await pauseAtStart(page)
 await page.getByRole('combobox',{name:'Search flights'}).tap()
 const swiss=page.getByRole('option',{name:/^SWISS/})
 await swiss.scrollIntoViewIfNeeded()
 const option=await swiss.boundingBox(),dock=await page.locator('footer').boundingBox()
 expect(option!.y+option!.height).toBeGreaterThan(dock!.y)
 await swiss.tap()
 await expect(page.locator('.selection-summary')).toContainText(aircraftText({airlines:['swiss']}))
 await expect(page.getByRole('button',{name:'Remove SWISS',exact:true})).toBeVisible()
 await expect(page.getByRole('listbox')).toHaveCount(0)
})
