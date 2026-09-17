import {test,expect} from '@playwright/test'
import {pauseAtStart} from './playback-helpers'
import {manifest} from './release-expectations'
test('offers the newer recorded day without changing the active playback or filters',async({page})=>{
 const next=new Date(Date.parse(`${manifest.date}T00:00:00Z`)+86400000).toISOString().slice(0,10)
 await page.route('**/feed.json',route=>route.fulfill({json:{date:next}}))
 await page.goto('./#airlines=swiss');await pauseAtStart(page)
 await expect(page.getByRole('button',{name:`New recorded day · ${next} · Refresh`})).toBeVisible()
 await expect(page.getByRole('slider')).toHaveValue('25200')
 await expect(page.getByRole('button',{name:'Remove SWISS',exact:true})).toBeVisible()
})
test('an unavailable freshness check does not interrupt the current day',async({page})=>{
 await page.route('**/feed.json',route=>route.abort())
 await page.goto('./');await pauseAtStart(page)
 await expect(page.locator('.new-day')).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled()
})
