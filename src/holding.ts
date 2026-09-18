/** Experimental geometric evidence, not an operational holding classification. */
export type HoldingSample=readonly [number,number,number,number,...number[]]
export type HoldingDestination={longitude:number;latitude:number}
export type HoldingPoint=[time:number,confidence:number]
export type HoldingIndex={date:string;sourceManifestSha256:string;tracks:Record<string,HoldingPoint[]>}
const rad=Math.PI/180
const clamp=(n:number)=>Math.max(0,Math.min(1,n))
export function distanceKm(a:readonly number[],b:readonly number[]){
 const lat1=a[2]*rad,lat2=b[2]*rad,dlat=lat2-lat1,dlon=(b[1]-a[1])*rad
 return 12742*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlon/2)**2)))
}
export function holdingEvidence(samples:readonly HoldingSample[],destination?:HoldingDestination){
 const first=samples[0],last=samples.at(-1)
 if(!first||!last||last[0]-first[0]<210)return undefined
 let path=0,turn=0,absoluteTurn=0,heading:number|undefined,minAltitude=Infinity,maxAltitude=-Infinity
 for(let i=0;i<samples.length;i++){
  const p=samples[i];if(!p.slice(0,4).every(Number.isFinite))return undefined
  minAltitude=Math.min(minAltitude,p[3]);maxAltitude=Math.max(maxAltitude,p[3])
  if(!i)continue
  const a=samples[i-1],dt=p[0]-a[0],distance=distanceKm(a,p)
  if(dt<=0||dt>45||distance/dt>0.4)return undefined
  path+=distance
  // Ignore positional jitter when the aircraft has barely moved.
  if(distance<.15)continue
  const next=Math.atan2((p[1]-a[1])*Math.cos((p[2]+a[2])*rad/2),p[2]-a[2])
  if(heading!==undefined){const delta=Math.atan2(Math.sin(next-heading),Math.cos(next-heading));turn+=delta;absoluteTurn+=Math.abs(delta)}
  heading=next
 }
 if(path<15)return undefined
 const closure=distanceKm(first,last)/path,turnDegrees=Math.abs(turn)/rad,consistency=absoluteTurn?Math.abs(turn)/absoluteTurn:0
 const target=destination?[0,destination.longitude,destination.latitude]:undefined
 const distance=target?distanceKm(last,target):undefined
 const progress=target?(distanceKm(first,target)-distance!)/path:undefined
 // Thresholds are deliberately conservative and are evaluated on past samples only.
 const geometric=closure<.22&&turnDegrees>=300&&consistency>=.8
 const context=!!destination&&distance!<=150&&minAltitude>=1500&&maxAltitude<=22000&&maxAltitude-minAltitude<=2500
 const stalled=progress!==undefined&&Math.abs(progress)<.2
 const confidence=geometric&&context&&stalled?
  (.65+.35*clamp((turnDegrees-300)/360))*(.8+.2*clamp((.22-closure)/.22))*(.9+.1*clamp((150-distance!)/120)):0
 return {confidence,path,closure,turnDegrees,consistency,progress,distance,minAltitude,maxAltitude,duration:last[0]-first[0],geometric,context,stalled}
}

/** Lookup is independent of playback direction and never uses a future score.
 * Each new score blends from the preceding score over 30 study seconds.
 */
export function holdingConfidence(points:readonly HoldingPoint[]|undefined,time:number){
 if(!points?.length)return 0
 let lo=0,hi=points.length
 while(lo<hi){const m=(lo+hi)>>>1;if(points[m][0]<=time)lo=m+1;else hi=m}
 if(!lo)return 0
 const current=points[lo-1],previous=points[lo-2],age=time-current[0]
 if(age>90)return 0
 const from=previous&&current[0]-previous[0]<=60?previous[1]:0
 const blend=clamp(age/30),value=from+(current[1]-from)*blend
 return value*(1-clamp((age-60)/30))
}
