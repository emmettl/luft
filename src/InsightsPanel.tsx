import {useMemo,useState,type CSSProperties} from 'react'
import type {Index} from './data'
import type {AirlineId} from './airlines'
import type {Selection} from './filters'
import {buildInsights,type InsightCategory} from './insights'

const categories:Record<InsightCategory,string>={airlines:'Carrier',airports:'Airport',countries:'Country',continents:'Continent'}
export function Insights({index,selection,onChange}:{index:Index;selection:Selection;onChange:(value:Selection)=>void}){
 const [open,setOpen]=useState(false),[category,setCategory]=useState<InsightCategory>('airlines')
 const stats=useMemo(()=>open?buildInsights(index,selection,category):undefined,[index,selection,category,open])
 const add=(id:string)=>{
  if(selection[category].includes(id as AirlineId))return
  onChange({...selection,[category]:[...selection[category],id]})
 }
 return <section className={`insights-panel${open?' is-open':''}`} aria-label="Insights">
  <button className="insights-toggle" aria-expanded={open} aria-controls="insights-content" onClick={()=>setOpen(!open)}><span><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="M3 13V8m5 5V3m5 10V6" strokeWidth="2"/></svg>Insights</span><span className="insights-toggle-note">Recorded day <span aria-hidden="true">{open?'−':'+'}</span></span></button>
  {open&&stats&&<div id="insights-content" className="insights-content">
   <div className="insights-categories" role="group" aria-label="Group insights by">{(Object.keys(categories) as InsightCategory[]).map(key=><button key={key} aria-pressed={category===key} onClick={()=>setCategory(key)}>{categories[key]}</button>)}</div>
   <div className="insights-scope"><p>Unique aircraft · full recorded day</p><p>Counts match other filter groups. Click + to add.</p></div>
   <div className="insights-list" aria-label={`${categories[category]} statistics`} key={category}>
    {stats.rows.map((row,i)=>{
     const selected=selection[category].includes(row.id as AirlineId)
     return <button key={row.id} className="insight-row" aria-label={`${selected?'Selected':'Add'} ${row.label}, ${row.count.toLocaleString()} aircraft`} aria-disabled={selected} onClick={()=>add(row.id)} style={{'--insight-share':`${row.count/(stats.rows[0]?.count||1)*100}%`} as CSSProperties}>
      <span className="insight-rank" aria-hidden="true">{String(i+1).padStart(2,'0')}</span><span className="insight-name"><strong>{row.label}</strong>{row.detail&&<small>{row.detail}</small>}</span><span className="insight-count">{row.count.toLocaleString()}</span><span className="insight-add" aria-hidden="true">{selected?'✓':'+'}</span>
     </button>
    })}
    {!stats.rows.length&&<p className="insights-empty">No known {categories[category].toLowerCase()} associations match these filters. Remove a filter to explore more.</p>}
   </div>
   <p className="insights-note">{stats.covered.toLocaleString()} / {stats.total.toLocaleString()} aircraft with known {category==='airlines'?'carrier':'endpoint'} associations. {category==='airlines'?'Carriers use operating callsigns.':'Geography uses observed endpoints; aircraft can appear in several rows.'}</p>
  </div>}
 </section>
}
