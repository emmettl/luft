import {test,expect} from '@playwright/test'
import {pauseAtStart} from './playback-helpers'

test.use({hasTouch:true,viewport:{width:390,height:664}})

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

test('native touch taps add filters while cancelled gestures and outside taps only dismiss',async({page})=>{
 await page.goto('./');await pauseAtStart(page)
 const search=page.getByRole('combobox',{name:'Search flights'})
 await search.tap();await search.fill('SWISS')
 await page.getByRole('option',{name:/^SWISS/}).tap()
 await expect(page.locator('.selection-summary')).toContainText('97 aircraft')
 await search.tap();await search.fill('easyJet')
 const option=page.getByRole('option',{name:/^easyJet/})
 await option.dispatchEvent('pointerdown',{pointerType:'touch',pointerId:9,isPrimary:true,bubbles:true})
 await option.dispatchEvent('pointercancel',{pointerType:'touch',pointerId:9,isPrimary:true,bubbles:true})
 await expect(page.locator('.filter-pill')).toHaveCount(1)
 await expect(option).toBeVisible()
 await page.locator('.play').tap()
 await expect(page.getByRole('listbox')).toHaveCount(0)
 await search.tap();await search.fill('easyJet');await option.tap()
 await expect(page.locator('.selection-summary')).toContainText('458 aircraft')
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
 await expect(page.locator('.selection-summary')).toContainText('97 aircraft')
 await expect(page.getByRole('button',{name:'Remove SWISS',exact:true})).toBeVisible()
 await expect(page.getByRole('listbox')).toHaveCount(0)
})
