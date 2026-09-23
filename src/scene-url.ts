import type {View} from './map'
import {selectionHash} from './selection-url'
import type {Selection} from './filters'
import type {EndpointFilter} from './endpoint-filters'
export type SharedScene={day:string;time:number;view?:View;flight?:string;focus?:string;mode:'motion'|'density';daylight:boolean;dimOthers:boolean;compare:boolean}
const validDay=(day:string)=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(`${day}T00:00:00Z`))&&new Date(`${day}T00:00:00Z`).toISOString().slice(0,10)===day
export function sceneDay(hash:string){const day=new URLSearchParams(hash.replace(/^#/,'' )).get('day')??'';return validDay(day)?day:undefined}
export function sceneFromHash(hash:string,date:string,flightIds:ReadonlySet<string>):SharedScene|undefined{
 const params=new URLSearchParams(hash.replace(/^#/,'')),day=sceneDay(hash),raw=params.get('time'),time=Number(raw)
 if(day!==date||raw===null||!/^\d+(\.\d+)?$/.test(raw)||!Number.isFinite(time)||time<0||time>=86400)return undefined
 const rawView=params.get('view')?.split(','),parts=rawView?.every(part=>part.trim()!=='' )?rawView.map(Number):undefined,flight=params.get('flight')??''
 let view:View|undefined
 if(parts?.length===4&&parts.every(Number.isFinite)){
  const [west,south,east,north]=parts
  if(west>=-180&&east<=180&&south>=-90&&north<=90&&east-west>=.1&&east-west<=360&&north-south>=.1&&north-south<=180)view={west,south,east,north}
 }
 return {day,time,view,flight:flightIds.has(flight)?flight:undefined,focus:/^[A-Z0-9]{4}$/.test(params.get('focus')??'')?params.get('focus')!:undefined,mode:params.get('mode')==='density'?'density':'motion',daylight:params.get('daylight')!=='off',dimOthers:params.get('dim')!=='off',compare:params.get('compare')==='1'}
}
export function sceneHash(selection:Selection,endpoint:EndpointFilter,scene:SharedScene){
 const params=new URLSearchParams(selectionHash(selection,endpoint).replace(/^#/,''))
 params.set('day',scene.day);params.set('time',String(Math.floor(scene.time)))
 if(scene.view)params.set('view',[scene.view.west,scene.view.south,scene.view.east,scene.view.north].map(n=>n.toFixed(5)).join(','))
 if(scene.flight)params.set('flight',scene.flight)
 if(scene.focus)params.set('focus',scene.focus)
 if(scene.mode==='density')params.set('mode','density')
 if(!scene.daylight)params.set('daylight','off')
 if(!scene.dimOthers)params.set('dim','off')
 if(scene.compare)params.set('compare','1')
 return `#${params}`
}
