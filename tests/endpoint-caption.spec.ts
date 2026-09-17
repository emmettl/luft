import {test,expect} from '@playwright/test'
import {pauseAtStart} from './playback-helpers'
import {index,resolveEndpoint} from './release-expectations'
test('a selected daily flight distinguishes candidate destination from observed origin',async({page})=>{
 const track=index.aircraft.find(t=>t.origin?.icao==='EGLL'&&resolveEndpoint(t,'destination').status==='candidate'&&resolveEndpoint(t,'destination').airport?.iata)!
 expect(track).toBeTruthy()
 const destination=resolveEndpoint(track,'destination').airport!
 await page.goto('./');await pauseAtStart(page)
 await page.getByRole('button',{name:'Destination and continent filters',exact:true}).click()
 const panel=page.getByRole('region',{name:'Destination and continent filters'})
 await panel.getByRole('checkbox',{name:'Include candidate-only labels'}).check()
 await page.getByLabel('Endpoint airport search').fill(destination.iata)
 await panel.getByRole('button',{name:new RegExp(`^${destination.iata} `)}).click()
 await page.getByRole('button',{name:'Close endpoint filters'}).click()
 await page.getByRole('combobox',{name:'Search flights'}).fill('LHR')
 await page.getByRole('option',{name:/^LHR London/}).click()
 await page.getByRole('slider').fill(String(track.origin!.time))
 await page.getByRole('button',{name:'LHR board'}).click()
 await page.locator('.ms-split-flap-board tbody tr').filter({hasText:track.callsign}).first().locator('.ms-split-flap-board__select').click()
 await expect(page.locator('.flight-caption')).toContainText(track.callsign)
 await expect(page.locator('.endpoint-caption')).toContainText('LHR')
 await expect(page.locator('.endpoint-caption')).toContainText('Observed')
 await expect(page.locator('.endpoint-caption')).toContainText(destination.iata)
 await expect(page.locator('.endpoint-caption')).toContainText('Candidate only')
 await page.getByRole('button',{name:'Close airport board'}).click()
 await page.getByRole('button',{name:'Clear all',exact:true}).click()
 await expect(page.locator('.selection-summary')).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Destination and continent filters',exact:true})).not.toHaveAttribute('data-active','true')
})
