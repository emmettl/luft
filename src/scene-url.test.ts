import {expect,it} from 'vitest'
import {sceneHash,sceneFromHash,sceneDay,type SharedScene} from './scene-url'
import {EMPTY_SELECTION} from './filters'
import {EMPTY_ENDPOINT_FILTER} from './endpoint-filters'
const scene:SharedScene={day:'2026-09-22',time:39000,view:{west:1,south:40,east:13,north:48},flight:'a',mode:'motion',daylight:false,dimOthers:false,compare:true}
it('round trips the exact recorded scene alongside existing filters',()=>{
 const hash=sceneHash({...EMPTY_SELECTION,airlines:['swiss','easyjet'],airports:['LSZH']},EMPTY_ENDPOINT_FILTER,scene)
 expect(hash).toContain('airports=LSZH');expect(sceneFromHash(hash,scene.day,new Set(['a']))).toEqual(scene)
 expect(sceneFromHash(hash,'2026-09-23',new Set(['a']))).toBeUndefined()
})
it('rejects invalid times, dates, cameras and stale flight IDs without inventing observations',()=>{
 expect(sceneDay('#day=2026-02-30')).toBeUndefined()
 for(const time of ['','NaN','Infinity','-1','86400'])expect(sceneFromHash(`#day=${scene.day}&time=${time}`,scene.day,new Set())).toBeUndefined()
 const invalid=sceneFromHash(`#day=${scene.day}&time=100&view=1,40,0,48&flight=missing`,scene.day,new Set())
 expect(invalid?.view).toBeUndefined();expect(invalid?.flight).toBeUndefined()
 expect(sceneFromHash(`#day=${scene.day}&time=100&view=0,,10,10`,scene.day,new Set())?.view).toBeUndefined()
})
