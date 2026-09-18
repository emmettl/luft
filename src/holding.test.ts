import {expect,it} from 'vitest'
import {holdingConfidence,holdingEvidence,type HoldingSample} from './holding'
const destination={longitude:0,latitude:50}
// 6 km radius, ~280 km/h, repeated loops within 30 km of destination.
const loop=(end=480,altitude=9000):HoldingSample[]=>Array.from({length:end/10+1},(_,i)=>{const t=i*10,a=t/480*Math.PI*4;return [t,.35+.084*Math.cos(a),50+.054*Math.sin(a),altitude]})
it('finds sustained loops with little destination progress, including gradual descent',()=>{
 const samples=loop().map(p=>[p[0],p[1],p[2],10000-p[0]*3] as HoldingSample)
 const e=holdingEvidence(samples,destination)!
 expect(e.confidence).toBeGreaterThan(.8);expect(e.progress).toBeCloseTo(0,2)
 expect(e.turnDegrees).toBeGreaterThan(650)
})
it('rejects ordinary approach turns, straight tangential flight and stationary jitter',()=>{
 expect(holdingEvidence(loop(120),destination)?.confidence??0).toBe(0)
 const approach:HoldingSample[]=Array.from({length:49},(_,i)=>[i*10,.35+.14*Math.cos(i/48*Math.PI*1.5),50+.09*Math.sin(i/48*Math.PI*1.5),9000])
 expect(holdingEvidence(approach,destination)?.confidence).toBe(0)
 const tangent:HoldingSample[]=Array.from({length:49},(_,i)=>[i*10,.6,49.8+i*.4/48,9000])
 const e=holdingEvidence(tangent,destination)!
 expect(Math.abs(e.progress!)).toBeLessThan(.01);expect(e.confidence).toBe(0)
 const jitter=tangent.map(p=>[p[0],.6,50+(p[0]%30)*.00001,9000] as HoldingSample)
 expect(holdingEvidence(jitter,destination)).toBeUndefined()
})
it('requires destination context and rejects climb, cruise, distant circuits and excessive altitude change',()=>{
 expect(holdingEvidence(loop())?.confidence).toBe(0)
 expect(holdingEvidence(loop(480,35000),destination)?.confidence).toBe(0)
 expect(holdingEvidence(loop(),{longitude:10,latitude:50})?.confidence).toBe(0)
 expect(holdingEvidence(loop().map(p=>[p[0],p[1],p[2],4000+p[0]*12] as HoldingSample),destination)?.confidence).toBe(0)
})
it('never bridges observation gaps or accepts teleports or invalid samples',()=>{
 expect(holdingEvidence(loop().filter(p=>p[0]<200||p[0]>260),destination)).toBeUndefined()
 const jump=loop();jump[20]=[200,10,60,9000];expect(holdingEvidence(jump,destination)).toBeUndefined()
 const invalid=loop();invalid[10]=[100,NaN,50,9000];expect(holdingEvidence(invalid,destination)).toBeUndefined()
})
it('fades only after evidence arrives, survives seeks, and expires stale evidence',()=>{
 const points:[number,number][]=[[210,0],[240,.8],[270,.8],[300,0]]
 expect(holdingConfidence(points,239)).toBe(0)
 expect(holdingConfidence(points,255)).toBeCloseTo(.4)
 expect(holdingConfidence(points,285)).toBeCloseTo(.8)
 expect(holdingConfidence(points,315)).toBeCloseTo(.4)
 expect(holdingConfidence(points,330)).toBe(0)
 expect(holdingConfidence(points,255)).toBeCloseTo(.4)
 expect(holdingConfidence([[240,.8]],331)).toBe(0)
 expect(holdingConfidence(undefined,250)).toBe(0)
})

it('keeps a steady score between irregular evaluations instead of flickering',()=>{
 const points:[number,number][]=[[200,0],[240,.8],[280,.8],[320,.8]]
 expect(holdingConfidence(points,279.99)).toBeCloseTo(.8)
 expect(holdingConfidence(points,280)).toBeCloseTo(.8)
 expect(holdingConfidence(points,319.99)).toBeCloseTo(.8)
})
