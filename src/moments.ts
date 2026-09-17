export type ActivityBin={time:number;count:number}
export type Moment={id:string;time:number;title:string;caption:string}
export const momentTime=(time:number)=>`${String(Math.floor(time/3600)).padStart(2,'0')}:${String(Math.floor(time/60)%60).padStart(2,'0')}`

/** Describe only this day's observed snapshots, with earliest-time tie breaking. */
export function buildMoments(bins:readonly ActivityBin[]):Moment[]{
 if(!bins.length)return []
 const peak=bins.reduce((best,bin)=>bin.count>best.count?bin:best)
 if(!peak.count)return []
 const quiet=bins.reduce((best,bin)=>bin.count<best.count?bin:best)
 const count=(value:number)=>value.toLocaleString('en-GB')
 if(quiet.count===peak.count)return [{id:'steady',time:peak.time,title:'A steady count',caption:`Every recorded snapshot contains ${count(peak.count)} aircraft in this selection.`}]
 const moments:Moment[]=[
  {id:'quiet',time:quiet.time,title:'The quietest snapshot',caption:`${count(quiet.count)} aircraft observed — the lowest five-minute snapshot count of this day.`},
  {id:'peak',time:peak.time,title:'The busiest snapshot',caption:`${count(peak.count)} aircraft observed — the highest five-minute snapshot count of this day.`},
 ]
 const byTime=new Map(bins.map(bin=>[bin.time,bin]))
 let rise:{start:ActivityBin;end:ActivityBin;delta:number}|undefined,fall:typeof rise
 for(const start of bins){
  const end=byTime.get(start.time+3600);if(!end)continue
  const delta=end.count-start.count
  if(delta>0&&(!rise||delta>rise.delta))rise={start,end,delta}
  if(delta<0&&(!fall||delta<fall.delta))fall={start,end,delta}
 }
 for(const [id,change] of [['rise',rise],['fall',fall]] as const){
  if(!change)continue
  moments.push({id,time:change.start.time,title:id==='rise'?'The sky fills':'The sky thins',caption:`From ${count(change.start.count)} to ${count(change.end.count)} aircraft by ${momentTime(change.end.time)} UTC — this day’s largest one-hour ${id==='rise'?'rise':'fall'} in observed snapshot counts.`})
 }
 return moments.sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id))
}
