import {test,expect,type Page} from '@playwright/test'
import {pauseAtStart} from './playback-helpers'
const bucket=/\/flight-routes\/[0-9a-f]{2}\.json$/
async function openBoard(page:Page){
 await pauseAtStart(page)
 await page.getByRole('combobox',{name:'Search flights'}).fill('ZRH')
 await page.getByRole('option',{name:/^ZRH Zurich/}).click()
 await page.getByRole('button',{name:'ZRH board'}).click()
}
for(const renderer of ['canvas','three'])test(`${renderer}: selected flight loads a full route on demand, fits it and clears it`,async({page})=>{
 const routes:string[]=[],errors:string[]=[]
 page.on('request',request=>{if(bucket.test(request.url()))routes.push(request.url())});page.on('pageerror',error=>errors.push(error.message))
 await page.goto(`./?renderer=${renderer}`);await openBoard(page)
 expect(routes).toHaveLength(0)
 await page.locator('.ms-split-flap-board__select').first().click()
 await expect(page.locator('.flight-caption')).toHaveAttribute('data-route-state','ready')
 expect(routes).toHaveLength(1)
 await page.getByRole('button',{name:'Close airport board'}).click()
 const slider=page.getByRole('slider'),time=await slider.inputValue()
 await page.getByRole('button',{name:'Fit route',exact:true}).click()
 await expect(slider).toHaveValue(time);await expect(page.locator('.play')).toHaveText('Play')
 await expect(page.locator('.flight-caption')).toBeInViewport()
 await page.getByRole('button',{name:'Clear aircraft'}).click()
 await expect(page.locator('.flight-caption')).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Fit route',exact:true})).toHaveCount(0)
 expect(errors).toEqual([])
})
test('a failed route request can be retried without losing the selected flight',async({page})=>{
 await page.route(bucket,route=>route.fulfill({status:503,body:'unavailable'}))
 await page.goto('./');await openBoard(page)
 await page.locator('.ms-split-flap-board__select').first().click()
 await expect(page.locator('.flight-caption')).toHaveAttribute('data-route-state','error')
 const flight=await page.locator('.flight-caption strong').innerText()
 await page.getByRole('button',{name:'Close airport board'}).click()
 await page.unroute(bucket);await page.getByRole('button',{name:'Retry route'}).click()
 await expect(page.locator('.flight-caption')).toHaveAttribute('data-route-state','ready')
 await expect(page.locator('.flight-caption strong')).toHaveText(flight)
})
