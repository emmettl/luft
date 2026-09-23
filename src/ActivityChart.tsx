import {useRef,useState} from 'react'
import {activityPath,type ActivitySeries} from './activity'
import {momentTime} from './moments'
export function ActivityChart({series,time,onSeek,label,interval=1800}:{series:ActivitySeries[];time:number;onSeek:(time:number)=>void|Promise<void>;label:string;interval?:number}){
 const [preview,setPreview]=useState<number>(),current=preview??time,maximum=Math.max(1,...series.flatMap(row=>row.values)),bin=Math.min(Math.floor(current/interval),series[0]?.values.length-1)
 const active=useRef(false),pending=useRef(false),request=useRef(0)
 const finish=()=>{active.current=false;if(!pending.current)setPreview(undefined)}
 const seek=(value:number)=>{const id=++request.current;pending.current=true;setPreview(value);void Promise.resolve(onSeek(value)).finally(()=>{if(id===request.current){pending.current=false;if(!active.current)setPreview(undefined)}})}
 return <div className="activity-chart">
  <div className="activity-reading"><strong>{momentTime(current)} UTC</strong><span>Shared scale · 0–{maximum}</span></div>
  <div className="activity-plot">
   <svg viewBox="0 0 300 76" preserveAspectRatio="none" aria-hidden="true"><path className="activity-grid" d="M6 8H294M6 36H294M6 64H294"/>{series.map(row=><path key={row.label} d={activityPath(row.values,maximum,interval)} fill="none" stroke={row.colour} strokeWidth="1.6" strokeDasharray={row.dashed?'4 3':undefined}/>)}<line x1={6+288*current/86399} x2={6+288*current/86399} y1="4" y2="68" className="activity-marker"/></svg>
   <input type="range" aria-label={label} min="0" max="86399" step="1" value={current} onChange={event=>seek(Number(event.target.value))} onPointerDown={event=>{if(event.button!==0||!event.isPrimary)return;event.preventDefault();active.current=true;event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);const r=event.currentTarget.getBoundingClientRect();seek(Math.round(Math.max(0,Math.min(1,(event.clientX-r.left)/r.width))*86399))}} onPointerMove={event=>{if(!event.currentTarget.hasPointerCapture(event.pointerId))return;event.preventDefault();const r=event.currentTarget.getBoundingClientRect();seek(Math.round(Math.max(0,Math.min(1,(event.clientX-r.left)/r.width))*86399))}} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onBlur={finish}/>
  </div>
  <div className="activity-axis"><span>00:00</span><span>12:00</span><span>24:00</span></div>
  <div className="activity-legend">{series.map(row=><span key={row.label}><i style={{borderColor:row.colour,borderTopStyle:row.dashed?'dashed':'solid'}}/>{row.label} <strong>{row.values[bin]??0}</strong></span>)}</div>
 </div>
}
