import {expect,type Page} from '@playwright/test'
export async function pauseAtStart(page:Page){
 await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeEnabled()
 await page.getByRole('button',{name:'Pause',exact:true}).click()
 await page.getByRole('slider').fill('25200')
 await expect(page.getByRole('slider')).toHaveValue('25200')
 // The slider updates before the 30 Hz map paint; wait for the pinned 07:00 frame.
 await expect(page.locator('.count')).toHaveText('2,724 aircraft over Europe')
}
