import {useState} from 'react'
import {AIRLINES,type AirlineId} from './airlines'
import {ActivityChart} from './ActivityChart'
import type {ActivitySeries} from './activity'
export function ComparisonPanel({pair,series,time,onPair,onSeek,onClose}:{pair:readonly AirlineId[];series:ActivitySeries[];time:number;onPair:(pair:AirlineId[])=>void;onSeek:(time:number)=>void;onClose:()=>void}){
 const [expanded,setExpanded]=useState(true)
 return <section className={`comparison-panel${expanded?' is-open':''}`} aria-label="Compare airlines">
  <div className="panel-heading"><button className="comparison-toggle" aria-label={expanded?'Minimise comparison':'Expand comparison'} aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>Two airlines, one day <span aria-hidden="true">{expanded?'−':'+'}</span></button><button aria-label="Close airline comparison" onClick={onClose}>×</button></div>
  {expanded?<><div className="comparison-pickers">{pair.map((id,i)=><label key={i}><span style={{color:series[i]?.colour}}>{i?'Second airline':'First airline'}</span><select aria-label={i?'Second airline':'First airline'} value={id} onChange={event=>onPair(pair.map((value,j)=>i===j?event.target.value as AirlineId:value))}>{AIRLINES.map(airline=><option key={airline.id} value={airline.id} disabled={pair[1-i]===airline.id}>{airline.name}</option>)}</select></label>)}</div>
  <ActivityChart series={series} time={time} onSeek={onSeek} label="Comparison time UTC" interval={300}/>
  <p className="chart-note">Distinct aircraft in five-minute snapshots. Both lines share a scale and respect your airport, route and geography filters. Drag the chart to explore.</p></>:<div className="activity-legend comparison-compact">{series.map(row=><span key={row.label}><i style={{borderColor:row.colour,borderTopStyle:row.dashed?'dashed':'solid'}}/>{row.label}</span>)}</div>}
 </section>
}
