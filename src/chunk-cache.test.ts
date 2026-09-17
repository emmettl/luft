import {describe,it,expect,vi} from 'vitest'
import {TrackDiskCache,TRACK_CACHE_NAME} from './chunk-cache'
const root=new URL('https://example.test/luft/data/')
async function fixture(value=1){
 const bytes=new TextEncoder().encode(JSON.stringify({value})).buffer
 const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('')
 return {bytes,descriptor:{path:`${value}.json`,bytes:bytes.byteLength,sha256}}
}
function storage(){
 const entries=new Map<string,Response>()
 const key=(input:RequestInfo|URL)=>typeof input==='string'?input:input instanceof URL?input.href:input.url
 const cache={keys:vi.fn(async()=>[...entries.keys()].map(k=>new Request(k))),match:vi.fn(async(k:RequestInfo|URL)=>entries.get(key(k))?.clone()),put:vi.fn(async(k:RequestInfo|URL,r:Response)=>{entries.set(key(k),r.clone())}),delete:vi.fn(async(k:RequestInfo|URL)=>entries.delete(key(k)))}
 return {entries,cache,api:{open:vi.fn(async()=>cache)} as unknown as CacheStorage}
}
describe('verified compressed disk cache',()=>{
 it('revalidates reused filenames across days while preserving verified local reuse',async()=>{
  const old=await fixture(1),next=await fixture(2),disk=storage()
  next.descriptor.path=old.descriptor.path
  const first=new TrackDiskCache([old.descriptor],root,async()=>new Response(old.bytes),disk.api)
  await first.load(old.descriptor)
  const fetcher=vi.fn(async(_url:RequestInfo|URL,options?:RequestInit)=>new Response(options?.cache==='no-cache'?next.bytes:old.bytes))
  const refreshed=new TrackDiskCache([next.descriptor],root,fetcher,disk.api)
  await expect(refreshed.load(next.descriptor)).resolves.toEqual({value:2})
  await expect(refreshed.load(next.descriptor)).resolves.toEqual({value:2})
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(refreshed.stats.localHits).toBe(1)
 })
 it('reuses downloaded bytes across seeks and new sessions without fetch',async()=>{
  const {descriptor,bytes}=await fixture(),disk=storage(),fetcher=vi.fn(async()=>new Response(bytes)),first=new TrackDiskCache([descriptor],root,fetcher,disk.api)
  expect(await first.load(descriptor)).toEqual({value:1});expect(await first.load(descriptor)).toEqual({value:1})
  const next=new TrackDiskCache([descriptor],root,fetcher,disk.api);await next.load(descriptor)
  expect(fetcher).toHaveBeenCalledTimes(1);expect(first.stats.responseBytes).toBe(bytes.byteLength);expect(first.stats.localHits).toBe(1);expect(next.stats.responseBytes).toBe(0);expect(next.stats.savedChunks).toBe(1)
 })
 it('recovers a corrupted saved entry and never saves an invalid response',async()=>{
  const {descriptor,bytes}=await fixture(),disk=storage(),fetcher=vi.fn(async()=>new Response(bytes)),cache=new TrackDiskCache([descriptor],root,fetcher,disk.api)
  await cache.load(descriptor);disk.entries.set([...disk.entries.keys()][0],new Response(new Uint8Array(bytes.byteLength)))
  await expect(cache.load(descriptor)).resolves.toEqual({value:1});expect(fetcher).toHaveBeenCalledTimes(2);expect(cache.stats.localHits).toBe(0)
  const bad=await fixture(2),invalid=new TrackDiskCache([bad.descriptor],root,vi.fn(async()=>new Response('bad')),disk.api)
  await expect(invalid.load(bad.descriptor)).rejects.toThrow('Incomplete');expect(disk.entries.size).toBe(0)
 })
 it('prunes only its own entries for an obsolete release and observes the byte budget',async()=>{
  const a=await fixture(1),b=await fixture(2),disk=storage(),fetcher=vi.fn(async(url:RequestInfo|URL)=>new Response(String(url).includes('1.json')?a.bytes:b.bytes))
  const cache=new TrackDiskCache([a.descriptor,b.descriptor],root,fetcher,disk.api,a.bytes.byteLength)
  await cache.load(a.descriptor);await cache.load(b.descriptor);expect(cache.stats.savedChunks).toBe(1);expect(cache.stats.savedBytes).toBeLessThanOrEqual(a.bytes.byteLength)
  const next=new TrackDiskCache([a.descriptor],root,fetcher,disk.api);await next.load(a.descriptor)
  expect(next.stats.savedChunks).toBe(1);expect(disk.api.open).toHaveBeenCalledWith(TRACK_CACHE_NAME)
  expect([...disk.entries.keys()][0]).toContain('1.json')
 })
 it('continues when storage is blocked or quota is exhausted',async()=>{
  const {descriptor,bytes}=await fixture(),fetcher=vi.fn(async()=>new Response(bytes))
  const blocked=new TrackDiskCache([descriptor],root,fetcher,{open:async()=>{throw Error('blocked')}} as unknown as CacheStorage)
  await expect(blocked.load(descriptor)).resolves.toEqual({value:1});expect(blocked.stats.storage).toBe('unavailable')
  const disk=storage();disk.cache.put.mockRejectedValue(new DOMException('full','QuotaExceededError'))
  const full=new TrackDiskCache([descriptor],root,fetcher,disk.api);await expect(full.load(descriptor)).resolves.toEqual({value:1});expect(full.stats.storage).toBe('full');expect(full.stats.savedChunks).toBe(0)
 })
 it('honours cancellation before returning cached bytes without starting a fetch',async()=>{
  const {descriptor,bytes}=await fixture(),disk=storage(),fetcher=vi.fn(async()=>new Response(bytes)),cache=new TrackDiskCache([descriptor],root,fetcher,disk.api)
  await cache.load(descriptor);const abort=new AbortController();abort.abort()
  await expect(cache.load(descriptor,abort.signal)).rejects.toThrow();expect(fetcher).toHaveBeenCalledTimes(1)
 })
})
