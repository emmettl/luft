// Run against a local LUFT dev server with verified data already prepared:
// node scripts/build-social-assets.mjs http://127.0.0.1:5173/luft/
// Uses the real Canvas renderer and recorded observations, never synthetic tracks.
import {chromium, expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'

const baseURL = process.argv[2] ?? 'http://127.0.0.1:5173/luft/'
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname)) {
  throw new Error('Use a local LUFT server to generate the social assets.')
}
const output = name => fileURLToPath(new URL(`../public/${name}`, import.meta.url))
const browser = await chromium.launch()
try {
  const page = await browser.newPage({viewport: {width: 1200, height: 630}, deviceScaleFactor: 1, reducedMotion: 'reduce'})
  await page.goto(`${baseURL}?renderer=canvas`)
  const pause = page.getByRole('button', {name: 'Pause', exact: true})
  await expect(pause).toBeEnabled({timeout: 60000})
  await pause.click()
  await page.getByRole('slider').fill('43200')
  await expect(page.locator('.clock')).toHaveText('12:00 UTC')
  await expect(page.locator('.stream-status')).toHaveText('Paused', {timeout: 60000})
  await expect(page.locator('.count')).toHaveText(/^[1-9][\d,]* aircraft.*over Europe$/)
  await page.addStyleTag({content: `
    .study > header, .workspace aside, .study > footer, .airport-labels,
    .stage > :not(canvas), .new-day { display: none !important; }
    .stage { left: 260px; right: auto; width: 1000px; }
    .stage canvas { --luft-map-top: 1px; --luft-map-bottom: 1px; }
    .social-cover { position: fixed; inset: 0; z-index: 200; padding: 54px 60px;
      background: linear-gradient(90deg, #080f19 0%, #080f19f5 24%, #080f1999 43%, transparent 67%);
      color: #e6ecee; font-family: Arial, sans-serif; }
    .social-edition { color: #c7aa7a; font: 12px monospace; letter-spacing: 3px; }
    .social-title { margin-top: 120px; font-size: 108px; font-weight: 400; letter-spacing: 17px; line-height: 1; }
    .social-subtitle { margin-top: 22px; font-size: 32px; font-weight: 400; letter-spacing: -.5px; }
    .social-description { margin-top: 20px; color: #a9b8c0; font-size: 17px; line-height: 1.6; }
    .social-footer { position: absolute; bottom: 50px; left: 60px; color: #c7aa7a; font: 11px monospace; letter-spacing: 1.4px; }
    .social-credit { position: absolute; bottom: 30px; right: 36px; color: #8ba0ad; font: 9px monospace; }
  `})
  await page.evaluate(() => {
    const cover = document.createElement('div')
    cover.className = 'social-cover'
    cover.innerHTML = `
      <div class="social-edition">MOTION STUDIES / RESEARCH EDITION</div>
      <div class="social-title">LUFT</div>
      <div class="social-subtitle">Flights over Europe</div>
      <div class="social-description">A recorded day of aircraft movement.<br>Explore the patterns above us.</div>
      <div class="social-footer">OBSERVE · REPLAY · EXPLORE</div>
      <div class="social-credit">Aircraft data: ADSB.lol · ODbL 1.0</div>`
    document.body.append(cover)
  })
  // Allow ResizeObserver and the retained 30 Hz map to repaint the new composition.
  await page.waitForTimeout(500)
  await page.screenshot({path: output('og-image.png')})

  const svg = await readFile(output('favicon.svg'), 'utf8')
  for (const [name, size] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180]]) {
    await page.setViewportSize({width: size, height: size})
    await page.setContent(`<style>html,body{margin:0;background:#0b1622}svg{display:block;width:100vw;height:100vh}</style>${svg}`)
    await page.screenshot({path: output(name)})
  }
  console.log('Wrote og-image.png (1200×630), favicon-32.png and apple-touch-icon.png.')
} finally {
  await browser.close()
}
