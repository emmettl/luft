import {expect,it} from 'vitest'
import asset from './assets/europe-countries-50m.json'
import {countryAirportIds,searchCountries,type Country} from './countries'
import {EMPTY_SELECTION,matchesSelection} from './filters'
import type {Index} from './data'
const countries=asset.countries as Country[]
it('finds countries by names, ISO codes and common/local aliases',()=>{
 for(const [query,code] of [['Switzerland','CH'],['CH','CH'],['Schweiz','CH'],['UK','GB'],['DEU','DE'],['Türkiye','TR'],['Czech Republic','CZ']])expect(searchCountries(countries,query)[0]?.code).toBe(code)
 expect(searchCountries(countries,'zzzzzz')).toEqual([])
 expect(searchCountries(countries,'Saudi Arabia')).toEqual([]) // context only, outside recorded window
})
it('uses complete pinned airport membership, including coastlines, territories and cross-border names',()=>{
 const all=countries.flatMap(c=>c.airports)
 expect(all).toHaveLength(1080);expect(new Set(all).size).toBe(1080)
 const swiss=countryAirportIds(countries,['CH'])
 expect(swiss.size).toBe(13);expect(swiss.has('LSZH')).toBe(true);expect(swiss.has('LSGG')).toBe(true)
 expect(swiss.has('LFSB')).toBe(false);expect(countryAirportIds(countries,['FR']).has('LFSB')).toBe(true)
 expect(countryAirportIds(countries,['GI']).has('LXGB')).toBe(true)
 expect(countryAirportIds(countries,['CH','FR']).size).toBe(148)
})
it('unions countries, intersects with airport and airline filters, and excludes overflights with unknown endpoints',()=>{
 const track=(callsign:string,origin?:string,destination?:string)=>({callsign,origin:origin?{icao:origin}:undefined,destination:destination?{icao:destination}:undefined}) as Index['aircraft'][number]
 const flights=[track('SWR1','LSZH','EGLL'),track('EZY2','LFSB','EGLL'),track('SWR3'),track('SWR4','EGLL','EHAM')]
 const selection={...EMPTY_SELECTION,countries:['CH','FR']},ids=countryAirportIds(countries,selection.countries)
 expect(flights.map(t=>matchesSelection(t,selection,ids))).toEqual([true,true,false,false])
 expect(flights.map(t=>matchesSelection(t,{...selection,airlines:['swiss'],airports:['EGLL']},ids))).toEqual([true,false,false,false])
 expect(matchesSelection(flights[0],{...selection,airports:['LFSB']},ids)).toBe(false)
})
