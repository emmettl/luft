import {useMemo,useRef,useState} from 'react'
import {buildMoments,momentTime,type ActivityBin,type Moment} from './moments'
import './moments.css'

export function Moments({bins,filtered,onJump}:{bins:readonly ActivityBin[];filtered:boolean;onJump:(moment:Moment)=>void}){
 const [open,setOpen]=useState(false)
 const toggle=useRef<HTMLButtonElement>(null)
 const moments=useMemo(()=>buildMoments(bins),[bins])
 const explore=(moment:Moment)=>{
  onJump(moment)
  if(matchMedia('(max-width:999px)').matches){setOpen(false);toggle.current?.focus({preventScroll:true})}
 }
 return <section className={`moments-panel${open?' is-open':''}`} aria-label="Moments">
  <button ref={toggle} className="moments-toggle" aria-expanded={open} aria-controls="moments-content" onClick={()=>setOpen(!open)}>
   <span><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="M2 12V4m4 7V5m4 8V3m4 7V6"/><circle cx="10" cy="5" r="2" fill="currentColor" stroke="none"/></svg>Moments</span>
   <span className="moments-toggle-note">{moments.length} to explore <span aria-hidden="true">{open?'−':'+'}</span></span>
  </button>
  {open&&<div id="moments-content" className="moments-content">
   <p className="moments-scope">{filtered?'Your selection':'Across the study area'} · this recorded day</p>
   <ol className="moments-list">{moments.map(moment=><li key={moment.id}>
    <button className="moment" data-moment={moment.id} data-time={moment.time} aria-label={`Explore ${moment.title.toLowerCase()} at ${momentTime(moment.time)} UTC`} onClick={()=>explore(moment)}>
     <span className="moment-heading"><span className="moment-time">{momentTime(moment.time)} <small>UTC</small></span><span className="moment-action">Explore <span aria-hidden="true">↗</span></span></span>
     <strong>{moment.title}</strong><span className="moment-caption">{moment.caption}</span>
    </button>
   </li>)}</ol>
   {!moments.length&&<p className="moments-empty">No aircraft in the five-minute snapshots for this selection. Try removing a filter.</p>}
   <p className="moments-note">Explore pauses the map at that time. Press Play to watch what follows. Counts reflect recorded coverage; gaps do not mean empty skies.</p>
  </div>}
 </section>
}
