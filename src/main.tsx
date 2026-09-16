import React, {useEffect,useMemo,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {searchAirports,airportBoardMovements} from '@motionstudies/core/domain/airport'
import {AirportHeroCard} from '@motionstudies/web/components/AirportHeroCard'
import '@motionstudies/web/airport-hero-card.css'
import '@motionstudies/web/split-flap-board.css'
import {AirMap,EUROPE,BRITAIN,cityLabel} from './map'
import {ChunkStore,loadRelease,loadAirlineSummary,type Airport,type Chunk} from './data'
import {AIRLINES,matchesAirline,type AirlineSelection,type AirlineSummary} from './airlines'
import {StudyTimeline} from '@motionstudies/web/components/StudyTimeline'
import '@motionstudies/web/study-timeline.css'
import './style.css'
const airlineLogos=import.meta.glob('./assets/airlines/*.svg',{eager:true,query:'?url',import:'default'}) as Record<string,string>
const sortedAirlines=[...AIRLINES].sort((a,b)=>a.name.localeCompare(b.name,'en'))
const percentile=(values:number[],fraction=.95)=>{const sorted=values.slice().sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*fraction))]??0}
const formatActivity=(n:number)=>`${n.toLocaleString()} aircraft`
type Release=Awaited<ReturnType<typeof loadRelease>>
const stamp=(n:number)=>`${String(Math.floor(n/3600)).padStart(2,'0')}:${String(Math.floor(n/60)%60).padStart(2,'0')}`
function App(){
 const [release,setRelease]=useState<Release>(),[error,setError]=useState('')
 useEffect(()=>{loadRelease().then(setRelease).catch(e=>setError(e.message))},[])
 return <>{release?<Study release={release}/>:<main className="opening"><span className="eyebrow">Motion Studies / research</span><h1>LUFT</h1><p role="status">{error||'Opening a day over Europe…'}</p>{error&&<button onClick={()=>location.reload()}>Retry</button>}</main>}</>
}
function Study({release}:{release:Release}) {
 const {manifest,index,land,airlineCatalogue}=release,canvas=useRef<HTMLCanvasElement>(null),map=useRef<AirMap|null>(null)
 const store=useMemo(()=>new ChunkStore(manifest.chunks),[manifest])
 const engine=useRef({time:7*3600,playing:false,speed:300,chunk:undefined as Chunk|undefined,chunkIndex:-1,targetTime:7*3600,generation:0,waiting:false,airport:undefined as Airport|undefined,mode:'motion',flight:'',airline:'all' as AirlineSelection,airlineSummary:undefined as AirlineSummary|undefined})
 const [ui,setUi]=useState({time:7*3600,playing:false,waiting:true,total:0,inbound:0,outbound:0,visible:0,cache:0,ms:0,downloaded:0})
 const [status,setStatus]=useState('Loading observations…'),[speed,setSpeed]=useState(300),[mode,setMode]=useState('motion'),[query,setQuery]=useState(''),[airport,setAirport]=useState<Airport>(),[flight,setFlight]=useState(''),[activeResult,setActiveResult]=useState(0),[diagnostics,setDiagnostics]=useState(false)
 const [airline,setAirline]=useState<AirlineSelection>('all'),[airlineSummary,setAirlineSummary]=useState<AirlineSummary>(),[pendingAirline,setPendingAirline]=useState<AirlineSelection>(),[airlineError,setAirlineError]=useState(''),airlineGeneration=useRef(0)
 const [renderer,setRenderer]=useState<'canvas'|'three'>('canvas'),[rendererLoading,setRendererLoading]=useState(false),[rendererNote,setRendererNote]=useState(''),[copyNote,setCopyNote]=useState('')
 const rendererGeneration=useRef(0),metrics=useRef({intervals:[] as number[],lastPaint:0,bufferSeconds:0})
 const resetMeasurements=()=>{if(map.current)map.current.durations=[];metrics.current={intervals:[],lastPaint:0,bufferSeconds:0};setUi(p=>({...p,ms:0}));setCopyNote('')}
 const rendererUrl=(value:string)=>{const url=new URL(location.href);if(value==='canvas')url.searchParams.delete('renderer');else url.searchParams.set('renderer',value);history.replaceState(null,'',url)}
 async function chooseRenderer(value:'canvas'|'three'){
  const generation=++rendererGeneration.current;setRendererNote('');setRendererLoading(value==='three')
  const fallback=(message:string)=>{if(generation!==rendererGeneration.current)return;map.current?.setPainter();setRenderer('canvas');setRendererNote(message);rendererUrl('canvas');resetMeasurements()}
  if(value==='canvas'){map.current?.setPainter();setRenderer('canvas');rendererUrl(value);resetMeasurements();return}
  try{const {GpuAircraftPainter}=await import('./gpu-aircraft');if(generation!==rendererGeneration.current||!map.current)return;const painter=new GpuAircraftPainter(canvas.current!.parentElement!,fallback);map.current.setPainter(painter);setRenderer('three');rendererUrl(value);resetMeasurements()}
  catch{fallback('Three.js unavailable in this browser; using Canvas.')}
  finally{if(generation===rendererGeneration.current)setRendererLoading(false)}
 }
 async function copyMeasurements(){
  const m=metrics.current,report={release:'0.2.0',renderer,recordedDay:manifest.date,browser:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},time:engine.current.time,speed:engine.current.speed,mode,airline,airport:airport?.icao,view:map.current?.view,drawSamples:map.current?.durations.length,drawCpuP95Ms:percentile(map.current?.durations??[]),paintIntervalP95Ms:percentile(m.intervals),paintRate:m.intervals.length?1000*m.intervals.length/m.intervals.reduce((a,b)=>a+b,0):0,bufferSeconds:m.bufferSeconds,gpu:map.current?.gpuStats(),note:'30 Hz paint cap. CPU timing excludes asynchronous GPU completion. Compare identical views and warmed data.'}
  try{await navigator.clipboard.writeText(JSON.stringify(report,null,2));setCopyNote('Results copied')}catch{setCopyNote('Clipboard unavailable. Use the timings displayed here.')}
 }
 const [chartStyle,setChartStyle]=useState<'bars'|'line'>('bars')
 const airlineInfo=AIRLINES.find(a=>a.id===airline)
 const selectedAircraft=useMemo(()=>index.aircraft.filter(t=>matchesAirline(t,airline)),[index,airline])
 const activity=airlineSummary?.bins??index.bins
 const timelineBins=useMemo(()=>activity.map(bin=>({start:bin.time,end:bin.time+300,value:bin.count})),[activity])
 const results=useMemo(()=>searchAirports(index.airports,query,6) as Airport[],[index,query])
 const board=useMemo(()=>airport?airportBoardMovements(selectedAircraft,airport):{departures:[],arrivals:[]},[selectedAircraft,airport])
 const [boardOpen,setBoardOpen]=useState(true)
 const updateUi=()=>{const e=engine.current;setUi(p=>p.time===e.time&&p.playing===e.playing&&p.waiting===e.waiting?p:{...p,time:e.time,playing:e.playing,waiting:e.waiting})}
 async function seek(value:number,playback=false) {
  const e=engine.current,t=playback?value%86400:Math.max(0,Math.min(86399,value)),i=Math.floor(t/600)
  if(e.waiting&&playback)return
  const cached=store.cache.get(i)
  if(cached){const crossed=e.chunkIndex!==i;e.time=t;e.chunk=cached;e.chunkIndex=i;if(!playback){e.generation++;e.waiting=false;setStatus('Ready');updateUi()}if(crossed||!playback)store.prefetch(i);return}
  e.targetTime=t;const generation=++e.generation;e.waiting=true;store.retain(i);setStatus(e.chunk?'Buffering · clock paused':'Loading observations…');updateUi()
  try{const chunk=await store.load(i);if(generation!==e.generation)return;e.chunk=chunk;e.chunkIndex=i;e.time=t;e.waiting=false;setStatus('Ready');store.prefetch(i)}
  catch(err){if(generation!==e.generation)return;e.waiting=false;e.playing=false;setStatus(`${(err as Error).message} · Retry to continue`)}
  updateUi()
 }
 useEffect(()=>{
  const e=engine.current;map.current=new AirMap(canvas.current!,land,index.airports);let stopped=false,raf=0,last=performance.now(),lastDraw=0,lastUi=0
  let previousChunk:Chunk|undefined,previousAirline:AirlineSelection|undefined,tracks:Chunk['tracks']=[]
  void seek(e.time)
  if(new URLSearchParams(location.search).get('renderer')==='three')void chooseRenderer('three')
  const frame=(now:number)=>{
   if(stopped)return
   const elapsed=(now-last)/1000,dt=Math.min(.12,elapsed);last=now
   if(e.playing&&e.waiting)metrics.current.bufferSeconds+=elapsed
   if(!e.playing||e.waiting)metrics.current.lastPaint=0
   if(e.playing&&!e.waiting&&e.mode==='motion')void seek(e.time+dt*e.speed,true)
   if(now-lastDraw>=32 && e.chunk){
    if(previousChunk!==e.chunk||previousAirline!==e.airline){tracks=e.chunk.tracks.filter(t=>matchesAirline(t,e.airline));previousChunk=e.chunk;previousAirline=e.airline}
    const cells=e.airlineSummary?.cells??index.cells
    const before=map.current!.renderedFrames
    const counts=map.current!.draw(tracks,e.time,e.airport,e.mode,cells[Math.floor(e.time/3600)]);lastDraw=now
    if(e.playing&&!e.waiting&&map.current!.renderedFrames!==before){const m=metrics.current;if(m.lastPaint){m.intervals.push(now-m.lastPaint);if(m.intervals.length>300)m.intervals.shift()}m.lastPaint=now}
    if(now-lastUi>=200){const durations=map.current!.durations.slice().sort((a,b)=>a-b);setUi(previous=>{const next={time:e.time,playing:e.playing,waiting:e.waiting,...counts,cache:store.cache.size,ms:durations[Math.floor(durations.length*.95)]??0,downloaded:store.downloadedBytes};return (Object.keys(next) as (keyof typeof next)[]).every(key=>next[key]===previous[key])?previous:next});lastUi=now}
   }
   raf=requestAnimationFrame(frame)
  };raf=requestAnimationFrame(frame)
  const visibility=()=>{if(document.hidden){e.playing=false;updateUi()}};document.addEventListener('visibilitychange',visibility)
  return()=>{stopped=true;rendererGeneration.current++;cancelAnimationFrame(raf);e.generation++;store.dispose();map.current?.dispose();document.removeEventListener('visibilitychange',visibility)}
 },[store,land,index])
 async function chooseAirline(value:AirlineSelection){
  const generation=++airlineGeneration.current;setPendingAirline(value);setAirlineError('')
  try{
   const summary=value==='all'?undefined:await loadAirlineSummary(value)
   if(generation!==airlineGeneration.current)return
   setAirline(value);setAirlineSummary(summary);engine.current.airline=value;engine.current.airlineSummary=summary;setFlight('');if(map.current)map.current.selectedFlight=undefined
  }catch(error){if(generation===airlineGeneration.current)setAirlineError(`${(error as Error).message}. Select the airline again to retry.`)}
  finally{if(generation===airlineGeneration.current)setPendingAirline(undefined)}
 }
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
 const selected=useMemo(()=>flight?index.aircraft.find(t=>t.id===flight):undefined,[index,flight])
 return <main className="study">
  <header><div className="identity"><a className="eyebrow" href="https://emmettl.github.io/motionstudies/">Motion Studies / research</a><h1>LUFT<span>Flights over Europe</span></h1></div><div className="date">{new Date(`${manifest.date}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})}<span>Recorded observations · UTC</span></div></header>
  <div className="workspace">
   <section className="stage" aria-label="Map of observed aircraft over Europe">
    <canvas ref={canvas} aria-label="Aircraft map. Drag to pan; pinch to zoom. Use airport search to highlight movements." onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{pointers.current.clear();gesture.current.moved=true}} onWheel={e=>map.current?.zoom(e.deltaY>0?1.15:.87)}/>
    <div className="map-caption"><div className="clock">{stamp(ui.time)}<small> UTC</small></div><div className="count">{mode==='density'?`${airlineInfo?.name??'Full study window'} · hourly observations`:airport?`${ui.inbound} inbound · ${ui.outbound} outbound${airlineInfo?` · ${airlineInfo.name}`:''}`:`${ui.total.toLocaleString()}${airlineInfo?` ${airlineInfo.name}`:''} aircraft in the study window`}</div>{airport&&mode==='motion'&&<div className="airport-key"><span>● Inbound</span><span>● Outbound</span></div>}</div>
    {!engine.current.chunk&&<div className="initial-loading" role="status">{status}</div>}
    <div className="view-controls"><button onClick={()=>{map.current!.view={...EUROPE}}}>Europe</button><button onClick={()=>{map.current!.view={...BRITAIN}}}>Britain</button>{airport&&<button onClick={()=>map.current!.focus(airport)}>Near {airport.iata||airport.icao}</button>}<button aria-label="Zoom in" onClick={()=>map.current?.zoom(.7)}>+</button><button aria-label="Zoom out" onClick={()=>map.current?.zoom(1.4)}>−</button></div>
    {selected&&<div className="flight-caption"><strong>{selected.callsign}</strong><span>{selected.origin?.iata||'Unknown origin'} → {selected.destination?.iata||'Unknown destination'}</span><span>{selected.icaoAddress?.toUpperCase()} · observed track</span><button aria-label="Clear aircraft" onClick={()=>{setFlight('');map.current!.selectedFlight=undefined}}>×</button></div>}
    <div className="map-note">{mode==='density'?'One hour of observations · relative brightness':airport?'Other traffic dimmed · three-minute trails':'Three-minute trails · low-altitude tracks in gold'}</div>
   </section>
   <aside className={airport?'has-airport':''}>
    <div className="search"><label htmlFor="airport-search">Find an airport</label><div className="input-wrap"><span aria-hidden="true">⌕</span><input id="airport-search" value={query} placeholder="City, airport or code" autoComplete="off" role="combobox" aria-expanded={!!query.trim()} aria-controls="airport-results" aria-activedescendant={results[activeResult]?`result-${results[activeResult].id}`:undefined} onChange={e=>{setQuery(e.target.value);setActiveResult(0)}} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setActiveResult(i=>Math.min(results.length-1,i+1))}if(e.key==='ArrowUp'){e.preventDefault();setActiveResult(i=>Math.max(0,i-1))}if(e.key==='Enter'&&results[activeResult]){e.preventDefault();choose(results[activeResult])}if(e.key==='Escape')setQuery('')}}/></div>
     {query.trim()&&<div className="results" id="airport-results" role="listbox" aria-label="Airports">{results.length?results.map((a,i)=><button role="option" aria-selected={activeResult===i} id={`result-${a.id}`} key={a.id} onClick={()=>choose(a)}><strong>{a.iata||a.icao}</strong><span>{a.name}<small>{a.city} · {a.icao}</small></span></button>):<p>No matching airport.</p>}</div>}
    </div>
    <div className="renderer-picker"><label htmlFor="renderer">Aircraft renderer</label><select id="renderer" value={renderer} disabled={rendererLoading} onChange={e=>void chooseRenderer(e.target.value as 'canvas'|'three')}><option value="canvas">Canvas 2D</option><option value="three">Three.js · GPU</option></select>{rendererLoading&&<span role="status">Opening Three.js…</span>}{rendererNote&&<span role="status">{rendererNote}</span>}</div>
    <div className="airline-picker"><label htmlFor="airline">Follow an airline</label><select id="airline" value={pendingAirline??airline} onChange={e=>void chooseAirline(e.target.value as AirlineSelection)}><option value="all">All aircraft</option>{sortedAirlines.map(a=><option key={a.id} value={a.id}>{a.name} · {airlineCatalogue.airlines[a.id].aircraft}</option>)}</select>{pendingAirline&&<span className="airline-loading" role="status">Loading airline activity…</span>}{airlineError&&<p className="airline-error" role="alert">{airlineError}</p>}{airlineInfo&&<p className="airline-evidence"><span className="airline-identity"><span className={`airline-logo airline-logo--${airlineInfo.id}`}>{airlineLogos[`./assets/airlines/${airlineInfo.id}.svg`]?<img src={airlineLogos[`./assets/airlines/${airlineInfo.id}.svg`]} alt={`${airlineInfo.name} logo`} width="128" height="28"/>:<span>{airlineInfo.name}</span>}</span><strong>{airlineSummary!.aircraft.toLocaleString()} aircraft observed during this day</strong></span><span>{airlineInfo.note}. Callsign-based selection in the study window; partner-operated flights may be missing.</span></p>}</div>
    {airport?<><div className="selection-toolbar"><button className="text-button" onClick={()=>setBoardOpen(!boardOpen)} aria-expanded={boardOpen}>{boardOpen?'Hide':'Show'} airport board</button><button className="text-button" onClick={clear}>Clear airport ×</button></div>{boardOpen&&<AirportHeroCard key={airport.id} airport={{...airport,city:cityLabel(airport),iata:airport.iata||airport.icao}} departures={board.departures} arrivals={board.arrivals} study={{time:ui.time,windowStart:0,windowEnd:86400}} dateLabel={`${manifest.date} · UTC`} density="compact" maxRows={6} labels={{time:'Seen',emptyDepartures:'No observed departures in this window.',emptyArrivals:'No observed arrivals in this window.'}} note={`${airlineInfo?`${airlineInfo.name} movements. `:''}Airport associations inferred from observed trace endpoints. Times are observations, not schedules; blank routes remain unknown.`} selectedFlightId={flight} onSelectFlight={selectFlight}/>}<p className="association-note">{board.departures.length} outbound / {board.arrivals.length} inbound associations{airlineInfo?` for ${airlineInfo.name}`:''} in this recorded day.{!airport.hasObservedMovements?' No endpoint evidence for this airport; this does not mean no flights.':''}</p></>:<div className="intro"><span className="eyebrow">A continent in motion</span><h2>One day. Many networks.</h2><p>Follow one of {AIRLINES.length} carriers, or choose an airport to see the gathering and dispersal.</p><div className="suggestions">{['LHR','CDG','ZRH','AMS'].map(code=>{const a=index.airports.find(a=>a.iata===code);return a&&<button key={code} onClick={()=>choose(a)}>{code}<span>{cityLabel(a)}</span></button>})}</div><p className="quiet">An early study. The shape is visible; the thesis is still open.</p></div>}
   </aside>
  </div>
  <footer>
   <div className="transport"><button className="play" disabled={mode==='density'||!engine.current.chunk} onClick={()=>{engine.current.playing=!engine.current.playing;updateUi()}}>{ui.playing?'Pause':'Play'}</button><label className="speed-label">Pace <select aria-label="Playback speed" value={speed} onChange={e=>{const s=+e.target.value;setSpeed(s);engine.current.speed=s}}><option value="60">1 min / s</option><option value="300">5 min / s</option><option value="900">15 min / s</option></select></label><div className="mode-controls">{['motion','density'].map(m=><button key={m} aria-pressed={mode===m} onClick={()=>{setMode(m);engine.current.mode=m;engine.current.playing=false;updateUi()}}>{m==='motion'?'Motion':'Hour density'}</button>)}</div><button className="chart-style" aria-label={chartStyle==='bars'?'Show activity as a line':'Show activity as bars'} onClick={()=>setChartStyle(chartStyle==='bars'?'line':'bars')}>{chartStyle==='bars'?'▥ Bars':'⌁ Line'}</button><span className={`stream-status ${status==='Ready'?'is-ready':''}`} role="status">{status==='Ready'?(ui.playing?'Playing': 'Paused'):status}</span>{status.includes('Retry')&&<button onClick={()=>void seek(engine.current.targetTime)}>Retry</button>}</div>
   <StudyTimeline bins={timelineBins} windowStart={0} windowEnd={86400} time={ui.time} onSeek={time=>{engine.current.playing=false;void seek(time)}} onScrubStart={()=>{engine.current.playing=false;updateUi()}} label={`${airlineInfo?`${airlineInfo.name} · `:''}Aircraft observed · 5-minute snapshots`} ariaLabel="Time of day UTC" variant={chartStyle} formatValue={formatActivity} description="Full study window · UTC"/>
   <div className="colophon"><p>ADSB.lol & contributors · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL 1.0</a> · <a href="https://ourairports.com/data/">OurAirports</a> / <a href="https://www.naturalearthdata.com/about/terms-of-use/">Natural Earth</a> · public domain</p><div><button className="text-button" aria-expanded={diagnostics} onClick={()=>setDiagnostics(!diagnostics)}>Device details</button><a href="https://github.com/emmettl/luft">About / source ↗</a></div></div>
   {diagnostics&&<div className="diagnostics"><strong>On this device · {renderer==='three'?'Three.js':'Canvas'}</strong><span>Map draw p95: {ui.ms.toFixed(1)} ms</span><span>Paint interval p95: {percentile(metrics.current.intervals).toFixed(1)} ms · cap 30 Hz</span><span>{metrics.current.bufferSeconds.toFixed(1)} s buffering since reset</span>{renderer==='three'&&<span>{map.current?.gpuStats()?.calls??0} GPU draw calls · aircraft layer</span>}<span>{ui.cache} / 4 chunks in memory</span><span>{(ui.downloaded/1024/1024).toFixed(1)} MiB of track data downloaded this session</span><span>{ui.waiting?'Clock held while buffering':'Buffer ready'}</span><p>CPU submission time excludes asynchronous GPU completion, decoding, layout and network work. Compare the same view, carrier, clock and pace after warming the data. Ten-minute chunks are verified before display; gaps over 45 seconds remain gaps.</p><div className="comparison-actions"><button onClick={resetMeasurements}>Reset measurements</button><button onClick={()=>void copyMeasurements()}>Copy results</button></div>{copyNote&&<span role="status">{copyNote}</span>}</div>}
   <details className="method"><summary>About these observations</summary><div className="method-content"><p>Aircraft data: ADSB.lol &amp; contributors, ODbL 1.0. Airport reference: OurAirports. Land: Natural Earth. Airline marks identify the observed operator.</p><p>{manifest.method} Airline filters use observed operating callsigns, not ownership or ticket codes. Flights using partner operators or unidentified callsigns may be missing. The activity strip and density view follow the selected airline across the full study window; airport selection highlights movements and filters its board. Hour density uses 0.5° cells, normalized within each selection/hour; brightness cannot compare volumes across hours or airlines. Receiver coverage is incomplete. This is a recorded day, not live air traffic.</p><a href={`${import.meta.env.BASE_URL}data/manifest.json`}>Recorder release and source hashes ↗</a></div></details>
  </footer>
 </main>
}
createRoot(document.getElementById('root')!).render(<App/> )
