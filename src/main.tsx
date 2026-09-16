import React, {useEffect,useMemo,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {airportBoardMovements} from '@motionstudies/core/domain/airport'
import {AirportHeroCard} from '@motionstudies/web/components/AirportHeroCard'
import '@motionstudies/web/airport-hero-card.css'
import '@motionstudies/web/split-flap-board.css'
import {AirMap,BRITAIN,cityLabel} from './map'
import {ChunkStore,loadRelease,type Airport,type Chunk} from './data'
import {FlightSearch} from './FlightSearch'
import {EMPTY_SELECTION,matchesSelection,selectionActivity,observedRoutes,airlineLabel,type Selection} from './filters'
import {StudyTimeline} from '@motionstudies/web/components/StudyTimeline'
import '@motionstudies/web/study-timeline.css'
import './style.css'
import {version} from '../package.json'
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
 const {manifest,index,land,snapshots}=release,canvas=useRef<HTMLCanvasElement>(null),accentCanvas=useRef<HTMLCanvasElement>(null),map=useRef<AirMap|null>(null)
 const store=useMemo(()=>new ChunkStore(manifest.chunks),[manifest])
 const engine=useRef({time:7*3600,accentClock:0,playing:true,scrubbing:false,speed:300,chunk:undefined as Chunk|undefined,chunkIndex:-1,targetTime:7*3600,generation:0,waiting:false,airports:[] as Airport[],mode:'motion',flight:'',selectedIds:undefined as Set<string>|undefined,cells:index.cells})
 const [ui,setUi]=useState({time:7*3600,playing:true,waiting:true,total:0,inbound:0,outbound:0,visible:0,cache:0,ms:0,responseBytes:0})
 const [status,setStatus]=useState('Loading observations…'),[speed,setSpeed]=useState(300),[mode,setMode]=useState('motion'),[airport,setAirport]=useState<Airport>(),[flight,setFlight]=useState(''),[diagnostics,setDiagnostics]=useState(false)
 const [selection,setSelection]=useState<Selection>(EMPTY_SELECTION),[settings,setSettings]=useState(false)
 const [renderer,setRenderer]=useState<'canvas'|'three'>('canvas'),[rendererLoading,setRendererLoading]=useState(false),[rendererNote,setRendererNote]=useState(''),[copyNote,setCopyNote]=useState('')
 const rendererGeneration=useRef(0),metrics=useRef({intervals:[] as number[],lastPaint:0,bufferSeconds:0})
 const resetMeasurements=()=>{map.current?.resetMeasurements();metrics.current={intervals:[],lastPaint:0,bufferSeconds:0};setUi(p=>({...p,ms:0}));setCopyNote('')}
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
  const m=metrics.current,report={release:version,renderer,recordedDay:manifest.date,browser:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},time:engine.current.time,speed:engine.current.speed,mode,selection,airport:airport?.icao,view:map.current?.view,drawSamples:map.current?.durations.length,drawCpuMaxMs:Math.max(0,...(map.current?.durations??[])),drawCpuP95Ms:percentile(map.current?.durations??[]),stagesP95Ms:Object.fromEntries((['setup','sampling','geometry','submission'] as const).map(stage=>[stage,percentile(map.current?.stages.map(s=>s[stage])??[])])),paintIntervalP95Ms:percentile(m.intervals),paintRate:m.intervals.length?1000*m.intervals.length/m.intervals.reduce((a,b)=>a+b,0):0,bufferSeconds:m.bufferSeconds,gpu:map.current?.gpuStats(),trackCache:store.disk?.stats,note:'30 Hz paint cap. CPU timing excludes asynchronous GPU completion. Compare identical views and warmed data.'}
  try{await navigator.clipboard.writeText(JSON.stringify(report,null,2));setCopyNote('Results copied')}catch{setCopyNote('Clipboard unavailable. Use the timings displayed here.')}
 }
 const [chartStyle,setChartStyle]=useState<'bars'|'line'>('bars')
 const selectedAircraft=useMemo(()=>index.aircraft.filter(track=>matchesSelection(track,selection)),[index,selection])
 const selectedIds=useMemo(()=>new Set(selectedAircraft.map(track=>track.id)),[selectedAircraft])
 const selectedAirports=useMemo(()=>index.airports.filter(a=>selection.airports.includes(a.icao)),[index,selection.airports])
 const summary=useMemo(()=>selectionActivity(selectedAircraft,snapshots),[selectedAircraft,snapshots])
 const routes=useMemo(()=>observedRoutes(index.aircraft,index.airports),[index])
 const selectionLabel=[airlineLabel(selection.airlines),selectedAirports.map(a=>a.iata||a.icao).join(' + '),selection.routes.map(id=>routes.find(r=>r.id===id)!.label).join(' + ')].filter(Boolean).join(' · ')
 const timelineBins=useMemo(()=>summary.bins.map(bin=>({start:bin.time,end:bin.time+300,value:bin.count})),[summary])
 const board=useMemo(()=>airport?airportBoardMovements(selectedAircraft,airport):{departures:[],arrivals:[]},[selectedAircraft,airport])
 const [boardOpen,setBoardOpen]=useState(false)
 useEffect(()=>{engine.current.selectedIds=selectedIds;engine.current.airports=selectedAirports;engine.current.cells=summary.cells},[selectedIds,selectedAirports,summary])
 const changeSelection=(value:Selection)=>{
  map.current?.resetAccents();setSelection(value);setFlight('');if(map.current)map.current.selectedFlight=undefined
  if(airport&&!value.airports.includes(airport.icao)){setAirport(undefined);setBoardOpen(false)}
 }
 const updateUi=()=>{const e=engine.current;setUi(p=>p.time===e.time&&p.playing===e.playing&&p.waiting===e.waiting?p:{...p,time:e.time,playing:e.playing,waiting:e.waiting})}
 const togglePlayback=()=>{const e=engine.current;if(!e.chunk||e.mode!=='motion')return;e.playing=!e.playing;updateUi()}
 async function seek(value:number,playback=false) {
  if(!playback)map.current?.resetAccents()
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
  const e=engine.current;map.current=new AirMap(canvas.current!,land,index.airports,{west:manifest.bounds[0],south:manifest.bounds[1],east:manifest.bounds[2],north:manifest.bounds[3]},accentCanvas.current!);let stopped=false,raf=0,last=performance.now(),lastDraw=0,lastUi=0
  const motionPreference=matchMedia('(prefers-reduced-motion: reduce)')
  const motionChanged=()=>map.current?.setAccentsEnabled(!motionPreference.matches)
  motionChanged();motionPreference.addEventListener('change',motionChanged)
  let previousChunk:Chunk|undefined,previousIds:Set<string>|undefined,tracks:Chunk['tracks']=[]
  void seek(e.time)
  if(new URLSearchParams(location.search).get('renderer')==='three')void chooseRenderer('three')
  const frame=(now:number)=>{
   if(stopped)return
   const elapsed=(now-last)/1000,dt=Math.min(.12,elapsed);last=now
   if(e.playing&&e.waiting)metrics.current.bufferSeconds+=elapsed
   if(!e.playing||e.waiting||e.scrubbing)metrics.current.lastPaint=0
   if(e.playing&&!e.waiting&&!e.scrubbing&&e.mode==='motion'){e.accentClock+=elapsed;void seek(e.time+dt*e.speed,true)}
   if(now-lastDraw>=32 && e.chunk){
    if(previousChunk!==e.chunk||previousIds!==e.selectedIds){tracks=e.chunk.tracks.filter(t=>!e.selectedIds||e.selectedIds.has(t.id));previousChunk=e.chunk;previousIds=e.selectedIds}
    const cells=e.cells
    const before=map.current!.renderedFrames
    const counts=map.current!.draw(tracks,e.time,e.airports,e.mode,cells[Math.floor(e.time/3600)],e.accentClock);lastDraw=now
    if(e.playing&&!e.waiting&&!e.scrubbing&&map.current!.renderedFrames!==before){const m=metrics.current;if(m.lastPaint){m.intervals.push(now-m.lastPaint);if(m.intervals.length>300)m.intervals.shift()}m.lastPaint=now}
    if(now-lastUi>=200){const durations=map.current!.durations.slice().sort((a,b)=>a-b);setUi(previous=>{const next={time:e.time,playing:e.playing,waiting:e.waiting,...counts,cache:store.cache.size,ms:durations[Math.floor(durations.length*.95)]??0,responseBytes:store.disk?.stats.responseBytes??0};return (Object.keys(next) as (keyof typeof next)[]).every(key=>next[key]===previous[key])?previous:next});lastUi=now}
   }
   raf=requestAnimationFrame(frame)
  };raf=requestAnimationFrame(frame)
  const visibility=()=>{if(document.hidden){e.playing=false;updateUi()}};document.addEventListener('visibilitychange',visibility)
  const keydown=(event:KeyboardEvent)=>{
   if(event.key!==' '||event.defaultPrevented||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return
   const target=event.target
   if(target instanceof Element&&(target.closest('input,textarea,select,button,a[href],summary,[role="button"],[role="combobox"],[role="slider"],[role="option"]')||(target instanceof HTMLElement&&target.isContentEditable)))return
   if(!e.chunk||e.mode!=='motion')return
   event.preventDefault()
   if(!event.repeat)togglePlayback()
  };document.addEventListener('keydown',keydown)
  return()=>{stopped=true;rendererGeneration.current++;cancelAnimationFrame(raf);e.generation++;store.dispose();map.current?.dispose();document.removeEventListener('visibilitychange',visibility);document.removeEventListener('keydown',keydown);motionPreference.removeEventListener('change',motionChanged)}
 },[store,land,index])
 const choose=(a:Airport)=>{setAirport(a);setBoardOpen(true)}
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
    <canvas ref={canvas} aria-label="Aircraft map. Drag to pan; pinch to zoom. Use search to filter airports, airlines and routes." onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{pointers.current.clear();gesture.current.moved=true}} onWheel={e=>map.current?.zoom(e.deltaY>0?1.15:.87)}/>
    <canvas ref={accentCanvas} className="movement-layer" aria-hidden="true"/>
    <div className="map-caption"><div className="clock">{stamp(ui.time)}<small> UTC</small></div><div className="count">{mode==='density'?'Hourly density · 5-minute snapshots':`${ui.total.toLocaleString()} aircraft${selectionLabel?` · ${selectionLabel}`:' over Europe'}`}</div>{selectedAirports.length>0&&mode==='motion'&&<div className="airport-key"><span>● {ui.inbound} inbound</span><span>● {ui.outbound} outbound</span></div>}</div>
    {!engine.current.chunk&&<div className="initial-loading" role="status">{status}</div>}
    <div className="view-controls"><button onClick={()=>{map.current!.view={...map.current!.studyBounds}}}>Europe</button><button onClick={()=>{map.current!.view={...BRITAIN}}}>Britain</button>{airport&&<button onClick={()=>map.current!.focus(airport)}>Near {airport.iata||airport.icao}</button>}<button aria-label="Zoom in" onClick={()=>map.current?.zoom(.7)}>+</button><button aria-label="Zoom out" onClick={()=>map.current?.zoom(1.4)}>−</button></div>
    {selected&&<div className="flight-caption"><strong>{selected.callsign}</strong><span>{selected.origin?.iata||'Unknown origin'} → {selected.destination?.iata||'Unknown destination'}</span><span>{selected.icaoAddress?.toUpperCase()} · observed track</span><button aria-label="Clear aircraft" onClick={()=>{setFlight('');map.current!.selectedFlight=undefined}}>×</button></div>}
    <div className="map-note">{mode==='density'?'Five-minute snapshots · relative brightness':selectedAirports.length?'Selected airports · three-minute trails':'Three-minute trails · low-altitude tracks in gold'}</div>
   </section>
   <aside aria-label="Flight selection">
    <FlightSearch airports={index.airports} routes={routes} selection={selection} onChange={changeSelection} onAirportBoard={choose}/>
    {selectionLabel&&<p className="selection-summary">{summary.aircraft.toLocaleString()} aircraft observed · matching selection</p>}
    {selectedAirports.length>0&&<div className="board-launchers">{selectedAirports.map(a=><button key={a.icao} onClick={()=>{if(airport?.icao===a.icao&&boardOpen)setBoardOpen(false);else choose(a)}} aria-expanded={boardOpen&&airport?.icao===a.icao}>{a.iata||a.icao} board <span aria-hidden="true">{boardOpen&&airport?.icao===a.icao?'−':'+'}</span></button>)}</div>}
   </aside>
   {airport&&boardOpen&&<section className="airport-panel" aria-label={`${airport.iata||airport.icao} airport board`}><div className="panel-heading"><span>Observed movements</span><button aria-label="Close airport board" onClick={()=>setBoardOpen(false)}>×</button></div><AirportHeroCard key={airport.id} airport={{...airport,city:cityLabel(airport),iata:airport.iata||airport.icao}} departures={board.departures} arrivals={board.arrivals} study={{time:ui.time,windowStart:0,windowEnd:86400}} dateLabel={`${manifest.date} · UTC`} density="compact" maxRows={6} labels={{time:'Seen',emptyDepartures:'No observed departures in this selection.',emptyArrivals:'No observed arrivals in this selection.'}} note="Airport associations inferred from observed trace endpoints. Times are observations, not schedules; blank routes remain unknown." selectedFlightId={flight} onSelectFlight={selectFlight}/><p className="association-note">{board.departures.length} outbound / {board.arrivals.length} inbound associations in this selection.{!airport.hasObservedMovements?' No endpoint evidence for this airport; this does not mean no flights.':''}</p></section>}

  </div>
  <footer>
   <div className="transport"><div className="playback-controls"><button className="play" aria-keyshortcuts="Space" title="Play / pause (Space)" disabled={mode==='density'||!engine.current.chunk} onClick={togglePlayback}>{ui.playing?'Pause':'Play'}</button><label className="speed-label">Pace <select aria-label="Playback speed" value={speed} onChange={e=>{const s=+e.target.value;setSpeed(s);engine.current.speed=s}}><option value="60">1 min / s</option><option value="300">5 min / s</option><option value="900">15 min / s</option></select></label></div><button className="settings-toggle" aria-label="View settings" aria-expanded={settings} onClick={()=>setSettings(!settings)}>View <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="M2 4h12M2 12h12"/><circle cx="6" cy="4" r="2" fill="#101f2b"/><circle cx="10" cy="12" r="2" fill="#101f2b"/></svg></button><span className={`stream-status ${status==='Ready'?'is-ready':''}`} role="status">{status==='Ready'?(ui.playing?'Playing': 'Paused'):status}</span>{status.includes('Retry')&&<button onClick={()=>void seek(engine.current.targetTime)}>Retry</button>}</div>
   <StudyTimeline bins={timelineBins} windowStart={0} windowEnd={86400} time={ui.time} onSeek={time=>void seek(time)} onScrubStart={()=>{engine.current.scrubbing=true;updateUi()}} onScrubEnd={()=>{engine.current.scrubbing=false}} label={selectionLabel||'Aircraft over Europe'} ariaLabel="Time of day UTC" variant={chartStyle} formatValue={formatActivity} description="5-minute snapshots · UTC"/>
   <div className="colophon"><p><a href="https://www.adsb.lol/">ADSB.lol</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a></p><button className="text-button" aria-expanded={diagnostics} onClick={()=>setDiagnostics(!diagnostics)}>Device details</button><details className="method"><summary>About LUFT</summary><div className="method-content"><p>Aircraft data: ADSB.lol &amp; contributors, ODbL 1.0. Airport reference: OurAirports. Land: Natural Earth. Airline marks identify the observed operator. <a href="https://ourairports.com/">OurAirports</a> and <a href="https://www.naturalearthdata.com/">Natural Earth</a>: public domain.</p><p>{manifest.method} Brief gold departure and cyan arrival rings mark airport-linked observations, not confirmed wheels-up or touchdown times. Airline filters use observed operating callsigns, not ownership or ticket codes. Flights using partner operators or unidentified callsigns may be missing. Airlines, airports and routes combine across groups; multiple choices within a group are alternatives. The map, activity strip, density and airport boards follow the same selection. Hour density counts five-minute observations in 0.5° cells, normalized within each selection/hour; brightness cannot compare volumes across hours or airlines. Receiver coverage is incomplete. This is a recorded day, not live air traffic.</p><a href={`${import.meta.env.BASE_URL}data/manifest.json`}>Recorder release and source hashes ↗</a></div></details></div>
   {settings&&<section className="view-settings" aria-label="View settings"><div className="panel-heading"><span>View settings</span><button aria-label="Close view settings" onClick={()=>setSettings(false)}>×</button></div><div className="mode-controls">{['motion','density'].map(m=><button key={m} aria-pressed={mode===m} onClick={()=>{setMode(m);engine.current.mode=m;engine.current.playing=false;updateUi()}}>{m==='motion'?'Motion':'Hour density'}</button>)}</div><button className="chart-style" aria-label={chartStyle==='bars'?'Show activity as a line':'Show activity as bars'} onClick={()=>setChartStyle(chartStyle==='bars'?'line':'bars')}>{chartStyle==='bars'?'▥ Bars':'⌁ Line'}</button><div className="renderer-picker"><label htmlFor="renderer">Aircraft renderer</label><select id="renderer" value={renderer} disabled={rendererLoading} onChange={e=>void chooseRenderer(e.target.value as 'canvas'|'three')}><option value="canvas">Canvas 2D</option><option value="three">Three.js · GPU</option></select>{rendererLoading&&<span role="status">Opening Three.js…</span>}{rendererNote&&<span role="status">{rendererNote}</span>}</div><p>Density counts observed five-minute snapshots. Route filters use inferred endpoints in either direction; unknown routes are excluded.</p></section>}
   {diagnostics&&<div className="diagnostics"><strong>On this device · {renderer==='three'?'Three.js':'Canvas'} · {version}</strong><span>Map draw p95: {ui.ms.toFixed(1)} ms · max {Math.max(0,...(map.current?.durations??[])).toFixed(1)} ms</span><span>CPU stages p95 · setup {percentile(map.current?.stages.map(s=>s.setup)??[]).toFixed(1)} · sampling {percentile(map.current?.stages.map(s=>s.sampling)??[]).toFixed(1)} · {renderer==='three'?'geometry':'Canvas drawing'} {percentile(map.current?.stages.map(s=>s.geometry)??[]).toFixed(1)} · submission {percentile(map.current?.stages.map(s=>s.submission)??[]).toFixed(1)} ms</span><span>Paint interval p95: {percentile(metrics.current.intervals).toFixed(1)} ms · cap 30 Hz</span><span>{metrics.current.bufferSeconds.toFixed(1)} s buffering since reset</span>{renderer==='three'&&<span>{map.current?.gpuStats()?.calls??0} GPU draw calls · aircraft layer</span>}{renderer==='three'&&<span>{((map.current?.gpuStats()?.geometryPreparedBytes??0)/1024).toFixed(0)} KiB geometry rebuilt · {((map.current?.gpuStats()?.stateUploadBytes??0)/1024).toFixed(0)} KiB aircraft state per frame · {map.current?.gpuStats()?.geometryBuilds??0} geometry builds</span>}<span>{ui.cache} / 4 chunks in memory</span><span>{(ui.responseBytes/1024/1024).toFixed(1)} MiB track response data · HTTP cache may contribute</span><span>{((store.disk?.stats.localBytes??0)/1024/1024).toFixed(1)} MiB reused from local storage · {store.disk?.stats.localHits??0} cache hits</span><span>{store.disk?.stats.savedChunks??0} chunks saved on device · {((store.disk?.stats.savedBytes??0)/1024/1024).toFixed(1)} MiB</span>{store.disk?.stats.storage!=='available'&&<span>{store.disk?.stats.storage==='opening'?'Opening local cache…':store.disk?.stats.storage==='full'?'Local storage full; playback continues using fetch.':'Local storage unavailable; playback continues using fetch.'}</span>}<span>{ui.waiting?'Clock held while buffering':'Buffer ready'}</span><p>Stage percentiles are independent and do not add up. CPU submission time excludes asynchronous GPU completion, decoding, layout and network work. Compare the same view, carrier, clock and pace after warming the data. Ten-minute chunks are verified before display; gaps over 45 seconds remain gaps.</p><div className="comparison-actions"><button onClick={resetMeasurements}>Reset measurements</button><button onClick={()=>void copyMeasurements()}>Copy results</button></div>{copyNote&&<span role="status">{copyNote}</span>}</div>}

  </footer>
 </main>
}
createRoot(document.getElementById('root')!).render(<App/> )
