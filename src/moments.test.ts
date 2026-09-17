import {expect,it} from 'vitest'
import {buildMoments,momentTime} from './moments'
import {EMPTY_SELECTION,matchesSelection,selectionActivity,type SnapshotIndex} from './filters'
import type {Index} from './data'

it('finds exact extrema and largest one-hour changes, in chronological order',()=>{
 const moments=buildMoments([8,2,5,20,12,3].map((count,i)=>({time:i*3600,count})))
 expect(moments.map(m=>[m.id,m.time])).toEqual([['quiet',3600],['rise',7200],['peak',10800],['fall',14400]])
 expect(moments.find(m=>m.id==='rise')?.caption).toContain('From 5 to 20 aircraft by 03:00 UTC')
 expect(moments.find(m=>m.id==='fall')?.caption).toContain('From 12 to 3 aircraft by 05:00 UTC')
})
it('chooses earliest ties and never compares the end of this day to its start',()=>{
 const moments=buildMoments([{time:0,count:5},{time:3600,count:10},{time:7200,count:5},{time:10800,count:10},{time:82800,count:1},{time:86100,count:50}])
 expect(moments.find(m=>m.id==='rise')?.time).toBe(0)
 expect(moments.find(m=>m.id==='fall')?.time).toBe(3600)
 expect(moments.find(m=>m.id==='peak')?.time).toBe(86100)
 expect(momentTime(86100)).toBe('23:55')
})
it('does not invent changes or activity for empty, flat, or sparse observations',()=>{
 expect(buildMoments([])).toEqual([])
 expect(buildMoments([{time:0,count:0},{time:3600,count:0}])).toEqual([])
 expect(buildMoments([{time:0,count:3},{time:3600,count:3}]).map(m=>m.id)).toEqual(['steady'])
 expect(buildMoments([{time:0,count:1},{time:7200,count:4}]).map(m=>m.id)).toEqual(['quiet','peak'])
})
it('uses filtered, deduplicated aircraft snapshots rather than counts of track segments',()=>{
 const tracks=[
  {id:'a',icaoAddress:'one',callsign:'SWR1'},
  {id:'b',icaoAddress:'one',callsign:'SWR2'},
  {id:'c',icaoAddress:'two',callsign:'BAW1'},
 ] as Index['aircraft']
 const snapshots:SnapshotIndex={date:'2026-09-14',sourceManifestSha256:'test',tracks:[['a',[0,0,0,12,0,0]],['b',[0,0,0,12,0,0]],['c',[12,0,0]]]}
 const all=buildMoments(selectionActivity(tracks,snapshots).bins)
 expect(all.find(m=>m.id==='peak')?.time).toBe(3600)
 expect(all.find(m=>m.id==='peak')?.caption).toContain('2 aircraft')
 const selected=tracks.filter(track=>matchesSelection(track,{...EMPTY_SELECTION,airlines:['swiss']}))
 const filtered=buildMoments(selectionActivity(selected,snapshots).bins)
 expect(filtered.find(m=>m.id==='peak')?.time).toBe(0)
 expect(filtered.find(m=>m.id==='peak')?.caption).toContain('1 aircraft')
})
