import {readFile, writeFile, mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {createAirlineAccumulator, accumulateAirlines, finishAirlines} from '../src/airline-aggregate.ts'
const root=new URL('../public/data/',import.meta.url), digest=bytes=>createHash('sha256').update(bytes).digest('hex')
const lock=JSON.parse(await readFile(new URL('../data-release.json',import.meta.url)))
const raw=await readFile(new URL('manifest.json',root)), manifest=JSON.parse(raw)
if(digest(raw)!==lock.manifestSha256) throw new Error('Airline summaries require the pinned recorder manifest')
const accumulator=createAirlineAccumulator()
for(const descriptor of manifest.chunks){
 if(!/^[a-zA-Z0-9._-]+$/.test(descriptor.path))throw new Error('Invalid chunk path')
 const bytes=await readFile(new URL(descriptor.path,root))
 if(bytes.length!==descriptor.bytes||digest(bytes)!==descriptor.sha256)throw new Error(`Chunk integrity mismatch: ${descriptor.path}`)
 const chunk=JSON.parse(gunzipSync(bytes,{maxOutputLength:24*1024**2}))
 if(chunk.windowStart!==descriptor.start||chunk.windowEnd!==descriptor.end)throw new Error('Chunk window mismatch')
 accumulateAirlines(accumulator,chunk.tracks,descriptor.start,descriptor.end)
}
const airlines=finishAirlines(accumulator), result={date:manifest.date,sourceManifestSha256:lock.manifestSha256,airlines}
const directory=new URL('../src/generated/',import.meta.url);await mkdir(directory,{recursive:true});await writeFile(new URL('airlines.json',directory),JSON.stringify(result)+'\n')
console.log(JSON.stringify(Object.fromEntries(Object.entries(airlines).map(([id,s])=>[id,{aircraft:s.aircraft,samples:s.samples,peakSnapshot:Math.max(...s.bins.map(b=>b.count))}]))))
