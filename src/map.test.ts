import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {AirMap,BRITAIN} from './map'
import type {AirTrack} from '@motionstudies/core/domain/air'
import type {Airport,Land} from './data'
const context=()=>Object.fromEntries(['setTransform','clearRect','drawImage','beginPath','moveTo','lineTo','closePath','fill','stroke','arc','fillRect','strokeRect','fillText'].map(key=>[key,vi.fn()])) as unknown as CanvasRenderingContext2D
let ctx:CanvasRenderingContext2D,backdrop:CanvasRenderingContext2D,canvas:HTMLCanvasElement,resize:()=>void
const disconnect=vi.fn()
beforeEach(()=>{
 ctx=context();backdrop=context();disconnect.mockClear()
 canvas={width:0,height:0,getContext:()=>ctx,getBoundingClientRect:()=>({width:1000,height:800})} as unknown as HTMLCanvasElement
 vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>backdrop})})
 vi.stubGlobal('devicePixelRatio',1)
 vi.stubGlobal('getComputedStyle',()=>({getPropertyValue:()=> '170'}))
 vi.stubGlobal('ResizeObserver',class{constructor(callback:()=>void){resize=callback}observe(){}disconnect=disconnect})
})
afterEach(()=>vi.unstubAllGlobals())
const land={features:[{geometry:{type:'Polygon',coordinates:[[[0,40],[5,45],[10,40],[0,40]]]}}]} as Land
const track=(id:string,samples:AirTrack['samples']):AirTrack=>({id,callsign:id,start:samples[0][0],end:samples.at(-1)![0],samples})
const tracks=[track('visible',[[0,0,50,10000,300],[10,1,50,10000,300]])]
const cells=[[0,50,3]]
it('retains paused frames, caches land and redraws changed time, data, view, size and selection',()=>{
 const map=new AirMap(canvas,land,[])
 const first=map.draw(tracks,5,undefined,'motion',cells)
 expect(first.total).toBe(1);expect(ctx.clearRect).toHaveBeenCalledTimes(1);expect(backdrop.fill).toHaveBeenCalledTimes(1)
 expect(map.draw(tracks,5,undefined,'motion',cells)).toBe(first)
 expect(ctx.clearRect).toHaveBeenCalledTimes(1)
 map.draw(tracks,6,undefined,'motion',cells);expect(ctx.clearRect).toHaveBeenCalledTimes(2);expect(backdrop.fill).toHaveBeenCalledTimes(1)
 map.selectedFlight='visible';map.draw(tracks,6,undefined,'motion',cells);expect(ctx.clearRect).toHaveBeenCalledTimes(3)
 map.view={...BRITAIN};map.draw(tracks,6,undefined,'motion',cells);expect(backdrop.fill).toHaveBeenCalledTimes(2)
 resize();map.draw(tracks,6,undefined,'motion',cells);expect(backdrop.fill).toHaveBeenCalledTimes(3)
 expect(map.draw([],6,undefined,'motion',cells).total).toBe(0)
 map.dispose();expect(disconnect).toHaveBeenCalledTimes(1)
})
it('culls wholly offscreen tracks without changing counts or dropping trails that cross the view',()=>{
 const map=new AirMap(canvas,land,[]),airport={icao:'TEST',latitude:50,longitude:0,iata:'TST',city:'Test'} as Airport
 const outside={...track('outside',[[0,1000,50,10000,300],[10,1001,50,10000,300]]),destination:{icao:'TEST'}} as AirTrack
 const crossing=track('crossing',[[0,0,50,10000,300],[10,1000,50,10000,300]])
 const counts=map.draw([...tracks,outside,crossing],10,airport,'motion',cells)
 expect(counts).toEqual({total:3,inbound:1,outbound:0,visible:1})
 expect(ctx.stroke).toHaveBeenCalledTimes(2)
 expect(map.points.map(p=>p.track.id)).toEqual(['visible'])
})
it('preserves observation gaps and only repaints density when its inputs change',()=>{
 const map=new AirMap(canvas,land,[]),gapped=[track('gapped',[[0,0,50,10000,300],[60,1,50,10000,300],[70,2,50,10000,300]])]
 expect(map.draw(gapped,30,undefined,'motion',cells).total).toBe(0)
 expect(map.draw(gapped,65,undefined,'motion',cells).total).toBe(1)
 expect(ctx.lineTo).toHaveBeenCalledTimes(1) // only the valid 60→65 head; no 0→60 bridge
 map.draw(gapped,65,undefined,'density',cells)
 const draws=vi.mocked(ctx.clearRect).mock.calls.length
 map.draw(gapped,66,undefined,'density',cells);expect(ctx.clearRect).toHaveBeenCalledTimes(draws)
 map.draw(gapped,66,undefined,'density',[[0,50,4]]);expect(ctx.clearRect).toHaveBeenCalledTimes(draws+1)
})
it('feeds retained GPU state the shared positions, gap validity, selection and projection',()=>{
 const painter={begin:vi.fn(),prepare:vi.fn(),aircraft:vi.fn(),end:vi.fn(),clear:vi.fn(),dispose:vi.fn(),stats:()=>({calls:2,triangles:4,points:1,geometryBuilds:1,geometryBytes:64,geometryPreparedBytes:0,stateUploadBytes:16})}
 const map=new AirMap(canvas,land,[]),gapped=[track('gapped',[[0,0,50,10000,300],[60,1,50,10000,300],[70,2,50,10000,300]])]
 const expected=map.draw(gapped,65,undefined,'motion',cells)
 map.setPainter(painter)
 expect(map.draw(gapped,65,undefined,'motion',cells)).toEqual(expected)
 expect(painter.prepare).toHaveBeenCalledWith(gapped,undefined,undefined)
 expect(painter.aircraft).toHaveBeenLastCalledWith(0,expect.objectContaining({longitude:1.5,latitude:50}),true)
 map.draw(gapped,30,undefined,'motion',cells);expect(painter.aircraft).toHaveBeenLastCalledWith(0,undefined,false)
 const basePaints=vi.mocked(ctx.clearRect).mock.calls.length
 vi.stubGlobal('devicePixelRatio',2);map.draw(gapped,65,undefined,'motion',cells)
 expect(ctx.clearRect).toHaveBeenCalledTimes(basePaints+1)
 map.selectedFlight='gapped';map.draw(gapped,65,undefined,'motion',cells)
 expect(painter.prepare).toHaveBeenLastCalledWith(gapped,undefined,'gapped')
 expect(painter.begin).toHaveBeenLastCalledWith(1000,800,2,expect.objectContaining({xScale:.62*map.scale,yScale:-map.scale}),65)
 map.draw(gapped,65,undefined,'density',cells);expect(painter.clear).toHaveBeenCalledTimes(1)
 map.setPainter();expect(painter.dispose).toHaveBeenCalledTimes(1)
 expect(map.draw(gapped,65,undefined,'motion',cells)).toEqual(expected)
})
