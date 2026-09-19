import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import {holdingEvidence} from '../src/holding.ts'
import {openAirRelease} from './daily/lib.mjs'
const root=new URL('../public/data/',import.meta.url)
const lock=JSON.parse(await readFile(new URL('../data-release.json',import.meta.url)))
// Holding analysis requires the pinned manifest; every input is read through the shared verifier.
const release=await openAirRelease(root,lock.manifestSha256),manifest=release.manifest
async function verified(descriptor){
 return JSON.parse(gunzipSync(await release.read(descriptor),{maxOutputLength:64*1024**2}))
}
const index=await verified(manifest.index),airports=new Map(index.airports.map(a=>[a.icao,a])),metadata=new Map(index.aircraft.map(t=>[t.id,t]))
const states=new Map(),tracks={},candidates=new Map(),controls=new Map(),naiveIds=new Set(),evaluatedIds=new Set()
const geometryIds=new Set(),sensitivity=Object.fromEntries([.1,.2,.3].flatMap(progress=>[300,360,540].map(turn=>[`${progress}/${turn}`,new Set()])))
let windows=0,naiveWindows=0,acceptedWindows=0
for(const descriptor of manifest.chunks){
 const chunk=await verified(descriptor)
 if(chunk.windowStart!==descriptor.start||chunk.windowEnd!==descriptor.end)throw Error('Chunk window mismatch')
 for(const track of chunk.tracks){
  const meta=metadata.get(track.id),destination=airports.get(meta?.destination?.icao)
  let state=states.get(track.id)
  if(!state){state={samples:[],lastEvaluation:-Infinity,points:[]};states.set(track.id,state)}
  for(const p of track.samples){
   // Recorder overlap belongs to its owning window, exactly once.
   if(p[0]<descriptor.start||p[0]>=descriptor.end)continue
   const previous=state.samples.at(-1)
   if(previous&&p[0]<=previous[0])continue
   if(previous&&p[0]-previous[0]>45)state.samples=[]
   state.samples.push(p)
   while(state.samples.length&&state.samples[0][0]<p[0]-480)state.samples.shift()
   if(p[0]-state.lastEvaluation<30)continue
   state.lastEvaluation=p[0]
   let best,used
   for(const seconds of [240,360,480]){
    const samples=state.samples.filter(s=>s[0]>=p[0]-seconds),e=holdingEvidence(samples,destination)
    if(!e)continue
    windows++;evaluatedIds.add(track.id)
    if(e.geometric&&e.context)geometryIds.add(track.id)
    if(e.context&&e.closure<.22&&e.consistency>=.8)for(const [key,ids] of Object.entries(sensitivity)){const [progress,turn]=key.split('/').map(Number);if(Math.abs(e.progress)<progress&&e.turnDegrees>=turn)ids.add(track.id)}
    if(e.stalled&&e.context){naiveWindows++;naiveIds.add(track.id)}
    if(!best||e.confidence>best.confidence){best=e;used=samples}
    if(e.stalled&&e.context&&!e.geometric&&!controls.has(track.id))controls.set(track.id,{id:track.id,callsign:track.callsign,destination:meta.destination.icao,time:p[0],...e,samples})
   }
   const score=Math.round((best?.confidence??0)*100)/100,prior=state.points.at(-1)
   if(score||prior?.[1]){
    if(score&&(!prior||p[0]-prior[0]>60))state.points.push([p[0]-30,0])
    state.points.push([p[0],score])
   }
   if(score){
    acceptedWindows++
    if(score>(candidates.get(track.id)?.confidence??0))candidates.set(track.id,{id:track.id,callsign:track.callsign,destination:meta.destination.icao,time:p[0],...best,samples:used})
   }
  }
 }
 // Only retain rolling history for flights still seen near this chunk boundary.
 for(const [id,state] of states){
  if((state.samples.at(-1)?.[0]??0)<descriptor.end-45){
   if(state.points.length){const last=state.points.at(-1);if(last[1])state.points.push([last[0]+30,0]);(tracks[id]??=[]).push(...state.points)}
   states.delete(id)
  }
 }
}
for(const [id,state] of states)if(state.points.length){const last=state.points.at(-1);if(last[1])state.points.push([last[0]+30,0]);(tracks[id]??=[]).push(...state.points)}
const provenance={date:manifest.date,sourceManifestSha256:lock.manifestSha256}
await mkdir(new URL('../src/generated/',import.meta.url),{recursive:true})
await writeFile(new URL('../src/generated/holding.json',import.meta.url),JSON.stringify({...provenance,tracks})+'\n')
const accepted=[...candidates.values()].sort((a,b)=>b.confidence-a.confidence),rejected=[...controls.values()].filter(c=>!candidates.has(c.id)).slice(0,24)
const summary={...provenance,totalTracks:index.aircraft.length,tracksWithDestination:index.aircraft.filter(t=>airports.has(t.destination?.icao)).length,evaluatedTracks:evaluatedIds.size,evaluatedWindows:windows,lowProgressTracks:naiveIds.size,lowProgressWindows:naiveWindows,geometryAndContextTracks:geometryIds.size,sensitivity:Object.fromEntries(Object.entries(sensitivity).map(([key,ids])=>[key,ids.size])),candidateTracks:accepted.length,candidateEvaluations:acceptedWindows,highlightPoints:Object.values(tracks).reduce((n,p)=>n+p.length,0)}
console.log(JSON.stringify(summary,null,2))
if(process.argv.includes('--report')){
 const folder=new URL('../docs/evidence/holding/',import.meta.url);await mkdir(folder,{recursive:true})
 await writeFile(new URL('audit.json',folder),JSON.stringify({summary,candidates:accepted,controls:rejected})+'\n')
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
 function card(c){
  const lat=c.samples[0][2]*Math.PI/180,points=c.samples.map(p=>[p[1]*Math.cos(lat)*111,p[2]*111]),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),scale=220/Math.max(maxX-minX,maxY-minY,1)
  const xy=p=>[30+(p[0]-(minX+maxX)/2)*scale+110,140-(p[1]-(minY+maxY)/2)*scale]
  const path=points.map((p,i)=>`${i?'L':'M'}${xy(p).join(',')}`).join(' '),first=xy(points[0]),last=xy(points.at(-1)),clock=new Date(c.time*1000).toISOString().slice(11,19)
  return `<article><h3>${escape(c.callsign)} → ${escape(c.destination)}</h3><p>${clock} UTC · ${Math.round(c.duration/60)} min · score ${c.confidence.toFixed(2)}</p><svg viewBox="0 0 280 280" role="img" aria-label="Track shape, north up; blue start and gold end"><path d="${path}" fill="none" stroke="#90ccda" stroke-width="2"/><circle cx="${first[0]}" cy="${first[1]}" r="4" fill="#51aaff"/><circle cx="${last[0]}" cy="${last[1]}" r="4" fill="#ffd18a"/></svg><p>Progress ${c.progress?.toFixed(2)} · closure ${c.closure.toFixed(2)}<br>Turn ${Math.round(c.turnDegrees)}° · consistency ${c.consistency.toFixed(2)}<br>${Math.round(c.minAltitude)}–${Math.round(c.maxAltitude)} ft · ${Math.round(c.distance)} km to destination</p><small>${escape(c.id)} · plot width ${Math.round(280/scale)} km</small></article>`
 }
 await writeFile(new URL('index.html',folder),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>LUFT · possible holding audit</title><style>body{background:#09131d;color:#dfecf1;font:15px system-ui;margin:32px auto;padding:0 24px;max-width:1400px}h1,h2{font-weight:500}p{line-height:1.6;color:#b5c9d3}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:16px}article{background:#11222e;border:1px solid #233c4e;border-radius:12px;padding:16px}h3{margin:0}svg{width:100%;max-height:280px}small{color:#8aa2b0}</style><h1>Possible holding · ${manifest.date}</h1><p>Experimental, unlabelled data: geometric candidates are not confirmed operational holds. Blue dots start each window; gold dots end it. Each plot has its own scale, north up.</p><p>${summary.totalTracks.toLocaleString()} tracks · ${summary.tracksWithDestination.toLocaleString()} with a mapped observed destination · ${summary.lowProgressTracks.toLocaleString()} tracks pass low-progress/context alone · ${summary.candidateTracks} pass the combined heuristic.</p><p><a href="#controls" style="color:#90ccda">Jump to rejected examples</a></p><h2>Strongest window from every candidate</h2><div class="grid">${accepted.map(card).join('')}</div><h2 id="controls">Low progress alone: rejected examples</h2><p>These pass altitude, proximity and low-progress checks but fail loop geometry. Deterministic first examples, not a random or labelled validation set.</p><div class="grid">${rejected.map(card).join('')}</div></html>`)
}
