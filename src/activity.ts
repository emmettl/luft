import type {Index} from './data'
export type ActivitySeries={label:string;colour:string;values:number[];dashed?:boolean}
/** Distinct identities per half-hour, counted only at known observed boundaries. */
export function airportActivity(tracks:Index['aircraft'],icao:string):ActivitySeries[]{
 return (['destination','origin'] as const).map((side,i)=>{
  const bins=Array.from({length:48},()=>new Set<string>())
  for(const track of tracks){const endpoint=track[side];if(endpoint?.icao===icao&&Number.isFinite(endpoint.time)&&endpoint.time>=0&&endpoint.time<86400)bins[Math.floor(endpoint.time/1800)].add(track.icaoAddress??track.id)}
  return {label:i?'Departures':'Arrivals',colour:i?'#efbd72':'#81d9f1',dashed:!!i,values:bins.map(bin=>bin.size)}
 })
}
export function activityPath(values:readonly number[],maximum:number,interval=86400/Math.max(1,values.length-1)){
 return values.map((value,i)=>`${i?'L':'M'}${(i*interval/86400*288+6).toFixed(2)},${(64-value/Math.max(1,maximum)*56).toFixed(2)}`).join(' ')
}
