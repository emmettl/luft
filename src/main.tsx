import React, {useEffect,useMemo,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {searchAirports,airportBoardMovements} from '@motionstudies/core/domain/airport'
import {AirportHeroCard} from '@motionstudies/web/components/AirportHeroCard'
import '@motionstudies/web/airport-hero-card.css'
import '@motionstudies/web/split-flap-board.css'
import {AirMap,EUROPE,BRITAIN} from './map'
import {ChunkStore,loadRelease,type Airport,type Chunk} from './data'
import './style.css'
type Release=Awaited<ReturnType<typeof loadRelease>>
const stamp=(n:number)=>`${String(Math.floor(n/3600)).padStart(2,'0')}:${String(Math.floor(n/60)%60).padStart(2,'0')}`
function App(){
 const [release,setRelease]=useState<Release>(),[error,setError]=useState('')
 useEffect(()=>{loadRelease().then(setRelease).catch(e=>setError(e.message))},[])
 return <>{release?<Study release={release}/>:<main className="opening"><span className="eyebrow">Motion Studies / research</span><h1>LUFT</h1><p role="status">{error||'Opening a day over Europe…'}</p>{error&&<button onClick={()=>location.reload()}>Retry</button>}</main>}</>
}
function Study({release}:{release:Release}) {
 const {manifest,index,land}=release,canvas=useRef<HTMLCanvasElement>(null),map=useRef<AirMap|null>(null)
 const store=useMemo(()=>new ChunkStore(manifest.chunks),[manifest])
 const engine=useRef({time:7*3600,playing:false,speed:300,chunk:undefined as Chunk|undefined,chunkIndex:-1,targetTime:7*3600,generation:0,waiting:false,airport:undefined as Airport|undefined,mode:'motion',flight:''})
 const [ui,setUi]=useState({time:7*3600,playing:false,waiting:true,total:0,inbound:0,outbound:0,visible:0,cache:0,ms:0,downloaded:0})
 const [status,setStatus]=useState('Loading observations…'),[speed,setSpeed]=useState(300),[mode,setMode]=useState('motion'),[query,setQuery]=useState(''),[airport,setAirport]=useState<Airport>(),[flight,setFlight]=useState(''),[activeResult,setActiveResult]=useState(0),[diagnostics,setDiagnostics]=useState(false)
 const results=useMemo(()=>searchAirports(index.airports,query,6) as Airport[],[index,query])
 const board=useMemo(()=>airport?airportBoardMovements(index.aircraft,airport):{departures:[],arrivals:[]},[index,airport])
 const [boardOpen,setBoardOpen]=useState(true)
 const updateUi=()=>{const e=engine.current;setUi(p=>({...p,time:e.time,playing:e.playing,waiting:e.waiting}))}
 async function seek(value:number,playback=false) {
  const e=engine.current,t=Math.max(0,Math.min(86399,value)),i=Math.floor(t/600)
  if(e.waiting&&playback)return
  const cached=store.cache.get(i)
  if(cached){e.time=t;e.chunk=cached;e.chunkIndex=i;if(!playback){e.generation++;e.waiting=false;setStatus('Ready')}store.prefetch(i);updateUi();return}
  e.targetTime=t;const generation=++e.generation;e.waiting=true;store.retain(i);setStatus(e.chunk?'Buffering · clock paused':'Loading observations…');updateUi()
  try{const chunk=await store.load(i);if(generation!==e.generation)return;e.chunk=chunk;e.chunkIndex=i;e.time=t;e.waiting=false;setStatus('Ready');store.prefetch(i)}
  catch(err){if(generation!==e.generation)return;e.waiting=false;e.playing=false;setStatus(`${(err as Error).message} · Retry to continue`)}
  updateUi()
 }
 useEffect(()=>{
  const e=engine.current;map.current=new AirMap(canvas.current!,land,index.airports);let stopped=false,raf=0,last=performance.now(),lastDraw=0,lastUi=0
  void seek(e.time)
  const frame=(now:number)=>{
   if(stopped)return
   const dt=Math.min(.12,(now-last)/1000);last=now
   if(e.playing&&!e.waiting&&e.mode==='motion'){const next=Math.min(86399,e.time+dt*e.speed);void seek(next,true);if(next===86399){e.playing=false;updateUi()}}
   if(now-lastDraw>=32 && e.chunk){const counts=map.current!.draw(e.chunk.tracks,e.time,e.airport,e.mode,index.cells[Math.floor(e.time/3600)]);lastDraw=now
    if(now-lastUi>=200){const durations=map.current!.durations.slice().sort((a,b)=>a-b);setUi({time:e.time,playing:e.playing,waiting:e.waiting,...counts,cache:store.cache.size,ms:durations[Math.floor(durations.length*.95)]??0,downloaded:store.downloadedBytes});lastUi=now}
   }
   raf=requestAnimationFrame(frame)
  };raf=requestAnimationFrame(frame)
  const visibility=()=>{if(document.hidden){e.playing=false;updateUi()}};document.addEventListener('visibilitychange',visibility)
  return()=>{stopped=true;cancelAnimationFrame(raf);e.generation++;store.dispose();document.removeEventListener('visibilitychange',visibility)}
 },[store,land,index])
 const choose=(a:Airport)=>{setAirport(a);engine.current.airport=a;setQuery('');setFlight('');engine.current.flight='';if(map.current)map.current.selectedFlight=undefined;setBoardOpen(true)}
 const clear=()=>{setAirport(undefined);engine.current.airport=undefined;setFlight('');if(map.current)map.current.selectedFlight=undefined}
 const selectFlight=(id:string)=>{const track=index.aircraft.find(t=>t.id===id);if(!track)return;setFlight(id);map.current!.selectedFlight=id;engine.current.playing=false
  const endpoint=track.origin?.icao===airport?.icao?track.origin:track.destination?.icao===airport?.icao?track.destination:undefined
  void seek(Math.min(track.end,Math.max(track.start,endpoint?.time??engine.current.time)))
 }
 const pointers=useRef(new Map<number,{x:number;y:number}>()),gesture=useRef({x:0,y:0,moved:false,distance:0})
 const down=(event:React.PointerEvent)=>{canvas.current!.setPointerCapture(event.pointerId);pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});gesture.current={x:event.clientX,y:event.clientY,moved:false,distance:0}}
 const move=(event:React.PointerEvent)=>{const p=pointers.current;if(!p.has(event.pointerId))return;p.set(event.pointerId,{x:event.clientX,y:event.clientY});const g=gesture.current
  if(p.size===2){const [a,b]=[...p.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(g.distance)map.current?.zoom(g.distance/d);g.distance=d;g.moved=true}
  else{const dx=event.clientX-g.x,dy=event.clientY-g.y;if(Math.hypot(dx,dy)>2)g.moved=true;map.current?.pan(dx,dy)}g.x=event.clientX;g.y=event.clientY
 }
 const up=(event:React.PointerEvent)=>{pointers.current.delete(event.pointerId);if(gesture.current.moved)return;const rect=canvas.current!.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;const point=map.current?.points.map(p=>({...p,d:Math.hypot(p.x-x,p.y-y)})).sort((a,b)=>a.d-b.d)[0];if(point&&point.d<20){setFlight(point.track.id);map.current!.selectedFlight=point.track.id}else{setFlight('');map.current!.selectedFlight=undefined}}
 const selected=index.aircraft.find(t=>t.id===flight)
 const maximum=Math.max(...index.bins.map(b=>b.count))
 return <main className="study">
  <header><div className="identity"><a className="eyebrow" href="https://emmettl.github.io/motionstudies/">Motion Studies / research</a><h1>LUFT<span>Flights over Europe</span></h1></div><div className="date">{new Date(`${manifest.date}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})}<span>Recorded observations · UTC</span></div></header>
  <div className="workspace">
   <section className="stage" aria-label="Map of observed aircraft over Europe">
    <canvas ref={canvas} aria-label="Aircraft map. Drag to pan; pinch to zoom. Use airport search to highlight movements." onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{pointers.current.clear();gesture.current.moved=true}} onWheel={e=>map.current?.zoom(e.deltaY>0?1.15:.87)}/>
    <div className="map-caption"><div className="clock">{stamp(ui.time)}<small> UTC</small></div><div className="count">{airport?`${ui.inbound} inbound · ${ui.outbound} outbound`:`${ui.total.toLocaleString()} aircraft in the study window`}</div>{airport&&<div className="airport-key"><span>● Inbound</span><span>● Outbound</span></div>}</div>
    {!engine.current.chunk&&<div className="initial-loading" role="status">{status}</div>}
    <div className="view-controls"><button onClick={()=>{map.current!.view={...EUROPE}}}>Europe</button><button onClick={()=>{map.current!.view={...BRITAIN}}}>Britain</button>{airport&&<button onClick={()=>map.current!.focus(airport)}>Near {airport.iata||airport.icao}</button>}<button aria-label="Zoom in" onClick={()=>map.current?.zoom(.7)}>+</button><button aria-label="Zoom out" onClick={()=>map.current?.zoom(1.4)}>−</button></div>
    {selected&&<div className="flight-caption"><strong>{selected.callsign}</strong><span>{selected.origin?.iata||'Unknown origin'} → {selected.destination?.iata||'Unknown destination'}</span><span>{selected.icaoAddress?.toUpperCase()} · observed track</span><button aria-label="Clear aircraft" onClick={()=>{setFlight('');map.current!.selectedFlight=undefined}}>×</button></div>}
    <div className="map-note">{mode==='density'?'One hour of observations · relative brightness':airport?'Other traffic dimmed · three-minute trails':'Three-minute trails · low-altitude tracks in gold'}</div>
   </section>
   <aside className={airport?'has-airport':''}>
    <div className="search"><label htmlFor="airport-search">Find an airport</label><div className="input-wrap"><span aria-hidden="true">⌕</span><input id="airport-search" value={query} placeholder="City, airport or code" autoComplete="off" role="combobox" aria-expanded={!!query.trim()} aria-controls="airport-results" aria-activedescendant={results[activeResult]?`result-${results[activeResult].id}`:undefined} onChange={e=>{setQuery(e.target.value);setActiveResult(0)}} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setActiveResult(i=>Math.min(results.length-1,i+1))}if(e.key==='ArrowUp'){e.preventDefault();setActiveResult(i=>Math.max(0,i-1))}if(e.key==='Enter'&&results[activeResult]){e.preventDefault();choose(results[activeResult])}if(e.key==='Escape')setQuery('')}}/></div>
     {query.trim()&&<div className="results" id="airport-results" role="listbox" aria-label="Airports">{results.length?results.map((a,i)=><button role="option" aria-selected={activeResult===i} id={`result-${a.id}`} key={a.id} onClick={()=>choose(a)}><strong>{a.iata||a.icao}</strong><span>{a.name}<small>{a.city} · {a.icao}</small></span></button>):<p>No matching airport.</p>}</div>}
    </div>
    {airport?<><div className="selection-toolbar"><button className="text-button" onClick={()=>setBoardOpen(!boardOpen)} aria-expanded={boardOpen}>{boardOpen?'Hide':'Show'} airport board</button><button className="text-button" onClick={clear}>Clear airport ×</button></div>{boardOpen&&<AirportHeroCard key={airport.id} airport={{...airport,iata:airport.iata||airport.icao}} departures={board.departures} arrivals={board.arrivals} study={{time:ui.time,windowStart:0,windowEnd:86400}} dateLabel={`${manifest.date} · UTC`} density="compact" maxRows={6} labels={{time:'Seen',emptyDepartures:'No observed departures in this window.',emptyArrivals:'No observed arrivals in this window.'}} note="Airport associations inferred from observed trace endpoints. Times are observations, not schedules; blank routes remain unknown." selectedFlightId={flight} onSelectFlight={selectFlight}/>}<p className="association-note">{board.departures.length} outbound / {board.arrivals.length} inbound associations in this recorded day.{!airport.hasObservedMovements?' No endpoint evidence for this airport; this does not mean no flights.':''}</p></>:<div className="intro"><span className="eyebrow">A continent in motion</span><h2>Places emerge<br/>from movement.</h2><p>Watch the gathering around London and Paris, and the threads between them. Select an airport to trace its part in the day.</p><div className="suggestions">{['LHR','CDG','ZRH','AMS'].map(code=>{const a=index.airports.find(a=>a.iata===code);return a&&<button key={code} onClick={()=>choose(a)}>{code}<span>{a.city}</span></button>})}</div><p className="quiet">An early study. The shape is visible; the thesis is still open.</p></div>}
   </aside>
  </div>
  <footer>
   <div className="transport"><button className="play" disabled={mode==='density'||!engine.current.chunk} onClick={()=>{engine.current.playing=!engine.current.playing;updateUi()}}>{ui.playing?'Pause':'Play'}</button><label className="speed-label">Pace <select aria-label="Playback speed" value={speed} onChange={e=>{const s=+e.target.value;setSpeed(s);engine.current.speed=s}}><option value="60">1 min / s</option><option value="300">5 min / s</option><option value="900">15 min / s</option></select></label><div className="mode-controls">{['motion','density'].map(m=><button key={m} aria-pressed={mode===m} onClick={()=>{setMode(m);engine.current.mode=m;engine.current.playing=false;updateUi()}}>{m==='motion'?'Motion':'Hour density'}</button>)}</div><span className="stream-status" role="status">{status==='Ready'?(ui.playing?'Playing': 'Paused'):status}</span>{status.includes('Retry')&&<button onClick={()=>void seek(engine.current.targetTime)}>Retry</button>}</div>
   <div className="timeline"><div className="activity" aria-hidden="true">{index.bins.map(b=><i key={b.time} className={Math.floor(ui.time/300)*300===b.time?'current':''} style={{height:`${Math.max(2,b.count/maximum*100)}%`}}/>)}</div><input aria-label="Time of day UTC" type="range" min="0" max="86399" step="1" value={Math.floor(ui.time)} onChange={e=>{engine.current.playing=false;void seek(+e.target.value)}}/><div className="time-labels"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00 UTC</span></div></div>
   <div className="colophon"><p>ADSB.lol & contributors · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL 1.0</a> · <a href="https://ourairports.com/data/">OurAirports</a> / <a href="https://www.naturalearthdata.com/about/terms-of-use/">Natural Earth</a> · public domain</p><div><button className="text-button" aria-expanded={diagnostics} onClick={()=>setDiagnostics(!diagnostics)}>Device details</button><a href="https://github.com/emmettl/luft">About / source ↗</a></div></div>
   {diagnostics&&<div className="diagnostics"><strong>On this device</strong><span>Map draw p95: {ui.ms.toFixed(1)} ms</span><span>{ui.cache} / 4 chunks in memory</span><span>{(ui.downloaded/1024/1024).toFixed(1)} MiB of track data downloaded this session</span><span>{ui.waiting?'Clock held while buffering':'Buffer ready'}</span><p>Draw time excludes decoding, layout and network work. It is not a full frame-rate benchmark. Ten-minute chunks are verified before display; gaps over 45 seconds remain gaps.</p></div>}
   <details className="method"><summary>About these observations</summary><p>{manifest.method} Hour density uses 0.5° cells, normalized within each hour; brightness cannot compare volumes across hours. Receiver coverage is incomplete. This is a recorded day, not live air traffic.</p><a href={`${import.meta.env.BASE_URL}data/manifest.json`}>Recorder release and source hashes ↗</a></details>
  </footer>
 </main>
}
createRoot(document.getElementById('root')!).render(<App/> )
