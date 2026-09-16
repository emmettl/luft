import {expect,it} from 'vitest'
import type {AirTrack} from '@motionstudies/core/domain/air'
import {VisibilityFades,VISIBILITY_FADE_SECONDS} from './visibility-fades'
const track=(times:number[]):AirTrack=>({id:'flight',callsign:'TEST',start:times[0],end:times.at(-1)!,samples:times.map(t=>[t,0,50,30000,400])})
it('fades first observations over real playback time at every pace and freezes while paused',()=>{
 for(const speed of [60,300,900]){
  const fades=new VisibilityFades(),t=track(Array.from({length:100},(_,i)=>100+i*10));fades.begin(90);fades.opacity(t,90,0,false);fades.end()
  fades.begin(100);expect(fades.opacity(t,100,1,true)).toBe(0);fades.end()
  for(let i=1;i<=3;i++){fades.begin(100+speed*i/10);const alpha=fades.opacity(t,100+speed*i/10,1+i/10,true);if(i===3)expect(alpha).toBeCloseTo(.5);fades.end()}
  fades.begin(100+speed*.3);expect(fades.opacity(t,100+speed*.3,1.3,true)).toBeCloseTo(.5);fades.end()
  fades.begin(100+speed*.4);expect(fades.opacity(t,100+speed*.4,1+VISIBILITY_FADE_SECONDS,true)).toBe(1)
 }
})
it('detects a gap even when one fast playback frame skips it, and never supplies a missing position',()=>{
 const f=new VisibilityFades(),t=track([0,10,20,100,110,120]);f.begin(10);expect(f.opacity(t,10,0,true)).toBe(1);f.end()
 f.begin(105);expect(f.opacity(t,105,.1,true)).toBe(0);f.end()
 f.begin(110);expect(f.opacity(t,110,.4,true)).toBeCloseTo(.5);f.end()
 f.begin(115);expect(f.opacity(t,115,.5,false)).toBe(0);f.end()
 f.begin(120);expect(f.opacity(t,120,.6,true)).toBe(0)
})
it('preserves progress and fully visible tracks across overlapping chunk replacements and renderer redraws',()=>{
 const f=new VisibilityFades(),a=track([0,10,20,30,40]),b=track([20,30,40,50]);
 f.begin(25);expect(f.opacity(a,25,0,true)).toBe(1);f.end()
 f.begin(35);expect(f.opacity(b,35,.1,true)).toBe(1);f.end()
 f.begin(35);expect(f.opacity(b,35,.1,true)).toBe(1);f.end()
 f.begin(36);f.opacity(b,36,.2,false);f.end()
 f.begin(37);expect(f.opacity(b,37,.3,true)).toBe(0);f.end()
 f.begin(38);expect(f.opacity({...b},38,.6,true)).toBeCloseTo(.5)
})
it('primes immediately on load, explicit reset, loop or large jump and forgets removed tracks',()=>{
 const f=new VisibilityFades(),t=track([0,10,20]);
 for(const time of [10,0,500]){f.begin(time);expect(f.opacity(t,time,0,true)).toBe(1);f.end()}
 f.begin(501);f.end();f.begin(502);expect(f.opacity(t,502,.1,true)).toBe(0);f.end()
 f.reset();f.begin(503);expect(f.opacity(t,503,.2,true)).toBe(1)
})
