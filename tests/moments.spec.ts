import {test,expect} from '@playwright/test'
import {readFileSync} from 'node:fs'
import {pauseAtStart} from './playback-helpers'
import {selectedTracks} from './release-expectations'
import {selectionActivity,type SnapshotIndex} from '../src/filters'

const snapshots=JSON.parse(readFileSync('src/generated/snapshots.json','utf8')) as SnapshotIndex
const peakFor=(airlines?:['swiss'])=>selectionActivity(selectedTracks(airlines?{airlines}:{}),snapshots).bins.reduce((best,bin)=>bin.count>best.count?bin:best)

test('moments use recorded counts and jump from density to paused motion without losing filters',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
 await page.goto('./');await pauseAtStart(page)
 const panel=page.getByRole('region',{name:'Moments',exact:true})
 const toggle=panel.getByRole('button',{name:/Moments.*to explore/})
 await toggle.focus();await toggle.press('Enter')
 await expect(panel.locator('.moment')).toHaveCount(4)
 const peak=panel.locator('[data-moment="peak"]')
 const allPeak=peakFor()
 await expect(peak).toHaveAttribute('data-time',String(allPeak.time))
 await expect(peak).toContainText(`${allPeak.count.toLocaleString('en-GB')} aircraft observed`)
 const search=page.getByRole('combobox',{name:'Search flights'})
 await search.fill('SWISS');await page.getByRole('option',{name:/^SWISS/}).click()
 const filteredPeak=peakFor(['swiss'])
 await expect(panel.locator('.moments-scope')).toContainText('Your selection')
 await expect(peak).toHaveAttribute('data-time',String(filteredPeak.time))
 await expect(peak).toContainText(`${filteredPeak.count.toLocaleString('en-GB')} aircraft observed`)
 await page.getByRole('button',{name:'View settings',exact:true}).click()
 await page.getByRole('button',{name:'Hour density',exact:true}).click()
 await page.getByRole('button',{name:'Close view settings',exact:true}).click()
 await peak.scrollIntoViewIfNeeded();await peak.press('Enter')
 await expect(page.getByRole('slider')).toHaveValue(String(filteredPeak.time))
 await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled()
 await expect(page.locator('.count')).toContainText('SWISS')
 await expect(page.locator('.count')).not.toContainText('density')
 await expect(page.getByRole('button',{name:'Remove SWISS',exact:true})).toBeVisible()
 if(page.viewportSize()!.width<=999){
  await expect(toggle).toHaveAttribute('aria-expanded','false')
  await expect(toggle).toBeFocused()
  await toggle.click()
 }
 await toggle.click();await toggle.click()
 await expect(peak).toHaveAttribute('data-time',String(filteredPeak.time))
 await page.getByRole('button',{name:'Clear all',exact:true}).click()
 await expect(peak).toHaveAttribute('data-time',String(allPeak.time))
 await expect(panel.locator('.moments-scope')).toContainText('Across the study area')
 expect(errors).toEqual([])
})

test('moments and insights remain scrollable above playback on desktop and phone',async({page})=>{
 await page.goto('./');await pauseAtStart(page)
 await page.getByRole('button',{name:/Moments.*to explore/}).click()
 await page.screenshot({path:`test-results/${test.info().project.name}-moments.png`,fullPage:true})
 await page.getByRole('button',{name:/Insights Recorded day/}).click()
 for(const selector of ['.moment','.insight-row']){
  const last=page.locator(selector).last();await last.scrollIntoViewIfNeeded()
  const box=await last.boundingBox(),dock=await page.locator('footer').boundingBox()
  expect(box!.y).toBeGreaterThan(0)
  expect(box!.y+box!.height).toBeLessThan(dock!.y)
 }
 const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}))
 expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width)
 await page.screenshot({path:`test-results/${test.info().project.name}-moments-insights.png`,fullPage:true})
})
