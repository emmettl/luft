import {expect,it} from 'vitest'
import {solarElevation,solarPosition} from './daylight'

it('places the equinox sun near the equator, with opposite noon and midnight illumination',()=>{
 const noon=solarPosition('2026-03-20',43200),midnight=solarPosition('2026-03-20',0)
 expect(Math.abs(noon.declination*180/Math.PI)).toBeLessThan(1)
 expect(solarElevation(0,0,noon)).toBeGreaterThan(87)
 expect(solarElevation(0,0,midnight)).toBeLessThan(-87)
})
it('preserves polar summer/winter and the east-to-west dawn direction',()=>{
 expect(solarElevation(90,0,solarPosition('2026-06-21',0))).toBeCloseTo(23.45,0)
 expect(solarElevation(90,0,solarPosition('2026-12-21',43200))).toBeCloseTo(-23.45,0)
 const dawn=solarPosition('2026-09-14',6*3600)
 expect(solarElevation(50,30,dawn)).toBeGreaterThan(15)
 expect(solarElevation(50,-20,dawn)).toBeLessThan(-5)
})
it('uses UTC and handles leap years and date boundaries',()=>{
 expect(solarPosition('2024-02-29',86400)).toEqual(solarPosition('2024-03-01',0))
 expect(solarPosition('2026-12-31',86400)).toEqual(solarPosition('2027-01-01',0))
 for(const date of ['2024-02-29','2026-09-14'])for(const latitude of [-90,0,90]){
  expect(Number.isFinite(solarElevation(latitude,180,solarPosition(date,86399)))).toBe(true)
 }
})
