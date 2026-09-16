import {expect,type Page} from '@playwright/test'
export async function pauseAtStart(page:Page){
 await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeEnabled()
 await page.getByRole('button',{name:'Pause',exact:true}).click()
 await page.getByRole('slider').fill('25200')
 await expect(page.getByRole('slider')).toHaveValue('25200')
}
