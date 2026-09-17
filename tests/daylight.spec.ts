import {test,expect} from '@playwright/test'
import {pauseAtStart} from './playback-helpers'
import {frameText} from './release-expectations'

for(const renderer of ['canvas','three'])test(`${renderer}: daylight toggles redraw paused map without changing playback or counts`,async({page})=>{
 await page.goto(`./?renderer=${renderer}`);await pauseAtStart(page)
 await page.getByRole('slider').fill('0')
 await expect(page.getByRole('slider')).toHaveValue('0')
 await expect(page.locator('.stream-status')).toHaveText('Paused')
 // The pinned day's midnight count arrives on the throttled map/UI update.
 // A count merely different from the autoplay frame can still belong to 07:00.
 await expect(page.locator('.count')).toHaveText(`${frameText(0)} over Europe`)
 await page.getByRole('button',{name:'View settings',exact:true}).click()
 await expect(page.getByRole('combobox',{name:'Aircraft renderer'})).toHaveValue(renderer)
 const toggle=page.getByRole('checkbox',{name:'Day / night shading'})
 await expect(toggle).toBeChecked()
 const pixel=()=>page.locator('.stage>canvas').first().evaluate((canvas:HTMLCanvasElement)=>Array.from(canvas.getContext('2d')!.getImageData(4,4,1,1).data))
 const count=await page.locator('.count').innerText(),shaded=await pixel()
 expect(shaded[3]).toBeGreaterThan(0)
 await toggle.uncheck()
 await expect.poll(pixel).not.toEqual(shaded)
 await expect(page.locator('.count')).toHaveText(count)
 await expect(page.getByRole('slider')).toHaveValue('0')
 await toggle.check();await expect.poll(pixel).toEqual(shaded)
 await page.getByRole('button',{name:'Hour density',exact:true}).click()
 await expect(page.getByRole('slider')).toHaveValue('0')
 // Mode changes reach the retained canvas on its next 30 Hz paint, after React.
 await page.waitForTimeout(100)
 const density=await pixel()
 await page.getByRole('slider').fill('1000');await expect.poll(pixel).toEqual(density)
 await page.getByRole('slider').fill('43200');await expect.poll(pixel).not.toEqual(density)
})
