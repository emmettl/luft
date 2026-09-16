import {test,expect} from '@playwright/test'

test('Space toggles playback once per press without scrolling or stealing control keys',async({page})=>{
 await page.goto('./')
 const play=page.locator('.play')
 await expect(play).toBeEnabled()
 // An unfocused map/background owns the playback shortcut.
 await page.locator('canvas').click({position:{x:10,y:10},force:true})
 const scroll=await page.evaluate(()=>({x:scrollX,y:scrollY}))
 await page.keyboard.down('Space')
 await expect(play).toHaveText('Pause')
 await page.keyboard.down('Space')
 await expect(play).toHaveText('Pause')
 await page.keyboard.up('Space')
 await page.keyboard.press('Space')
 await expect(play).toHaveText('Play')
 expect(await page.evaluate(()=>({x:scrollX,y:scrollY}))).toEqual(scroll)
 await page.keyboard.press('Shift+Space')
 await expect(play).toHaveText('Play')

 const search=page.getByRole('combobox',{name:'Search flights'})
 await search.fill('London')
 await search.press('Space')
 await expect(search).toHaveValue('London ')
 await expect(play).toHaveText('Play')
 await search.fill('')
 const slider=page.getByRole('slider',{name:'Time of day UTC'})
 await slider.focus();await page.keyboard.press('Space')
 await expect(play).toHaveText('Play')
 // A focused transport button uses its native Space activation only once.
 await play.focus();await page.keyboard.press('Space')
 await expect(play).toHaveText('Pause')
 await page.keyboard.press('Space')
 await expect(play).toHaveText('Play')

 await page.getByRole('button',{name:'View settings',exact:true}).click()
 await page.getByRole('button',{name:'Hour density',exact:true}).click()
 await page.locator('canvas').click({position:{x:10,y:10},force:true})
 await page.keyboard.press('Space')
 await expect(play).toBeDisabled();await expect(play).toHaveText('Play')
})

test('Space cannot start playback before observations are ready',async({page})=>{
 let release:()=>void=()=>{}
 const gate=new Promise<void>(resolve=>{release=resolve})
 await page.route('**/chunk-042.json.gz.bin',async route=>{await gate;await route.continue()})
 try{
  await page.goto('./')
  await expect(page.locator('.play')).toBeVisible()
  await expect(page.locator('.play')).toBeDisabled()
  await page.keyboard.press('Space')
  await expect(page.locator('.play')).toHaveText('Play')
 }finally{release()}
 await expect(page.locator('.play')).toBeEnabled()
 await page.keyboard.press('Space')
 await expect(page.locator('.play')).toHaveText('Pause')
})
