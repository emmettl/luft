import {useMemo} from 'react'
import type {FlightRoute} from './flight-route'
import {momentTime} from './moments'

export function FlightProfile({route,time}:{route:FlightRoute;time:number}){
 const profile=useMemo(()=>{
  const points=route.segments.flat(),start=points[0]?.[0],end=points.at(-1)?.[0]
  if(start===undefined||end===undefined||end<=start||!points.some(point=>point[3]!==undefined))return undefined
  const max=Math.max(1000,...points.map(point=>point[3]??0)),x=(t:number)=>4+232*(t-start)/(end-start)
  const paths=route.segments.map(segment=>segment.map(point=>point[3]===undefined?'':`${x(point[0])},${44-38*Math.max(0,point[3])/max}`).filter(Boolean).join(' ')).filter(Boolean)
  return {start,end,max,x,paths}
 },[route])
 if(!profile)return null
 return <div className="flight-profile">
  <div><span>Observed altitude</span><span>0–{Math.round(profile.max).toLocaleString('en-GB')} ft</span></div>
  <svg viewBox="0 0 240 48" role="img" aria-label="Observed altitude profile; gaps separate missing observations">
   <path d="M4 44H236" className="profile-baseline"/>
   {profile.paths.map((points,i)=><polyline key={i} points={points}/>)}
   {time>=profile.start&&time<=profile.end&&<line className="profile-playhead" x1={profile.x(time)} x2={profile.x(time)} y1="3" y2="46"/>}
  </svg>
  <div><span>{momentTime(profile.start)} UTC</span><span>{momentTime(profile.end)} UTC</span></div>
 </div>
}
