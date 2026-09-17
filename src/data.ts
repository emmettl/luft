import landUrl from './assets/europe-land-50m.json?url'
import countriesUrl from './assets/europe-countries-50m.json?url'
import type {CountryIndex} from './countries'
import snapshotsUrl from './generated/snapshots.json?url'
import type {SnapshotIndex} from './filters'
import dataLock from '../data-release.json'
import enrichmentLock from '../enrichment-release.json'
import {readAirEnrichment} from '@motionstudies/core/air-enrichment'
import {decodeVerified,TrackDiskCache} from './chunk-cache'
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
 const response=await fetch(new URL(descriptor.path,root),{signal,cache:'no-cache'})
 if(!response.ok) throw new Error(`Data request failed (${response.status})`)
 return decodeVerified<T>(descriptor,await response.arrayBuffer())
}
export async function loadRelease() {
 const r=await fetch(new URL('manifest.json',root),{cache:'no-cache'}); if(!r.ok) throw new Error(`Release unavailable (${r.status})`)
 const manifestBytes=await r.arrayBuffer()
 const manifest=await decodeVerified<Manifest>({path:'manifest.json',bytes:manifestBytes.byteLength,sha256:dataLock.manifestSha256},manifestBytes)
 if(manifest.kind!=='air-day-release'||manifest.schemaVersion!==1||manifest.chunks.length!==144) throw new Error('Unsupported air release')
 const [index,land,snapshots,countryIndex]=await Promise.all([verifiedJson<Index>(manifest.index),fetch(landUrl).then(async r=>{if(!r.ok)throw new Error('Land context unavailable');return await r.json() as Land}),fetch(snapshotsUrl).then(async r=>{if(!r.ok)throw new Error('Filter activity unavailable');return await r.json() as SnapshotIndex}),fetch(countriesUrl).then(async r=>{if(!r.ok)throw new Error('Country context unavailable');return await r.json() as CountryIndex})])
 if(snapshots.date!==manifest.date||snapshots.sourceManifestSha256!==dataLock.manifestSha256)throw new Error('Filter activity belongs to another release')
 if(countryIndex.source.sourceManifestSha256!==dataLock.manifestSha256)throw new Error('Country airports belong to another release')
 if(enrichmentLock.date!==manifest.date||enrichmentLock.sourceManifestSha256!==dataLock.manifestSha256)throw new Error('Endpoint enrichment belongs to another release')
 const response=await fetch(new URL(`${import.meta.env.BASE_URL}${enrichmentLock.path}`,location.origin),{cache:'no-cache'})
 if(!response.ok)throw new Error('Endpoint enrichment unavailable')
 const enrichment=readAirEnrichment(await decodeVerified(enrichmentLock,await response.arrayBuffer()),{date:manifest.date,sourceManifestSha256:dataLock.manifestSha256,tracks:index.aircraft})
 return {manifest,index,land,snapshots,countries:countryIndex.countries,enrichment}
}
export class ChunkStore {
 cache=new Map<number,Chunk>()
 pending=new Map<number,{controller:AbortController;promise:Promise<Chunk>}>()
 wanted=new Set<number>()
 readonly disk?:TrackDiskCache
 readonly loader:(descriptor:ChunkDescriptor,signal?:AbortSignal)=>Promise<Chunk>
 constructor(readonly descriptors:ChunkDescriptor[],loader?:((descriptor:ChunkDescriptor,signal?:AbortSignal)=>Promise<Chunk>)){
  if(loader)this.loader=loader
  else{const disk=this.disk=new TrackDiskCache(descriptors,root);this.loader=(d,signal)=>disk.load<Chunk>(d,signal)}
 }
 retain(index:number) {
  this.wanted=new Set(Array.from({length:Math.min(4,this.descriptors.length)},(_,offset)=>(index+offset)%this.descriptors.length))
  for(const k of this.cache.keys()) if(!this.wanted.has(k)) this.cache.delete(k)
  for(const [k,v] of this.pending) if(!this.wanted.has(k)) {v.controller.abort();this.pending.delete(k)}
 }
 load(index:number):Promise<Chunk> {
  const cached=this.cache.get(index); if(cached) return Promise.resolve(cached)
  const pending=this.pending.get(index);if(pending) return pending.promise
  const controller=new AbortController()
  const promise=this.loader(this.descriptors[index],controller.signal).then(chunk=>{
   if(controller.signal.aborted) throw new DOMException('Cancelled','AbortError')
   if(this.wanted.has(index)) this.cache.set(index,chunk)
   return chunk
  }).finally(()=>{if(this.pending.get(index)?.controller===controller)this.pending.delete(index)})
  this.pending.set(index,{controller,promise});return promise
 }
 prefetch(index:number) {this.retain(index);for(const k of this.wanted) if(k!==index) void this.load(k).catch(()=>{})}
 dispose(){this.wanted.clear();this.cache.clear();for(const p of this.pending.values())p.controller.abort();this.pending.clear()}
}
