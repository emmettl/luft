import React,{useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react'
import {searchAirports} from '@motionstudies/core/domain/airport'
import {AIRLINES} from './airlines'
import type {Airport} from './data'
import {searchCountries,type Country} from './countries'
import {observedRoutes,type Selection} from './filters'

const logos=import.meta.glob('./assets/airlines/*.svg',{eager:true,query:'?url',import:'default'}) as Record<string,string>
type Result={type:keyof Selection;id:string;label:string;detail:string}
type Props={countries:Country[];airports:Airport[];routes:ReturnType<typeof observedRoutes>;selection:Selection;onChange:(selection:Selection)=>void;onAirportBoard:(airport:Airport)=>void;onCountryFocus:(code:string)=>void}
export function FlightSearch({countries,airports,routes,selection,onChange,onAirportBoard,onCountryFocus}:Props){
 const [query,setQuery]=useState(''),[open,setOpen]=useState(false),[active,setActive]=useState(0)
 const root=useRef<HTMLDivElement>(null)
 const input=useRef<HTMLInputElement>(null)
 useEffect(()=>{
  if(!open)return
  // A touch can blur the input before its click reaches a result (notably
  // when iOS dismisses the keyboard). Blur alone is not an outside action.
  const outside=(event:Event)=>{
   if(event.target instanceof Node&&!root.current?.contains(event.target)){
    setOpen(false)
    if(event.type==='pointerdown')input.current?.blur()
   }
  }
  document.addEventListener('pointerdown',outside,true)
  document.addEventListener('focusin',outside)
  return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('focusin',outside)}
 },[open])
 const popover=useRef<HTMLDivElement>(null)
 useLayoutEffect(()=>{
  if(!open)return
  const viewport=window.visualViewport
  const fit=()=>{const panel=popover.current;if(!panel)return;const bottom=viewport?viewport.offsetTop+viewport.height:innerHeight;panel.style.maxHeight=`${Math.max(80,Math.min(480,bottom-panel.getBoundingClientRect().top-12))}px`}
  fit();viewport?.addEventListener('resize',fit);viewport?.addEventListener('scroll',fit);window.addEventListener('resize',fit)
  return()=>{viewport?.removeEventListener('resize',fit);viewport?.removeEventListener('scroll',fit);window.removeEventListener('resize',fit)}
 },[open])
 const results=useMemo(()=>{
  const q=query.trim().toLowerCase(),tokens=q.split(/[\s↔/–—-]+/).filter(Boolean)
  const airportResults=(q?searchAirports(airports,q,8):['LHR','CDG','ZRH','AMS'].map(code=>airports.find(a=>a.iata===code)).filter(Boolean)) as Airport[]
  const airlineResults=AIRLINES.filter(a=>!q?['easyjet','swiss','british-airways'].includes(a.id):`${a.name} ${a.prefixes.join(' ')}`.toLowerCase().includes(q))
  const routeResults=routes.filter(r=>!q||tokens.every(token=>r.search.includes(token)))
  const countryResults=(q?searchCountries(countries,q):[]).filter(c=>!selection.countries.includes(c.code)).slice(0,4).map(c=>({type:'countries' as const,id:c.code,label:c.name,detail:`${c.airports.length} airports in this study · country`}))
  const exactCountry=(c:Result)=>c.label.toLowerCase()===q||c.id.toLowerCase()===q
  return [
   ...countryResults.filter(exactCountry),
   ...airportResults.filter(a=>!selection.airports.includes(a.icao)).slice(0,5).map(a=>({type:'airports' as const,id:a.icao,label:a.iata||a.icao,detail:`${a.city} · ${a.name}`})),
   ...airlineResults.filter(a=>!selection.airlines.includes(a.id)).slice(0,5).map(a=>({type:'airlines' as const,id:a.id,label:a.name,detail:a.note})),
   ...countryResults.filter(c=>!exactCountry(c)),
   ...routeResults.filter(r=>!selection.routes.includes(r.id)).slice(0,4).map(r=>({type:'routes' as const,id:r.id,label:r.label,detail:`${r.detail} · inferred endpoints`})),
  ]
 },[query,selection,airports,routes,countries])
 const add=(result:Result)=>{
  onChange({...selection,[result.type]:[...selection[result.type],result.id]})
  setQuery('');setActive(0);setOpen(false);input.current?.blur()
 }
 const remove=(type:keyof Selection,id:string)=>onChange({...selection,[type]:selection[type].filter(value=>value!==id)})
 const pills:Result[]=[...selection.countries.map(id=>({type:'countries' as const,id,label:countries.find(c=>c.code===id)!.name,detail:'Country · airport-associated flights'})),...selection.airports.map(id=>{const a=airports.find(a=>a.icao===id)!;return {type:'airports' as const,id,label:a.iata||id,detail:a.name}}),...selection.airlines.map(id=>({type:'airlines' as const,id,label:AIRLINES.find(a=>a.id===id)!.name,detail:'Airline'})),...selection.routes.map(id=>({type:'routes' as const,id,label:routes.find(r=>r.id===id)!.label,detail:'Route · both directions'}))]
 const names={countries:'Countries',airports:'Airports',airlines:'Airlines',routes:'Routes · both directions'}
 return <div ref={root} className="flight-search">
  <div className="unified-input"><svg aria-hidden="true" width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg><input ref={input} aria-label="Search flights" placeholder="Countries, airports, airlines or routes" autoComplete="off" role="combobox" aria-expanded={open} aria-controls="flight-results" aria-activedescendant={open&&results[active]?`flight-result-${active}`:undefined} value={query} onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setActive(0);setOpen(true)}} onKeyDown={event=>{
   if(event.key==='ArrowDown'){event.preventDefault();setOpen(true);setActive(i=>Math.min(results.length-1,i+1))}
   if(event.key==='ArrowUp'){event.preventDefault();setActive(i=>Math.max(0,i-1))}
   if(event.key==='Enter'&&open&&results[active]){event.preventDefault();add(results[active])}
   if(event.key==='Escape'){setOpen(false);input.current?.blur()}
  }}/>{open&&<button className="search-close" aria-label="Close search" onClick={()=>{setOpen(false);input.current?.blur()}}>×</button>}</div>
  {pills.length>0&&<div className="filter-pills" role="group" aria-label="Selected filters">{pills.map(pill=><div className={`filter-pill filter-pill--${pill.type}`} key={`${pill.type}:${pill.id}`}>
   {pill.type==='airlines'&&logos[`./assets/airlines/${pill.id}.svg`]&&<img src={logos[`./assets/airlines/${pill.id}.svg`]} alt=""/>}
   {pill.type==='airports'?<button className="pill-label" title={`Open ${pill.detail} board`} onClick={()=>onAirportBoard(airports.find(a=>a.icao===pill.id)!)}>{pill.label}</button>:pill.type==='countries'?<button className="pill-label" title={`Focus ${pill.label}`} onClick={()=>onCountryFocus(pill.id)}>{pill.label}</button>:<span title={pill.detail}>{pill.label}</span>}
   <button className="pill-remove" aria-label={`Remove ${pill.label}`} onClick={()=>remove(pill.type,pill.id)}>×</button>
  </div>)}<button className="clear-filters" onClick={()=>onChange({airports:[],airlines:[],routes:[],countries:[]})}>Clear all</button></div>}
  {open&&<div ref={popover} className="search-popover"><p className="search-guidance">Countries select flights linked to their airports. Combine groups to narrow the view.</p><div id="flight-results" role="listbox" aria-label="Flight filters">{results.map((result,i)=><React.Fragment key={`${result.type}:${result.id}`}>{(i===0||results[i-1].type!==result.type)&&<div className="result-heading" role="presentation">{names[result.type]}</div>}<button type="button" id={`flight-result-${i}`} role="option" aria-selected={active===i} onPointerDown={event=>{if(event.pointerType==='mouse')event.preventDefault()}} onClick={()=>add(result)}><strong>{result.label}</strong><span>{result.detail}</span><span aria-hidden="true">+</span></button></React.Fragment>)}{!results.length&&<p className="search-empty">No matches. Try a country, airport code, airline or route.</p>}</div></div>}
 </div>
}
