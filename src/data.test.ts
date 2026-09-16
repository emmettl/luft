import {describe,it,expect,vi} from 'vitest'
import {ChunkStore,type Chunk} from './data'
const descriptors=Array.from({length:8},(_,i)=>({path:`${i}`,start:i*600,end:(i+1)*600,bytes:10,sha256:'test'}))
const chunk:Chunk={windowStart:0,windowEnd:600,tracks:[]}
describe('bounded stream cache',()=>{
 it('reuses pending prefetch on rollover and evicts old chunks',async()=>{
  const loader=vi.fn(async()=>chunk),store=new ChunkStore(descriptors,loader);store.retain(0);await store.load(0);store.prefetch(0);await store.load(1)
  expect(loader.mock.calls.length).toBe(4);store.prefetch(1);await store.load(4);expect(store.cache.has(0)).toBe(false);expect(store.cache.size).toBeLessThanOrEqual(4)
 })
 it('discards an outdated seek response even when fetch ignores cancellation',async()=>{
  let finish!:(c:Chunk)=>void;const store=new ChunkStore(descriptors,()=>new Promise(r=>{finish=r}));store.retain(0);const pending=store.load(0);store.retain(4);finish(chunk);await expect(pending).rejects.toThrow('Cancelled');expect(store.cache.size).toBe(0)
 })
 it('prefetches the start of the day before looping without growing the cache',async()=>{
  const loader=vi.fn(async()=>chunk),store=new ChunkStore(descriptors,loader);store.retain(7);await store.load(7);store.prefetch(7);await Promise.all([store.load(0),store.load(1),store.load(2)])
  expect([...store.wanted]).toEqual([7,0,1,2]);expect(loader).toHaveBeenCalledTimes(4)
  store.prefetch(0);await store.load(0);await store.load(3)
  expect(store.cache.has(7)).toBe(false);expect(store.cache.size).toBe(4);expect(loader).toHaveBeenCalledTimes(5)
 })
 it('permits retry after a failed request',async()=>{
  const loader=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(chunk);const store=new ChunkStore(descriptors,loader);store.retain(0);await expect(store.load(0)).rejects.toThrow('offline');await expect(store.load(0)).resolves.toBe(chunk)
 })
})
