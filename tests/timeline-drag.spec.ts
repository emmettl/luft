import {test,expect} from '@playwright/test'
import {pauseAtStart} from './playback-helpers'

test.use({isMobile:false,hasTouch:false,viewport:{width:1280,height:800}})
test('grabbing the visible playhead drags continuously and holds its target while data loads',async({page})=>{
 await page.goto('./');await pauseAtStart(page)
 const slider=page.getByRole('slider')
 let release!:()=>void
 const gate=new Promise<void>(resolve=>{release=resolve})
 await page.route('**/chunk-*.json.gz.bin',async route=>{await gate;await route.continue()})
 try{
  const input=(await slider.boundingBox())!,cursor=(await page.locator('.ms-study-timeline__cursor').boundingBox())!
  // Grab the visible marker near the top, outside the native range thumb.
  await page.mouse.move(cursor.x+.5,cursor.y+1);await page.mouse.down()
  for(const fraction of [.55,.75,.65]){
   await page.mouse.move(input.x+22+(input.width-44)*fraction,cursor.y+1,{steps:4})
   await expect.poll(async()=>Math.abs(Number(await slider.inputValue())-86400*fraction)).toBeLessThan(180)
  }
  const held=await slider.inputValue()
  await expect(page.locator('.stream-status')).toContainText('Buffering')
  await page.waitForTimeout(350);await expect(slider).toHaveValue(held)
  // Pointer capture continues outside the control; release preserves the last target.
  await page.mouse.move(input.x+22+(input.width-44)*.65,input.y-30)
  await page.mouse.up();await expect(slider).toHaveValue(held)
  release();await expect(page.locator('.stream-status')).toHaveText('Paused')
  await expect(slider).toHaveValue(held)
  await slider.press('ArrowRight');await expect(slider).toHaveValue(String(Number(held)+1))
  await expect(page.locator('.play')).toHaveText('Play')
 }finally{release()}
})

test.describe('touch',()=>{
 test.use({isMobile:true,hasTouch:true,viewport:{width:390,height:844}})
 test('tapping the plot seeks without changing paused playback',async({page})=>{
  await page.goto('./');await pauseAtStart(page)
  const slider=page.getByRole('slider'),box=(await slider.boundingBox())!
  await slider.tap({position:{x:22+(box.width-44)*.5,y:5}})
  await expect.poll(async()=>Math.abs(Number(await slider.inputValue())-43200)).toBeLessThan(240)
  await expect(page.locator('.stream-status')).toHaveText('Paused')
  await expect(page.locator('.play')).toHaveText('Play')
 })
})
