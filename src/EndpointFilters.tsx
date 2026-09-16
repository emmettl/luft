import {useEffect,useMemo,useRef,useState} from 'react'
import {foldSearchText} from '@motionstudies/core/search-text'
import {AIR_CONTINENTS} from '@motionstudies/core/air-continents'
import type {AirEnrichment,endpointCoverage} from '@motionstudies/core/air-enrichment'
import {EMPTY_ENDPOINT_FILTER,type EndpointFilter} from './endpoint-filters'
type Props={enrichment:AirEnrichment;value:EndpointFilter;coverage:ReturnType<typeof endpointCoverage>;onChange:(v:EndpointFilter)=>void;onClose:()=>void}
export function EndpointFilters({enrichment,value,coverage,onChange,onClose}:Props){
 const [query,setQuery]=useState(''),panel=useRef<HTMLElement>(null)
 useEffect(()=>{
  const viewport=window.visualViewport
  const fit=()=>{const element=panel.current;if(!element)return;const bottom=Math.min(viewport?viewport.offsetTop+viewport.height:innerHeight,document.querySelector('footer')?.getBoundingClientRect().top??innerHeight);element.style.maxHeight=`${Math.max(80,bottom-element.getBoundingClientRect().top-12)}px`}
  fit();panel.current?.querySelector('select')?.focus();viewport?.addEventListener('resize',fit);viewport?.addEventListener('scroll',fit);window.addEventListener('resize',fit)
  return()=>{viewport?.removeEventListener('resize',fit);viewport?.removeEventListener('scroll',fit);window.removeEventListener('resize',fit)}
 },[])
 const airport=enrichment.airports.find(a=>a.icao===value.airport)
 const results=useMemo(()=>{const q=foldSearchText(query);return q?enrichment.airports.filter(a=>foldSearchText(`${a.icao} ${a.iata} ${a.name}`).includes(q)).sort((a,b)=>Number(b.iata.toLowerCase()===q||b.icao.toLowerCase()===q)-Number(a.iata.toLowerCase()===q||a.icao.toLowerCase()===q)||a.name.localeCompare(b.name)).slice(0,5):[]},[query,enrichment])
 const choose=(icao:string)=>{onChange({...value,airport:icao,continent:'all'});setQuery('')}
 return <section ref={panel} className="endpoint-panel" aria-label="Destination and continent filters" onKeyDown={e=>{if(e.key==='Escape'){onClose();e.stopPropagation()}}}>
  <div className="panel-heading"><span>Destinations & continents</span><button aria-label="Close endpoint filters" onClick={onClose}>×</button></div>
  <p className="endpoint-overview">{coverage.usable.toLocaleString()} usable · {coverage.unresolved.toLocaleString()} unresolved {value.side==='destination'?'arrivals':'departures'}</p>
  <div className="endpoint-controls"><label>Endpoint<select aria-label="Endpoint direction" value={value.side} onChange={e=>onChange({...value,side:e.target.value as EndpointFilter['side']})}><option value="destination">Arrival</option><option value="origin">Departure</option></select></label>
  <label>Continent<select aria-label="Endpoint continent" value={value.continent} onChange={e=>onChange({...value,continent:e.target.value as EndpointFilter['continent'],airport:''})}><option value="all">All continents</option>{Object.entries(AIR_CONTINENTS).map(([code,name])=><option key={code} value={code}>{name}</option>)}<option value="unresolved">Unresolved</option></select></label></div>
  <label className="endpoint-airport-label">Airport<input aria-label="Endpoint airport search" autoComplete="off" placeholder="Airport name or code" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&results[0]){e.preventDefault();choose(results[0].icao)}}}/></label>
  {query&&<div className="endpoint-airport-results" aria-label="Endpoint airport results">{results.map(a=><button key={a.icao} onClick={()=>choose(a.icao)}><strong>{a.iata||a.icao}</strong> {a.name}</button>)}{!results.length&&<p>No matching airports.</p>}</div>}
  {airport&&<div className="endpoint-choice"><span>{airport.iata||airport.icao} · {airport.name}</span><button aria-label="Remove endpoint airport" onClick={()=>onChange({...value,airport:''})}>×</button></div>}
  <label className="filter-display"><input type="checkbox" checked={value.includeCandidates} onChange={e=>onChange({...value,includeCandidates:e.target.checked})}/>Include candidate-only labels</label>
  <p className="endpoint-explanation">Observed and corroborated labels are included by default. Candidates come from route references without sufficient observation support. Conflicting proposals remain unresolved.</p>
  <div className="endpoint-coverage" aria-live="polite"><strong>{value.side==='destination'?'Arrival':'Departure'} coverage</strong><span>{coverage.segments.toLocaleString()} track segments before this endpoint filter</span><p><b>{coverage.usable.toLocaleString()} usable</b> · {coverage.unresolved.toLocaleString()} unresolved</p><dl>{(['observed','corroborated','candidate','conflicting','unknown'] as const).map((key,i)=><div key={key}><dt>{['Observed','Corroborated','Candidate only','Conflicting','Unknown'][i]}</dt><dd>{coverage[key].toLocaleString()}</dd></div>)}</dl></div>
  <p className="endpoint-explanation">Corroborated means consistent observations, not an independently confirmed flight. Counts are segments, not unique flights. Existing country, airport and route search uses observed endpoints.</p>
  <div className="endpoint-actions"><button onClick={()=>{onChange(EMPTY_ENDPOINT_FILTER);setQuery('')}}>Reset endpoint filters</button><a href={`${import.meta.env.BASE_URL}enrichment/coverage.json`}>Evidence counts ↗</a></div>
  <details className="endpoint-sources"><summary>Sources & evidence</summary><p><a href="https://ourairports.com/data/">OurAirports</a> · <a href="https://github.com/vradarserver/standing-data">VRS standing-data</a> · <a href="https://www.adsb.lol/">ADSB.lol contributors</a></p>{enrichment.sources.filter(s=>s.kind==='association-audit').map(s=><a key={s.id} href={`${import.meta.env.BASE_URL}enrichment/${s.url}`}>Observation audit {s.id.replace('audit-','')} ↗</a>)}<p>Airport data: public domain. Routes: CC0. Observation-derived enrichment: ODbL 1.0. The audits cover a selected sample; most route candidates have not been audited.</p></details>
 </section>
}
