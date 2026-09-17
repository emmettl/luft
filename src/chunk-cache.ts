import type {Descriptor} from './data'
export const TRACK_CACHE_NAME='luft-track-data-v1'
export const TRACK_CACHE_LIMIT=512*1024*1024
function browserStorage(){try{return globalThis.caches}catch{return undefined}}
export async function decodeVerified<T>(descriptor:Descriptor,bytes:ArrayBuffer):Promise<T>{
 if(bytes.byteLength!==descriptor.bytes)throw new Error('Incomplete data download')
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('')
 if(hash!==descriptor.sha256)throw new Error('Data integrity check failed')
 if(descriptor.path.endsWith('.gz.bin')){
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return JSON.parse(await new Response(stream).text())
 }
 return JSON.parse(new TextDecoder().decode(bytes))
}
export type TrackCacheStats={responseBytes:number;requests:number;localBytes:number;localHits:number;savedBytes:number;savedChunks:number;storage:'opening'|'available'|'unavailable'|'full'}
/** Compressed, hash-verified chunks on disk; decoded tracks remain bounded by ChunkStore.
 * Own cache only, scoped to the current descriptor set, with a 512 MiB byte ceiling.
 */
export class TrackDiskCache {
 readonly stats:TrackCacheStats={responseBytes:0,requests:0,localBytes:0,localHits:0,savedBytes:0,savedChunks:0,storage:'opening'}
 private readonly entries=new Map<string,number>()
 private readonly allowed=new Map<string,Descriptor>()
 private readonly ready:Promise<Cache|undefined>
 private writes:Promise<void>=Promise.resolve()
 constructor(descriptors:Descriptor[],private readonly root:URL,private readonly fetcher:typeof fetch=globalThis.fetch.bind(globalThis),storage:CacheStorage|undefined=browserStorage(),private readonly limit=TRACK_CACHE_LIMIT){
  for(const d of descriptors)this.allowed.set(this.key(d),d)
  this.ready=this.open(storage)
 }
 private key(d:Descriptor){const key=new URL(d.path,this.root);key.searchParams.set('luft-sha256',d.sha256);return key.href}
 private recount(){this.stats.savedChunks=this.entries.size;this.stats.savedBytes=[...this.entries.values()].reduce((a,b)=>a+b,0)}
 private async open(storage?:CacheStorage){
  if(!storage){this.stats.storage='unavailable';return}
  try{
   const cache=await storage.open(TRACK_CACHE_NAME)
   for(const request of await cache.keys()){
    const d=this.allowed.get(request.url)
    if(!d)await cache.delete(request)
    else this.entries.set(request.url,d.bytes)
   }
   this.recount()
   while(this.stats.savedBytes>this.limit){const key=this.entries.keys().next().value!;await cache.delete(key);this.entries.delete(key);this.recount()}
   this.stats.storage='available';return cache
  }catch{this.stats.storage='unavailable';return}
 }
 private async remove(cache:Cache,key:string){await cache.delete(key);this.entries.delete(key);this.recount()}
 private async save(cache:Cache,key:string,bytes:ArrayBuffer){
  const write=this.writes.then(async()=>{
   if(bytes.byteLength>this.limit)return
   try{
    // CacheStorage eviction/quota is outside our control. Keep playback usable.
    while(this.stats.savedBytes-(this.entries.get(key)??0)+bytes.byteLength>this.limit){const oldest=this.entries.keys().next().value!;await this.remove(cache,oldest)}
    await cache.put(key,new Response(bytes,{headers:{'Content-Type':'application/octet-stream'}}))
    this.entries.delete(key);this.entries.set(key,bytes.byteLength);this.recount();this.stats.storage='available'
   }catch(error){this.stats.storage=(error as Error).name==='QuotaExceededError'?'full':'unavailable'}
  })
  this.writes=write.catch(()=>{});await write
 }
 async load<T>(descriptor:Descriptor,signal?:AbortSignal):Promise<T>{
  const key=this.key(descriptor),cache=this.allowed.has(key)?await this.ready:undefined
  signal?.throwIfAborted()
  if(cache){
   try{
    const response=await cache.match(key)
    if(response){
     const bytes=await response.arrayBuffer(),value=await decodeVerified<T>(descriptor,bytes);signal?.throwIfAborted()
     this.stats.localHits++;this.stats.localBytes+=bytes.byteLength
     this.entries.delete(key);this.entries.set(key,bytes.byteLength);this.recount();return value
    }
    this.entries.delete(key);this.recount()
   }catch{
    signal?.throwIfAborted()
    // A damaged entry must not mask a healthy network copy or poison retry.
    try{await this.remove(cache,key)}catch{this.stats.storage='unavailable'}
   }
  }
  signal?.throwIfAborted();this.stats.requests++
  // Delivery filenames recur each day. Revalidate the browser HTTP cache;
  // our separate, SHA-keyed disk cache still serves verified bytes directly.
  const response=await this.fetcher(new URL(descriptor.path,this.root),{signal,cache:'no-cache'})
  if(!response.ok)throw new Error(`Data request failed (${response.status})`)
  const bytes=await response.arrayBuffer();this.stats.responseBytes+=bytes.byteLength
  const value=await decodeVerified<T>(descriptor,bytes);signal?.throwIfAborted()
  if(cache)await this.save(cache,key,bytes)
  signal?.throwIfAborted();return value
 }
}
