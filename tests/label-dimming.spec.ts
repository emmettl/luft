import {test,expect} from '@playwright/test'
import {pauseAtStart} from './playback-helpers'

test('unconnected labels dim with flight selection and recover on clear',async({page})=>{
 await page.setViewportSize({width:1280,height:800});await page.goto('./');await pauseAtStart(page)
 const search=page.getByRole('combobox',{name:'Search flights'})
 await search.fill('LHR ZRH');await page.getByRole('option',{name:/LHR ↔ ZRH/}).click()
 await expect.poll(()=>page.locator('.airport-map-label[data-dimmed=true]').count()).toBeGreaterThan(0)
 const opacity=await page.locator('.airport-map-label[data-dimmed=true]').first().evaluate(e=>Number(getComputedStyle(e).opacity))
 expect(opacity).toBeGreaterThan(.3);expect(opacity).toBeLessThan(.7)
 await search.fill('ZRH');await page.getByRole('option',{name:/^ZRH Zurich/}).click()
 await expect(page.locator('.airport-map-label[aria-pressed=true]')).toHaveAttribute('aria-label',/ZRH/)
 await expect(page.locator('.airport-map-label[aria-pressed=true]')).not.toHaveAttribute('data-dimmed','true')
 await page.getByRole('button',{name:'Clear all',exact:true}).click()
 await expect(page.locator('.airport-map-label[data-dimmed=true]')).toHaveCount(0)
 await search.fill('Switzerland');await page.getByRole('option',{name:/^Switzerland /}).click()
 await expect.poll(()=>page.locator('.airport-map-label[data-country-highlighted=true]').count()).toBeGreaterThan(0)
 await expect(page.locator('.airport-map-label[data-country-highlighted=true][data-dimmed=true]')).toHaveCount(0)
})
