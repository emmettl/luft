import reference from './generated/geography.json'
import {AIR_CONTINENTS} from '@motionstudies/core/air-continents'

export const CONTINENTS=AIR_CONTINENTS
export type AirportGeography=Record<string,{country:string|null;continent:string|null}>
export const airportGeography:AirportGeography=reference.airports
const regions=new Intl.DisplayNames(['en'],{type:'region'})
export const countryLabel=(code:string)=>regions.of(code)||code
export const continentLabel=(code:string)=>CONTINENTS[code as keyof typeof CONTINENTS]??code
