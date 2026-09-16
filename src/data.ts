import airlineDataUrl from './generated/airlines.json?url'
import type {AirlineSummaries} from './airlines'
import dataLock from '../data-release.json'
import type { AirTrack } from '@motionstudies/core/domain/air'
import type { AirSearchTrack } from '@motionstudies/core/air-search'
import type { StudyAirport } from '@motionstudies/core/domain/airport'
export type Descriptor = {path:string;sha256:string;bytes:number;decodedBytes?:number}
export type ChunkDescriptor = Descriptor & {start:number;end:number}
export type Manifest = {kind:string;schemaVersion:number;date:string;bounds:number[];chunks:ChunkDescriptor[];index:Descriptor;land:Descriptor;method:string;audit:{aircraft:number;tracks:number;origins:number;destinations:number}}
export type Airport = StudyAirport & {hasObservedMovements:boolean}
export type Index = {aircraft:AirSearchTrack[];airports:Airport[];bins:{time:number;count:number}[];cells:number[][][]}
export type Chunk = {windowStart:number;windowEnd:number;tracks:AirTrack[]}
export type Land = {features:{geometry:{type:string;coordinates:number[][][]|number[][][][]}}[]}
const root = new URL(`${import.meta.env.BASE_URL}data/`,location.origin)
export async function verifiedJson<T>(descriptor:Descriptor,signal?:AbortSignal):Promise<T> {
 const response=await fetch(new URL(descriptor.path,root),{signal})
 if(!response.ok) throw new Error(`Data request failed (${response.status})`)
 const bytes=await response.arrayBuffer()
 if(bytes.byteLength!==descriptor.bytes) throw new Error('Incomplete data download')
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('')
 if(hash!==descriptor.sha256) throw new Error('Data integrity check failed')
 if(descriptor.path.endsWith('.gz.bin')) {
  const blob=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return JSON.parse(await new Response(blob).text())
 }
 return JSON.parse(new TextDecoder().decode(bytes))
}
export async function loadRelease() {
 const r=await fetch(new URL('manifest.json',root)); if(!r.ok) throw new Error(`Release unavailable (${r.status})`)
 const manifest:Manifest=await r.json()
 if(manifest.kind!=='air-day-release'||manifest.schemaVersion!==1||manifest.chunks.length!==144) throw new Error('Unsupported air release')
 const [index,land,airlineSummaries]=await Promise.all([verifiedJson<Index>(manifest.index),verifiedJson<Land>(manifest.land),fetch(airlineDataUrl).then(async r=>{if(!r.ok)throw new Error('Airline data unavailable');return await r.json() as AirlineSummaries})])
 if(airlineSummaries.date!==manifest.date||airlineSummaries.sourceManifestSha256!==dataLock.manifestSha256)throw new Error('Airline data belongs to another release')
 return {manifest,index,land,airlineSummaries}
}
export class ChunkStore {
 cache=new Map<number,Chunk>()
 pending=new Map<number,{controller:AbortController;promise:Promise<Chunk>}>()
 wanted=new Set<number>()
 downloadedBytes=0
 constructor(readonly descriptors:ChunkDescriptor[], readonly loader=verifiedJson<Chunk>) {}
 retain(index:number) {
  this.wanted=new Set([index,index+1,index+2,index+3].filter(i=>i<this.descriptors.length))
  for(const k of this.cache.keys()) if(!this.wanted.has(k)) this.cache.delete(k)
  for(const [k,v] of this.pending) if(!this.wanted.has(k)) {v.controller.abort();this.pending.delete(k)}
 }
 load(index:number):Promise<Chunk> {
  const cached=this.cache.get(index); if(cached) return Promise.resolve(cached)
  const pending=this.pending.get(index);if(pending) return pending.promise
  const controller=new AbortController()
  const promise=this.loader(this.descriptors[index],controller.signal).then(chunk=>{
   if(controller.signal.aborted) throw new DOMException('Cancelled','AbortError')
   this.downloadedBytes+=this.descriptors[index].bytes
   if(this.wanted.has(index)) this.cache.set(index,chunk)
   return chunk
  }).finally(()=>{if(this.pending.get(index)?.controller===controller)this.pending.delete(index)})
  this.pending.set(index,{controller,promise});return promise
 }
 prefetch(index:number) {this.retain(index);for(const k of this.wanted) if(k!==index) void this.load(k).catch(()=>{})}
 dispose(){this.wanted.clear();this.cache.clear();for(const p of this.pending.values())p.controller.abort();this.pending.clear()}
}
