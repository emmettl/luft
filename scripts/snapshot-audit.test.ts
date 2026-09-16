import {expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {matchesSelection,selectionActivity,EMPTY_SELECTION,type SnapshotIndex} from '../src/filters'
import type {Index} from '../src/data'
it('matches published per-airline snapshot counts for the recorded day',()=>{
 const manifest=JSON.parse(readFileSync('public/data/manifest.json','utf8'))
 const index:Index=JSON.parse(gunzipSync(readFileSync(`public/data/${manifest.index.path}`)).toString())
 const snapshots:SnapshotIndex=JSON.parse(readFileSync('src/generated/snapshots.json','utf8'))
 for(const id of ['swiss','easyjet','british-airways'] as const){
  const selected=index.aircraft.filter(track=>matchesSelection(track,{...EMPTY_SELECTION,airlines:[id]}))
  const summary=selectionActivity(selected,snapshots)
  const published=JSON.parse(readFileSync(`src/generated/airlines/${id}.json`,'utf8')).summary
  expect(summary.aircraft).toBe(published.aircraft)
  expect(summary.bins).toEqual(published.bins)
 }
})
