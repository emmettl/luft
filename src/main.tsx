import {airportLabelRanks,type AirportLabel} from './airport-labels'
import React, {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {airportBoardMovements} from '@motionstudies/core/domain/airport'
import {AirportHeroCard} from '@motionstudies/web/components/AirportHeroCard'
import '@motionstudies/web/airport-hero-card.css'
import '@motionstudies/web/split-flap-board.css'
import {AirMap,BRITAIN,cityLabel} from './map'
import {MapGesture} from './map-gesture'
import {ChunkStore,loadRelease,type Airport,type Chunk} from './data'
import {FlightSearch} from './FlightSearch'
import {Insights} from './InsightsPanel'
import {Moments} from './MomentsPanel'
import {momentTime,type Moment} from './moments'
import {airportMoments} from './spatial-moments'
import {FlightProfile} from './FlightProfile'
import type {FlightRoute} from './flight-route'
import {countryLabel,continentLabel} from './geography'
import {selectionOptions,selectionFromHash,selectionHash,endpointFromHash} from './selection-url'
import {EndpointFilters} from './EndpointFilters'
import {createEndpointResolver,endpointCoverage,usableEndpoint} from '@motionstudies/core/air-enrichment'
import {EMPTY_ENDPOINT_FILTER,matchesEndpointFilter,endpointFilterTitle,endpointFilterActive,evidenceName,type EndpointFilter} from './endpoint-filters'
import {loadFlightRoute} from './flight-route-data'
import {countryAirportIds} from './countries'
import {EMPTY_SELECTION,matchesSelection,selectionActivity,observedRoutes,airlineLabel,type Selection} from './filters'
import {useWatchMode} from './use-watch-mode'
import {FlightTimeline} from './FlightTimeline'
import {SoundControl,useSoundtrack} from './SoundControl'
import '@motionstudies/web/study-timeline.css'
import './style.css'
import {version} from '../package.json'
import {airportActivity,type ActivitySeries} from './activity'
import {ActivityChart} from './ActivityChart'
import {ComparisonPanel} from './ComparisonPanel'
import {AIRLINES,airlineForTrack,type AirlineId} from './airlines'
import {sceneDay,sceneFromHash,sceneHash} from './scene-url'
import {exportScene} from './scene-export'
const percentile=(values:number[],fraction=.95)=>{const sorted=values.slice().sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*fraction))]??0}
const formatActivity=(n:number)=>`${n.toLocaleString()} aircraft`
type Release=Awaited<ReturnType<typeof loadRelease>>
const stamp=(n:number)=>`${String(Math.floor(n/3600)).padStart(2,'0')}:${String(Math.floor(n/60)%60).padStart(2,'0')}`
function App(){
 const [release,setRelease]=useState<Release>(),[error,setError]=useState('')
 const [newDay,setNewDay]=useState('')
 useEffect(()=>{loadRelease().then(setRelease).catch(e=>setError(e.message))},[])
 useEffect(()=>{
  if(!release)return
  let disposed=false
  const check=async()=>{if(document.hidden)return;try{const response=await fetch(`${import.meta.env.BASE_URL}feed.json`,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)return;const latest=await response.json();if(!disposed&&/^\d{4}-\d{2}-\d{2}$/.test(latest.date)&&latest.date>release.manifest.date)setNewDay(latest.date)}catch{/* Keep the recorded day usable when offline. */}}
  void check();const timer=setInterval(()=>void check(),5*60*1000)
  window.addEventListener('focus',check);document.addEventListener('visibilitychange',check)
  return()=>{disposed=true;clearInterval(timer);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check)}
 },[release])
 const sharedDay=sceneDay(location.hash)
 if(release&&sharedDay&&sharedDay!==release.manifest.date)return <main className="opening"><span className="eyebrow">Motion Studies / shared scene</span><h1>LUFT</h1><p>This scene was recorded on {sharedDay}.</p><p>The available day is now {release.manifest.date}. The original scene cannot be replayed from this edition.</p><button onClick={()=>{history.replaceState(null,'',location.pathname+location.search);location.reload()}}>Explore the current day</button></main>
 return <>{release?<Study release={release}/>:<main className="opening"><span className="eyebrow">Motion Studies / research</span><h1>LUFT</h1><p role="status">{error||'Opening a day over Europe…'}</p>{error&&<button onClick={()=>location.reload()}>Retry</button>}</main>}{newDay&&<button className="new-day" onClick={()=>location.reload()}>New recorded day · {newDay} · Refresh</button>}</>
}
function Study({release}:{release:Release}) {
 const sound=useSoundtrack()
 const {manifest,index,land,snapshots,countries,enrichment,holding}=release,canvas=useRef<HTMLCanvasElement>(null),accentCanvas=useRef<HTMLCanvasElement>(null),map=useRef<AirMap|null>(null)
 const flightIds=useMemo(()=>new Set(index.aircraft.map(track=>track.id)),[index])
 const initialScene=useMemo(()=>sceneFromHash(location.hash,manifest.date,flightIds),[manifest.date,flightIds])
 const store=useMemo(()=>new ChunkStore(manifest.chunks),[manifest])
 const engine=useRef({time:initialScene?.time??7*3600,accentClock:0,playing:!initialScene,scrubbing:false,speed:300,chunk:undefined as Chunk|undefined,chunkIndex:-1,targetTime:initialScene?.time??7*3600,generation:0,waiting:false,airports:[] as Airport[],mode:initialScene?.mode??'motion',dimOthers:initialScene?.dimOthers??true,flight:'',selectedIds:undefined as Set<string>|undefined,cells:index.cells,scene:undefined as Moment|undefined,sceneAirport:index.airports.find(airport=>airport.icao===initialScene?.focus),followEnd:86400})
 const [ui,setUi]=useState({time:initialScene?.time??7*3600,playing:!initialScene,waiting:true,total:0,inbound:0,outbound:0,visible:0,cache:0,ms:0,responseBytes:0,following:''})
 const [status,setStatus]=useState('Loading observations…'),[speed,setSpeed]=useState(300),[mode,setMode]=useState(initialScene?.mode??'motion'),[airport,setAirport]=useState<Airport>(),[flight,setFlight]=useState(initialScene?.flight??''),[diagnostics,setDiagnostics]=useState(false)
 const [scene,setScene]=useState<Moment>()
 const clearScene=()=>{setShareOpen(false);engine.current.scene=undefined;engine.current.sceneAirport=undefined;setScene(undefined)}
 const studySurface=useRef<HTMLElement>(null),watchPlayback=useRef<{mode:string;playing:boolean;speed:number}|undefined>(undefined)
 const watch=useWatchMode(studySurface,()=>{
  clearScene();map.current?.followFlight();const e=engine.current;watchPlayback.current={mode:e.mode,playing:e.playing,speed:e.speed}
  e.mode='motion';e.playing=true;e.speed=60;setMode('motion');setSpeed(60)
  map.current?.setWatchMode(true)
 },()=>{
  const saved=watchPlayback.current;if(saved){Object.assign(engine.current,saved);setMode(saved.mode as 'motion'|'density');setSpeed(saved.speed)}
  map.current?.setWatchMode(false)
 })
 const filterOptions=useMemo(()=>({...selectionOptions(index,countries.map(country=>country.code)),endpointAirports:new Set(enrichment.airports.map(a=>a.icao))}),[index,enrichment,countries])
 const [selection,setSelection]=useState<Selection>(()=>selectionFromHash(location.hash,filterOptions)),[settings,setSettings]=useState(false),[dimOthers,setDimOthers]=useState(initialScene?.dimOthers??true)
 const [compare,setCompare]=useState(new URLSearchParams(location.hash.slice(1)).get('compare')==='1')
 const comparing=compare&&selection.airlines.length===2&&mode==='motion'
 const [shareOpen,setShareOpen]=useState(false),[shareLink,setShareLink]=useState(''),[shareNote,setShareNote]=useState(''),[exporting,setExporting]=useState(false)
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
  const m=metrics.current,report={release:version,renderer,recordedDay:manifest.date,browser:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},time:engine.current.time,speed:engine.current.speed,mode,dimOthers,selection,airport:airport?.icao,view:map.current?.view,drawSamples:map.current?.durations.length,drawCpuMaxMs:Math.max(0,...(map.current?.durations??[])),drawCpuP95Ms:percentile(map.current?.durations??[]),stagesP95Ms:Object.fromEntries((['setup','sampling','geometry','submission'] as const).map(stage=>[stage,percentile(map.current?.stages.map(s=>s[stage])??[])])),paintIntervalP95Ms:percentile(m.intervals),paintRate:m.intervals.length?1000*m.intervals.length/m.intervals.reduce((a,b)=>a+b,0):0,bufferSeconds:m.bufferSeconds,gpu:map.current?.gpuStats(),trackCache:store.disk?.stats,note:'30 Hz paint cap. CPU timing excludes asynchronous GPU completion. Compare identical views and warmed data.'}
  try{await navigator.clipboard.writeText(JSON.stringify(report,null,2));setCopyNote('Results copied')}catch{setCopyNote('Clipboard unavailable. Use the timings displayed here.')}
 }
 const [endpointFilter,setEndpointFilter]=useState<EndpointFilter>(()=>endpointFromHash(location.hash,filterOptions)),[endpointsOpen,setEndpointsOpen]=useState(false)
 const resolveEndpoint=useMemo(()=>createEndpointResolver(enrichment),[enrichment])
 const changeEndpointFilter=(value:EndpointFilter)=>{clearScene();map.current?.followFlight();writeFilterUrl(selection,value);setEndpointFilter(value);setFlight('');if(map.current){map.current.selectedFlight=undefined;map.current.resetMotionEffects()}}
 const [daylight,setDaylight]=useState(initialScene?.daylight??true)
 useEffect(()=>setShareOpen(false),[selection,endpointFilter,daylight,dimOthers,flight,comparing])
 const [chartStyle,setChartStyle]=useState<'bars'|'line'>('bars')
 const countryIds=useMemo(()=>countryAirportIds(countries,selection.countries),[countries,selection.countries])
 const selectedCountries=useMemo(()=>countries.filter(c=>selection.countries.includes(c.code)),[countries,selection.countries])
 const baseAircraft=useMemo(()=>index.aircraft.filter(track=>matchesSelection(track,selection)),[index,selection])
 const selectedAircraft=useMemo(()=>baseAircraft.filter(track=>matchesEndpointFilter(track,endpointFilter,resolveEndpoint)),[baseAircraft,endpointFilter,resolveEndpoint])
 const insightIndex=useMemo(()=>({...index,aircraft:index.aircraft.filter(track=>matchesEndpointFilter(track,endpointFilter,resolveEndpoint))}),[index,endpointFilter,resolveEndpoint])
 const coverage=useMemo(()=>endpointCoverage(baseAircraft,resolveEndpoint,endpointFilter.side,endpointFilter.includeCandidates),[baseAircraft,resolveEndpoint,endpointFilter])
 const connectedAirportIds=useMemo(()=>new Set([...selection.airports,...countryIds,...selectedAircraft.flatMap(track=>[track.origin?.icao,track.destination?.icao].filter((code):code is string=>!!code))]),[selectedAircraft,selection.airports,countryIds])
 const selectedIds=useMemo(()=>new Set(selectedAircraft.map(track=>track.id)),[selectedAircraft])
 const [airportLabels,setAirportLabels]=useState<AirportLabel[]>([])
 const labelRanks=useMemo(()=>airportLabelRanks(index.airports,index.aircraft),[index])
 const selectedAirports=useMemo(()=>index.airports.filter(a=>selection.airports.includes(a.icao)),[index,selection.airports])
 const summary=useMemo(()=>selectionActivity(selectedAircraft,snapshots),[selectedAircraft,snapshots])
 const scenes=useMemo(()=>airportMoments(selectedAircraft,index.airports),[selectedAircraft,index.airports])
 const comparisonGroups=useMemo(()=>comparing?new Map(selectedAircraft.map(track=>[track.id,selection.airlines.indexOf(airlineForTrack(track)!)+1])):undefined,[comparing,selectedAircraft,selection.airlines])
 const comparisonSeries=useMemo<ActivitySeries[]>(()=>comparing?selection.airlines.map((id,i)=>({label:AIRLINES.find(airline=>airline.id===id)!.name,colour:i?'#efbd72':'#81d9f1',dashed:!!i,values:selectionActivity(selectedAircraft.filter(track=>airlineForTrack(track)===id),snapshots).bins.map(bin=>bin.count)})):[],[comparing,selection.airlines,selectedAircraft,snapshots])
 useEffect(()=>{map.current?.setComparison(comparisonGroups)},[comparisonGroups])
 const routes=useMemo(()=>observedRoutes(index.aircraft,index.airports),[index])
 const selectionLabel=[endpointFilterTitle(endpointFilter,enrichment.airports.find(a=>a.icao===endpointFilter.airport)?.iata||endpointFilter.airport),airlineLabel(selection.airlines),selection.airports.map(code=>index.airports.find(a=>a.icao===code)?.iata||code).join(' + '),selection.routes.map(id=>routes.find(r=>r.id===id)!.label).join(' + '),selection.countries.map(code=>countries.find(c=>c.code===code)?.name||countryLabel(code)).join(' + '),selection.continents.map(continentLabel).join(' + ')].filter(Boolean).join(' · ')
 const timelineBins=useMemo(()=>summary.bins.map(bin=>({start:bin.time,end:bin.time+300,value:bin.count})),[summary])
 const airportSeries=useMemo(()=>airport?airportActivity(selectedAircraft,airport.icao):[],[selectedAircraft,airport])
 const board=useMemo(()=>airport?airportBoardMovements(selectedAircraft,airport):{departures:[],arrivals:[]},[selectedAircraft,airport])
 const [boardOpen,setBoardOpen]=useState(false)
 useEffect(()=>{engine.current.selectedIds=selectedIds;engine.current.airports=selectedAirports;engine.current.cells=summary.cells},[selectedIds,selectedAirports,summary])
 const applySelection=useCallback((value:Selection)=>{
  clearScene();map.current?.followFlight()
  if(value.countries.join('|')!==selection.countries.join('|')){map.current?.setCountries(countries,value.countries);if(value.countries.length)map.current?.frameCountries(value.countries);else if(value.airports.length)map.current?.frameAirports(index.airports.filter(a=>value.airports.includes(a.icao)));else map.current?.transitionTo(map.current.studyBounds)}
  else if(value.airports.join('|')!==selection.airports.join('|')){if(!value.airports.length&&value.countries.length)map.current?.frameCountries(value.countries);else map.current?.frameAirports(index.airports.filter(a=>value.airports.includes(a.icao)))}
  map.current?.resetMotionEffects();setSelection(value);setFlight('');if(map.current)map.current.selectedFlight=undefined
  if(airport&&!value.airports.includes(airport.icao)){setAirport(undefined);setBoardOpen(false)}
 },[airport,selection,countries,index])
 const writeFilterUrl=(value:Selection,endpoint:EndpointFilter,comparison=compare)=>{
  const url=new URL(location.href),params=new URLSearchParams(selectionHash(value,endpoint).replace(/^#/,''))
  if(comparison&&value.airlines.length===2)params.set('compare','1')
  url.hash=params.toString()
  if(url.href!==location.href)history.pushState(null,'',url)
 }
 const changeSelection=(value:Selection)=>{writeFilterUrl(value,endpointFilter);applySelection(value)}
 const clearFilters=()=>{setCompare(false);writeFilterUrl(EMPTY_SELECTION,EMPTY_ENDPOINT_FILTER);applySelection(EMPTY_SELECTION);setEndpointFilter(EMPTY_ENDPOINT_FILTER)}
 useEffect(()=>{
  const restore=()=>{
   const date=sceneDay(location.hash);if(date&&date!==manifest.date){location.reload();return}
   applySelection(selectionFromHash(location.hash,filterOptions));setEndpointFilter(endpointFromHash(location.hash,filterOptions));setCompare(new URLSearchParams(location.hash.slice(1)).get('compare')==='1')
   const shared=sceneFromHash(location.hash,manifest.date,flightIds)
   if(shared){
    engine.current.playing=false;engine.current.mode=shared.mode;engine.current.dimOthers=shared.dimOthers;setMode(shared.mode);setDimOthers(shared.dimOthers);setDaylight(shared.daylight);setFlight(shared.flight??'')
    if(map.current){map.current.followFlight();if(shared.view)map.current.view=shared.view;map.current.selectedFlight=shared.flight;map.current.setDaylightEnabled(shared.daylight)}
    engine.current.sceneAirport=index.airports.find(airport=>airport.icao===shared.focus)
    void seek(shared.time,false,true)
   }
  }
  window.addEventListener('hashchange',restore)
  return()=>window.removeEventListener('hashchange',restore)
 },[filterOptions,applySelection,manifest.date,flightIds])
 const changeComparison=(enabled:boolean,pair:AirlineId[]=selection.airlines.length===2?selection.airlines:['swiss','easyjet'])=>{
  if(pair.length!==2||pair[0]===pair[1])return
  const next=enabled?{...selection,airlines:pair}:selection
  writeFilterUrl(next,endpointFilter,enabled);applySelection(next);setCompare(enabled);setSettings(false);setBoardOpen(false)
  if(enabled){engine.current.mode='motion';setMode('motion')}
 }
 const chartSeek=(time:number)=>{engine.current.playing=false;engine.current.mode='motion';setMode('motion');return seek(time)}
 const openShare=()=>{
  engine.current.playing=false;map.current?.followFlight();updateUi();setShareNote('');setSettings(false)
  const url=new URL(location.href);url.search='';url.hash=sceneHash(selection,endpointFilter,{day:manifest.date,time:engine.current.time,view:map.current?.view,flight:flight||undefined,focus:engine.current.sceneAirport?.icao,mode:mode as 'motion'|'density',daylight,dimOthers,compare:comparing})
  setShareLink(url.href);setShareOpen(true)
 }
 const saveImage=async()=>{
  const e=engine.current;if(!e.chunk||!map.current)return
  setExporting(true);setShareNote('');e.playing=false;map.current.followFlight();updateUi()
  try{
   const tracks=e.dimOthers?e.chunk.tracks:e.chunk.tracks.filter(track=>!e.selectedIds||e.selectedIds.has(track.id))
   map.current.draw(tracks,e.time,e.sceneAirport??e.airports,e.mode,e.cells[Math.floor(e.time/3600)],e.accentClock,e.dimOthers?e.selectedIds:undefined)
   await exportScene(map.current.snapshot(),{date:manifest.date,time:e.time,selection:selectionLabel,flight:index.aircraft.find(track=>track.id===flight)?.callsign,comparison:comparing?comparisonSeries.map(row=>row.label):undefined,mode:e.mode});setShareNote('Image saved')
  }catch{setShareNote('The image could not be saved. Try again.')}finally{setExporting(false)}
 }
 const updateUi=()=>{const e=engine.current;setUi(p=>({...p,time:e.time,playing:e.playing,waiting:e.waiting,following:map.current?.followedFlight??''}))}
 const togglePlayback=()=>{setShareOpen(false);const e=engine.current;if(!e.chunk||e.mode!=='motion')return;if(e.scene&&e.time>=e.scene.endTime!){e.playing=true;void seek(e.scene.time,false,true)}else e.playing=!e.playing;updateUi()}
 async function seek(value:number,playback=false,preserveScene=false) {
  if(!playback&&!preserveScene)clearScene()
  if(!playback)map.current?.resetMotionEffects()
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
  const e=engine.current;map.current=new AirMap(canvas.current!,land,index.airports,{west:manifest.bounds[0],south:manifest.bounds[1],east:manifest.bounds[2],north:manifest.bounds[3]},accentCanvas.current!,manifest.date,{ranks:labelRanks,onChange:setAirportLabels});map.current.setHoldingEvidence(holding.tracks);map.current.setCountries(countries,selection.countries);if(selection.countries.length)map.current.frameCountries(selection.countries);else if(selectedAirports.length)map.current.frameAirports(selectedAirports);map.current.setComparison(comparisonGroups);map.current.setDaylightEnabled(daylight);if(initialScene){map.current.followFlight();if(initialScene.view)map.current.view=initialScene.view;map.current.selectedFlight=initialScene.flight}let stopped=false,raf=0,last=performance.now(),lastDraw=0,lastUi=0
  const motionPreference=matchMedia('(prefers-reduced-motion: reduce)')
  const motionChanged=()=>map.current?.setMotionEffectsEnabled(!motionPreference.matches)
  motionChanged();motionPreference.addEventListener('change',motionChanged)
  let previousChunk:Chunk|undefined,previousIds:Set<string>|undefined,previousDimOthers:boolean|undefined,tracks:Chunk['tracks']=[]
  void seek(e.time,false,true)
  if(new URLSearchParams(location.search).get('renderer')==='three')void chooseRenderer('three')
  const frame=(now:number)=>{
   if(stopped)return
   const elapsed=(now-last)/1000,dt=Math.min(.12,elapsed);last=now
   if(e.playing&&e.waiting)metrics.current.bufferSeconds+=elapsed
   if(!e.playing||e.waiting||e.scrubbing)metrics.current.lastPaint=0
   if(e.playing&&!e.waiting&&!e.scrubbing&&e.mode==='motion'){
    e.accentClock+=elapsed
    const next=e.time+dt*e.speed,end=e.scene?.endTime??(map.current?.followedFlight?e.followEnd:undefined)
    if(end!==undefined&&next>=end){e.playing=false;if(map.current?.followedFlight)map.current.followFlight();void seek(end,false,true)}
    else void seek(next,true)
   }
   if(now-lastDraw>=32 && e.chunk){
    if(previousChunk!==e.chunk||previousIds!==e.selectedIds||previousDimOthers!==e.dimOthers){tracks=e.dimOthers?e.chunk.tracks:e.chunk.tracks.filter(t=>!e.selectedIds||e.selectedIds.has(t.id));previousChunk=e.chunk;previousIds=e.selectedIds;previousDimOthers=e.dimOthers}
    const cells=e.cells
    const before=map.current!.renderedFrames
    const counts=map.current!.draw(tracks,e.time,e.sceneAirport??e.airports,e.mode,cells[Math.floor(e.time/3600)],e.accentClock,e.dimOthers?e.selectedIds:undefined);lastDraw=now
    if(e.playing&&!e.waiting&&!e.scrubbing&&map.current!.renderedFrames!==before){const m=metrics.current;if(m.lastPaint){m.intervals.push(now-m.lastPaint);if(m.intervals.length>300)m.intervals.shift()}m.lastPaint=now}
    if(now-lastUi>=200){const durations=map.current!.durations.slice().sort((a,b)=>a-b);setUi(previous=>{const next={time:e.time,playing:e.playing,waiting:e.waiting,...counts,cache:store.cache.size,ms:durations[Math.floor(durations.length*.95)]??0,responseBytes:store.disk?.stats.responseBytes??0,following:map.current?.followedFlight??''};return (Object.keys(next) as (keyof typeof next)[]).every(key=>next[key]===previous[key])?previous:next});lastUi=now}
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
 },[store,land,index,labelRanks,countries])
 useEffect(()=>{
  const elements=[...document.querySelectorAll('.study>header .identity,.study>header .date,.selection-tools,.context-panels,.map-caption,.view-controls,.study>footer,.airport-panel,.view-settings,.diagnostics,.flight-caption,.scene-caption,.comparison-panel,.share-panel,.endpoint-panel')]
  const update=()=>{
   const origin=canvas.current?.getBoundingClientRect();if(!origin)return
   map.current?.setLabelObstacles(elements.map(element=>{const r=element.getBoundingClientRect();return {left:r.left-origin.left-6,right:r.right-origin.left+6,top:r.top-origin.top-6,bottom:r.bottom-origin.top+6}}))
   const card=document.querySelector('.flight-caption')?.getBoundingClientRect(),tools=document.querySelector('.selection-tools')?.getBoundingClientRect()
   map.current?.setFollowScreenY(matchMedia('(max-width:999px)').matches&&card&&tools?(tools.bottom+card.top)/2-origin.top:undefined)
  }
  const observer=new ResizeObserver(update);elements.forEach(element=>observer.observe(element));update()
  return()=>observer.disconnect()
 },[selection,boardOpen,settings,diagnostics,flight,endpointsOpen,scene,comparing,shareOpen])
 const selectAirportLabel=(a:Airport)=>{
  clearScene();map.current?.followFlight()
  if(!selection.airports.includes(a.icao))changeSelection({...selection,airports:[...selection.airports,a.icao]})
  setFlight('');if(map.current)map.current.selectedFlight=undefined
  setAirport(a);setBoardOpen(true)
 }
 const choose=(a:Airport)=>{setAirport(a);setBoardOpen(true)}
 const exploreMoment=(moment:Moment,play=false)=>{
  engine.current.playing=play;engine.current.mode='motion';setMode('motion');setFlight('');setBoardOpen(false);setSettings(false);setEndpointsOpen(false)
  const place=index.airports.find(airport=>airport.icao===moment.airport)
  if(map.current){map.current.selectedFlight=undefined;if(place)map.current.focus(place);else if(selectedAirports.length)map.current.frameAirports(selectedAirports);else if(selection.countries.length)map.current.frameCountries(selection.countries);else map.current.transitionTo(map.current.studyBounds)}
  if(play){engine.current.speed=60;setSpeed(60)}
  const active={...moment,endTime:Math.min(86399,moment.endTime??moment.time+3600)}
  engine.current.scene=active;engine.current.sceneAirport=place;setScene(active)
  void seek(moment.time,false,true)
 }
 const selectFlight=(id:string)=>{clearScene();map.current?.followFlight();const track=index.aircraft.find(t=>t.id===id);if(!track)return;setFlight(id);map.current!.selectedFlight=id;engine.current.playing=false
  const endpoint=track.origin?.icao===airport?.icao?track.origin:track.destination?.icao===airport?.icao?track.destination:undefined
  void seek(Math.min(track.end,Math.max(track.start,endpoint?.time??engine.current.time)))
 }
 const gesture=useRef(new MapGesture())
 const down=(event:React.PointerEvent)=>{event.currentTarget.setPointerCapture(event.pointerId);gesture.current.down(event)}
 const move=(event:React.PointerEvent)=>{if(map.current)gesture.current.move(event,{pan:(x,y)=>{if(x||y)clearScene();map.current?.pan(x,y)},zoom:factor=>{clearScene();map.current?.zoom(factor)}})}
 const up=(event:React.PointerEvent)=>{if(!gesture.current.up(event)||watch.active)return;const rect=canvas.current!.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;const point=map.current?.points.map(p=>({...p,d:Math.hypot(p.x-x,p.y-y)})).sort((a,b)=>a.d-b.d)[0];clearScene();map.current?.followFlight();if(point&&point.d<20){setFlight(point.track.id);map.current!.selectedFlight=point.track.id}else{setFlight('');map.current!.selectedFlight=undefined}}
 const selected=useMemo(()=>flight?index.aircraft.find(t=>t.id===flight):undefined,[index,flight])
 const [flightRoute,setFlightRoute]=useState<FlightRoute>()
 const followFlight=()=>{
  if(!selected)return
  clearScene()
  if(map.current?.followedFlight===selected.id){map.current.followFlight();updateUi();return}
  setBoardOpen(false);setMode('motion');engine.current.mode='motion';engine.current.speed=60;setSpeed(60);engine.current.followEnd=selected.end;engine.current.playing=true
  map.current?.followFlight(selected.id)
  if(engine.current.time<selected.start||engine.current.time>=selected.end)void seek(selected.start)
  updateUi()
 }
 const [routeState,setRouteState]=useState<'loading'|'ready'|'error'>('loading'),[routeRetry,setRouteRetry]=useState(0)
 useEffect(()=>{
  map.current?.setFlightRoute();setFlightRoute(undefined);setRouteState('loading')
  if(!flight)return
  const controller=new AbortController()
  void loadFlightRoute(flight,controller.signal).then(route=>{if(!controller.signal.aborted){map.current?.setFlightRoute(route);setFlightRoute(route);setRouteState('ready')}}).catch(()=>{if(!controller.signal.aborted)setRouteState('error')})
  return ()=>controller.abort()
 },[flight,routeRetry])
 return <main ref={studySurface} tabIndex={-1} className="study" data-comparing={comparing||undefined} data-watch={watch.active||undefined} data-watch-awake={watch.awake||undefined} onPointerMove={watch.active?watch.reveal:undefined} onPointerDown={watch.active?watch.reveal:undefined}>
  <header><div className="identity"><a className="eyebrow" href="https://emmettl.github.io/motionstudies/">Motion Studies / research</a><h1>LUFT<span>Flights over Europe</span></h1></div><div className="date">{new Date(`${manifest.date}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})}<span>Recorded observations · UTC</span></div></header>
  <div className="workspace">
   <section className="stage" aria-label="Map of observed aircraft over Europe">
    <canvas ref={canvas} aria-label="Aircraft map. Drag to pan; pinch to zoom. Use search to filter countries, airports, airlines and routes." onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={event=>gesture.current.cancel(event)} onLostPointerCapture={event=>gesture.current.cancel(event)} onWheel={e=>{clearScene();map.current?.zoom(e.deltaY>0?1.15:.87)}}/>
    <canvas ref={accentCanvas} className="movement-layer" aria-hidden="true"/>
    <div className="airport-labels" role="group" aria-label="Airports on the map">{airportLabels.map(label=><button key={label.airport.icao} className="airport-map-label" data-country-highlighted={label.highlighted||undefined} data-dimmed={!!selectionLabel&&!connectedAirportIds.has(label.airport.icao)||undefined} aria-label={`Select airport ${label.airport.iata||label.airport.icao} · ${label.airport.name}`} aria-pressed={label.selected} title={`${label.airport.name} · Open airport board`} style={{left:label.box.left,top:label.box.top,width:label.box.right-label.box.left}} onPointerDown={down} onPointerMove={move} onPointerUp={event=>{if(gesture.current.up(event))selectAirportLabel(label.airport)}} onPointerCancel={event=>gesture.current.cancel(event)} onLostPointerCapture={event=>gesture.current.cancel(event)} onClick={event=>{if(event.detail===0)selectAirportLabel(label.airport)}}><span aria-hidden="true">{label.text}</span></button>)}</div>
    <div className="map-caption"><div className="clock-label">Recorded time</div><div className="clock">{stamp(ui.time)}<small> UTC</small></div><div className="count">{mode==='density'?'Hourly density · 5-minute snapshots':`${ui.total.toLocaleString()} aircraft${selectionLabel?` · ${selectionLabel}`:' over Europe'}`}</div>{(selectedAirports.length>0||selectedCountries.length>0)&&mode==='motion'&&<div className="airport-key"><span>● {ui.inbound} inbound</span><span>● {ui.outbound} outbound</span></div>}</div>
    {!engine.current.chunk&&<div className="initial-loading" role="status">{status}</div>}
    <div className="view-controls" onClick={clearScene}><button onClick={()=>{map.current!.transitionTo(map.current!.studyBounds)}}>Europe</button><button onClick={()=>{map.current!.transitionTo(BRITAIN)}}>Britain</button>{selected&&routeState==='ready'&&<button onClick={()=>map.current?.frameFlightRoute()}>Fit route</button>}{selected&&routeState==='error'&&<button onClick={()=>setRouteRetry(value=>value+1)}>Retry route</button>}{!selected&&selectedAirports.length===1&&<button onClick={()=>map.current!.focus(selectedAirports[0])}>Near {selectedAirports[0].iata||selectedAirports[0].icao}</button>}<button aria-label="Zoom in" onClick={()=>map.current?.zoom(.7)}>+</button><button aria-label="Zoom out" onClick={()=>map.current?.zoom(1.4)}>−</button></div>
    {selected&&<div className="flight-caption" data-route-state={routeState}><strong>{selected.callsign}</strong><span className="endpoint-caption">{(['origin','destination'] as const).map((side,i)=>{const label=resolveEndpoint(selected,side),usable=usableEndpoint(label,endpointFilter.includeCandidates);return <React.Fragment key={side}>{i>0&&' → '}<span>{usable?(label.airport?.iata||label.airport?.icao):`Unknown ${side}`}<small>{usable?evidenceName(label.status):label.status==='candidate'?'Candidate excluded':evidenceName(label.status)}</small></span></React.Fragment>})}</span><span>{routeState==='ready'?'Full observed route':routeState==='loading'?'Loading route…':'Route unavailable'}</span><button className="follow-flight" aria-pressed={ui.following===selected.id} onClick={followFlight}>{ui.following===selected.id?'Following · Stop':'Follow aircraft'}</button>{flightRoute&&<FlightProfile route={flightRoute} time={ui.time}/>}<button className="clear-aircraft" aria-label="Clear aircraft" onClick={()=>{map.current?.followFlight();setFlight('');map.current!.selectedFlight=undefined}}>×</button></div>}
    {scene&&<section className="scene-caption" aria-label="Guided moment">
     <div className="scene-heading"><span>{scene.airport?'Around an airport':'A moment in the day'}</span><button aria-label="Close guided moment" onClick={clearScene}>×</button></div>
     <strong>{scene.title}</strong><p>{scene.caption}</p>
     <div className="scene-progress"><span>{momentTime(scene.time)}–{momentTime(scene.endTime!)} UTC</span><span>{ui.time>=scene.endTime!?'Scene complete':ui.playing?'Watching':'Paused'}</span></div>
     <progress aria-label="Scene progress" max={scene.endTime!-scene.time} value={Math.max(0,Math.min(scene.endTime!-scene.time,ui.time-scene.time))}/>
    </section>}
    <div className="map-note">{daylight&&<span className="daylight-key"><i aria-hidden="true"/> Day / night{mode==='density'?' · mid-hour':''}</span>}{mode==='density'?'Five-minute snapshots · relative brightness':selectedAirports.length?'Selected airports · three-minute trails':'Three-minute trails · low-altitude tracks in gold'}</div>
   </section>
   {endpointsOpen&&<EndpointFilters enrichment={enrichment} value={endpointFilter} coverage={coverage} onChange={changeEndpointFilter} onClose={()=>{setEndpointsOpen(false);document.querySelector<HTMLButtonElement>('.endpoint-toggle')?.focus()}}/>}
   <aside aria-label="Flight selection">
    <div className="selection-tools"><FlightSearch onClear={clearFilters} onEndpoints={()=>setEndpointsOpen(!endpointsOpen)} endpointsOpen={endpointsOpen} endpointActive={endpointFilterActive(endpointFilter)} countries={countries} airports={index.airports} routes={routes} selection={selection} onChange={changeSelection} onAirportBoard={choose} onCountryFocus={code=>map.current?.frameCountries([code])}/>
    {selectionLabel&&<p className="selection-summary">{selectedCountries.length>0&&<span className="country-summary">{countryIds.size} airports highlighted · </span>}{summary.aircraft.toLocaleString()} aircraft observed · matching selection{dimOthers&&mode==='motion'?' · other flights dimmed':''}</p>}
    {selectedAirports.length>0&&<div className="board-launchers">{selectedAirports.map(a=><button key={a.icao} onClick={()=>{if(airport?.icao===a.icao&&boardOpen)setBoardOpen(false);else choose(a)}} aria-expanded={boardOpen&&airport?.icao===a.icao}>{a.iata||a.icao} board <span aria-hidden="true">{boardOpen&&airport?.icao===a.icao?'−':'+'}</span></button>)}</div>}
    </div>
    <div className="context-panels">
     {comparing?<ComparisonPanel pair={selection.airlines} series={comparisonSeries} time={ui.time} onPair={pair=>changeComparison(true,pair)} onSeek={chartSeek} onClose={()=>changeComparison(false)}/>:<>
     <Moments scenes={scenes} bins={summary.bins} filtered={!!selectionLabel} onJump={exploreMoment}/>
     <Insights index={insightIndex} countries={countries} selection={selection} onChange={changeSelection}/>
     </>}
    </div>
   </aside>
   {airport&&boardOpen&&<section className="airport-panel" aria-label={`${airport.iata||airport.icao} airport board`}><div className="panel-heading"><span>Observed movements</span><button aria-label="Close airport board" onClick={()=>setBoardOpen(false)}>×</button></div><ActivityChart series={airportSeries} time={ui.time} onSeek={chartSeek} label="Airport activity time UTC"/><p className="chart-note">Distinct aircraft per half-hour · observed arrivals and departures. Drag to explore.</p><AirportHeroCard key={airport.id} airport={{...airport,city:cityLabel(airport),iata:airport.iata||airport.icao}} departures={board.departures} arrivals={board.arrivals} study={{time:ui.time,windowStart:0,windowEnd:86400}} dateLabel={`${manifest.date} · UTC`} density="compact" maxRows={6} labels={{time:'Seen',emptyDepartures:'No observed departures in this selection.',emptyArrivals:'No observed arrivals in this selection.'}} note="Airport associations inferred from observed trace endpoints. Times are observations, not schedules; blank routes remain unknown." selectedFlightId={flight} onSelectFlight={selectFlight}/><p className="association-note">{board.departures.length} outbound / {board.arrivals.length} inbound associations in this selection.{!airport.hasObservedMovements?' No endpoint evidence for this airport; this does not mean no flights.':''}</p></section>}

  </div>
  <footer>
   <div className="transport"><div className="playback-controls"><button className="play" aria-keyshortcuts="Space" title="Play / pause (Space)" disabled={mode==='density'||!engine.current.chunk} onClick={togglePlayback}><svg aria-hidden="true" width="12" height="14" viewBox="0 0 12 14" fill="currentColor">{ui.playing?<path d="M1 1h3v12H1zm7 0h3v12H8z"/>:<path d="M2 1l9 6-9 6z"/>}</svg>{ui.playing?'Pause':'Play'}</button><label className="speed-label">Pace <select aria-label="Playback speed" value={speed} onChange={e=>{const s=+e.target.value;setSpeed(s);engine.current.speed=s}}><option value="60">1 min / s</option><option value="300">5 min / s</option><option value="900">15 min / s</option></select></label></div><div className="view-actions"><SoundControl {...sound}/><button className="watch-toggle" aria-label="Enter watch mode" title="Watch fullscreen" disabled={!engine.current.chunk} onClick={event=>watch.enter(event.currentTarget)}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="M6 2H2v4m8-4h4v4M2 10v4h4m8-4v4h-4"/></svg><span>Watch</span></button><button className="settings-toggle" aria-label="View settings" aria-expanded={settings} onClick={()=>{setShareOpen(false);setSettings(!settings)}}><span className="view-label">View</span><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="M2 4h12M2 12h12"/><circle cx="6" cy="4" r="2" fill="#101f2b"/><circle cx="10" cy="12" r="2" fill="#101f2b"/></svg></button></div><span className={`stream-status ${status==='Ready'?'is-ready':''}`} role="status">{status==='Ready'?(ui.playing?'Playing': 'Paused'):status}</span>{status.includes('Retry')&&<button onClick={()=>void seek(engine.current.targetTime)}>Retry</button>}</div>
   <FlightTimeline bins={timelineBins} windowStart={0} windowEnd={86400} time={ui.time} onSeek={time=>seek(time)} onScrubStart={()=>{engine.current.scrubbing=true;updateUi()}} onScrubEnd={()=>{engine.current.scrubbing=false}} label={selectionLabel||'Aircraft over Europe'} ariaLabel="Time of day UTC" variant={chartStyle} formatValue={formatActivity} description="5-minute snapshots · UTC"/>
   <div className="colophon"><p><a href="https://www.adsb.lol/">ADSB.lol</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a></p><button className="text-button" aria-expanded={diagnostics} onClick={()=>setDiagnostics(!diagnostics)}>Device details</button><details className="method"><summary>About LUFT</summary><div className="method-content"><p>Aircraft data: ADSB.lol &amp; contributors, ODbL 1.0. Airport reference: OurAirports. Land and country boundaries: Natural Earth. Airline marks identify the observed operator. <a href="https://ourairports.com/">OurAirports</a> and <a href="https://www.naturalearthdata.com/">Natural Earth</a>: public domain.</p><p>{manifest.method} Brief gold departure and cyan arrival rings mark airport-linked observations, not confirmed wheels-up or touchdown times. In Watch mode, softly brighter trails suggest possible holding: little progress towards an observed destination, sustained turning and loop closure at a suitable altitude and distance. Training circuits and other loitering can also qualify; this is an experimental visual cue, not a confirmed holding classification. Airline filters use observed operating callsigns, not ownership or ticket codes. Flights using partner operators or unidentified callsigns may be missing. Countries match flights with an observed endpoint at an airport in that country, using OurAirports country codes. Overflights without such an endpoint do not match. All study airports in selected countries receive markers; text labels remain spaced for readability. Airlines, airports, countries, continents and routes combine across groups; multiple choices within a group are alternatives. Insights rank unique aircraft over the recorded day using observed endpoints and the other active filter groups. Rows can overlap, and missing associations are excluded. The activity strip, density and airport boards follow the selection. In Motion view, other flights can be hidden or dimmed in View settings. Hour density counts five-minute observations in 0.5° cells, normalized within each selection/hour; brightness cannot compare volumes across hours or airlines. The destination panel also supports arrival/departure airport and continent filters. Corroborated endpoint metadata is supported by separated observations; candidate-only routes are opt-in and conflicts stay unresolved. These labels never add trajectory points or airport event times. Receiver coverage is incomplete. This is a recorded day, not live air traffic. Day / night shading approximates the geometric sun position using <a href="https://gml.noaa.gov/grad/solcalc/solareqns.PDF">NOAA solar equations</a>; it is ambient context, not weather or observed illumination.</p><a href={`${import.meta.env.BASE_URL}data/manifest.json`}>Recorder release and source hashes ↗</a></div></details></div>
   {shareOpen&&<section className="share-panel" aria-label="Share scene"><div className="panel-heading"><span>Keep this moment</span><button aria-label="Close share scene" onClick={()=>setShareOpen(false)}>×</button></div><p>{manifest.date} · {stamp(ui.time)} UTC</p><label className="share-link">Scene link<input aria-label="Scene link" readOnly value={shareLink} onFocus={event=>event.target.select()}/></label><div className="share-actions"><button onClick={async()=>{try{await navigator.clipboard.writeText(shareLink);setShareNote('Link copied')}catch{setShareNote('Select the link above to copy it.')}}}>Copy link</button><button disabled={exporting||ui.waiting||!engine.current.chunk||!!flight&&routeState==='loading'} onClick={()=>void saveImage()}>{exporting?'Saving…':'Save image'}</button></div><p className="chart-note">The link restores this recorded day, time and view while that day is available. Save an image to keep it permanently.</p><p role="status">{shareNote}</p></section>}
   {settings&&<section className="view-settings" aria-label="View settings"><div className="panel-heading"><span>View settings</span><button aria-label="Close view settings" onClick={()=>setSettings(false)}>×</button></div><div className="view-extras"><button aria-pressed={comparing} onClick={()=>changeComparison(!comparing)}>Compare two airlines</button><button disabled={ui.waiting||!engine.current.chunk} onClick={openShare}>Share scene</button></div><div className="mode-controls">{(['motion','density'] as const).map(m=><button key={m} aria-pressed={mode===m} onClick={()=>{clearScene();map.current?.followFlight();setMode(m as 'motion'|'density');engine.current.mode=m;engine.current.playing=false;updateUi()}}>{m==='motion'?'Motion':'Hour density'}</button>)}</div><button className="chart-style" aria-label={chartStyle==='bars'?'Show activity as a line':'Show activity as bars'} onClick={()=>setChartStyle(chartStyle==='bars'?'line':'bars')}>{chartStyle==='bars'?'▥ Bars':'⌁ Line'}</button><label className="filter-display"><input type="checkbox" checked={dimOthers} onChange={e=>{setDimOthers(e.target.checked);engine.current.dimOthers=e.target.checked}} aria-describedby="filter-display-note"/>Dim other flights</label><p id="filter-display-note">Keep non-matching flights faintly visible in Motion view. Turn off to hide them.</p><label className="filter-display"><input type="checkbox" checked={daylight} onChange={e=>{setDaylight(e.target.checked);map.current?.setDaylightEnabled(e.target.checked)}} aria-describedby="daylight-note"/>Day / night shading</label><p id="daylight-note">Sunlight follows the recorded date and UTC clock. Density uses the middle of each hour.</p><div className="renderer-picker"><label htmlFor="renderer">Aircraft renderer</label><select id="renderer" value={renderer} disabled={rendererLoading} onChange={e=>void chooseRenderer(e.target.value as 'canvas'|'three')}><option value="canvas">Canvas 2D</option><option value="three">Three.js · GPU</option></select>{rendererLoading&&<span role="status">Opening Three.js…</span>}{rendererNote&&<span role="status">{rendererNote}</span>}</div><p>Density counts observed five-minute snapshots. Route filters use inferred endpoints in either direction; unknown routes are excluded.</p></section>}
   {diagnostics&&<div className="diagnostics"><strong>On this device · {renderer==='three'?'Three.js':'Canvas'} · {version}</strong><span>Map draw p95: {ui.ms.toFixed(1)} ms · max {Math.max(0,...(map.current?.durations??[])).toFixed(1)} ms</span><span>CPU stages p95 · setup {percentile(map.current?.stages.map(s=>s.setup)??[]).toFixed(1)} · sampling {percentile(map.current?.stages.map(s=>s.sampling)??[]).toFixed(1)} · {renderer==='three'?'geometry':'Canvas drawing'} {percentile(map.current?.stages.map(s=>s.geometry)??[]).toFixed(1)} · submission {percentile(map.current?.stages.map(s=>s.submission)??[]).toFixed(1)} ms</span><span>Paint interval p95: {percentile(metrics.current.intervals).toFixed(1)} ms · cap 30 Hz</span><span>{metrics.current.bufferSeconds.toFixed(1)} s buffering since reset</span>{renderer==='three'&&<span>{map.current?.gpuStats()?.calls??0} GPU draw calls · aircraft layer</span>}{renderer==='three'&&<span>{((map.current?.gpuStats()?.geometryPreparedBytes??0)/1024).toFixed(0)} KiB geometry rebuilt · {((map.current?.gpuStats()?.stateUploadBytes??0)/1024).toFixed(0)} KiB aircraft state per frame · {map.current?.gpuStats()?.geometryBuilds??0} geometry builds</span>}<span>{ui.cache} / 4 chunks in memory</span><span>{(ui.responseBytes/1024/1024).toFixed(1)} MiB track response data · HTTP cache may contribute</span><span>{((store.disk?.stats.localBytes??0)/1024/1024).toFixed(1)} MiB reused from local storage · {store.disk?.stats.localHits??0} cache hits</span><span>{store.disk?.stats.savedChunks??0} chunks saved on device · {((store.disk?.stats.savedBytes??0)/1024/1024).toFixed(1)} MiB</span>{store.disk?.stats.storage!=='available'&&<span>{store.disk?.stats.storage==='opening'?'Opening local cache…':store.disk?.stats.storage==='full'?'Local storage full; playback continues using fetch.':'Local storage unavailable; playback continues using fetch.'}</span>}<span>{ui.waiting?'Clock held while buffering':'Buffer ready'}</span><p>Stage percentiles are independent and do not add up. CPU submission time excludes asynchronous GPU completion, decoding, layout and network work. Compare the same view, carrier, clock and pace after warming the data. Ten-minute chunks are verified before display; gaps over 45 seconds remain gaps.</p><div className="comparison-actions"><button onClick={resetMeasurements}>Reset measurements</button><button onClick={()=>void copyMeasurements()}>Copy results</button></div>{copyNote&&<span role="status">{copyNote}</span>}</div>}

  </footer>
  {watch.active&&<div className="watch-exit" onFocus={watch.reveal}>
   <div className="watch-actions"><SoundControl {...sound}/><button onClick={watch.exit} aria-label="Exit watch mode">Exit watch mode <span aria-hidden="true">↙</span></button></div>
   <span>Move or tap to show · Esc to exit · Space to pause</span>
  </div>}
  {watch.active&&status.includes('Retry')&&<div className="watch-error" role="status">Playback interrupted <button onClick={()=>{engine.current.playing=true;void seek(engine.current.targetTime)}}>Retry</button></div>}
 </main>
}
createRoot(document.getElementById('root')!).render(<App/> )
