import {readFile, writeFile, mkdir} from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import {createAirlineAccumulator, accumulateAirlines, finishAirlines} from '../src/airline-aggregate.ts'
import {appendRouteSamples,routeBucket} from '../src/flight-route.ts'
import {openAirRelease} from './daily/lib.mjs'
const root=new URL('../public/data/',import.meta.url)
const lock=JSON.parse(await readFile(new URL('../data-release.json',import.meta.url)))
// Airline summaries require the pinned recorder manifest; chunks are read through the shared verifier.
const release=await openAirRelease(root,lock.manifestSha256), manifest=release.manifest
const accumulator=createAirlineAccumulator(), snapshots=new Map(),routes=new Map()
for(const descriptor of manifest.chunks){
 const bytes=await release.read(descriptor,'Invalid chunk path')
 const chunk=JSON.parse(gunzipSync(bytes,{maxOutputLength:24*1024**2}))
 if(chunk.windowStart!==descriptor.start||chunk.windowEnd!==descriptor.end)throw new Error('Chunk window mismatch')
 accumulateAirlines(accumulator,chunk.tracks,descriptor.start,descriptor.end)
 for(const track of chunk.tracks)appendRouteSamples(routes,track.id,track.samples,descriptor.start,descriptor.end)
 for(const track of chunk.tracks)for(const p of track.samples){
  if(p[0]<descriptor.start||p[0]>=descriptor.end||p[0]%300!==0)continue
  let points=snapshots.get(track.id);if(!points){points=[];snapshots.set(track.id,points)}
  points.push(p[0]/300,Math.floor(p[1]*2),Math.floor(p[2]*2))
 }
}
const airlines=finishAirlines(accumulator), provenance={date:manifest.date,sourceManifestSha256:lock.manifestSha256}
const directory=new URL('../src/generated/',import.meta.url);await mkdir(new URL('airlines/',directory),{recursive:true})
await mkdir(new URL('flight-routes/',directory),{recursive:true})
const buckets=new Map()
for(const [id,segments] of routes){const key=routeBucket(id);if(!buckets.has(key))buckets.set(key,{});buckets.get(key)[id]=segments}
for(const [key,tracks] of buckets)await writeFile(new URL(`flight-routes/${key}.json`,directory),JSON.stringify({...provenance,routes:tracks})+'\n')
await writeFile(new URL('snapshots.json',directory),JSON.stringify({...provenance,tracks:[...snapshots]})+'\n')
await writeFile(new URL('airlines.json',directory),JSON.stringify({...provenance,airlines:Object.fromEntries(Object.entries(airlines).map(([id,s])=>[id,{aircraft:s.aircraft}]))})+'\n')
for(const [id,summary] of Object.entries(airlines))await writeFile(new URL(`airlines/${id}.json`,directory),JSON.stringify({...provenance,summary})+'\n')
await writeFile(new URL('../public/feed.json',import.meta.url),JSON.stringify({...provenance,releaseUrl:lock.url})+'\n')
console.log(JSON.stringify(Object.fromEntries(Object.entries(airlines).map(([id,s])=>[id,{aircraft:s.aircraft,samples:s.samples,peakSnapshot:Math.max(...s.bins.map(b=>b.count))}]))))
