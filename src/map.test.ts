import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {AirMap,BRITAIN,EUROPE} from './map'
import type {AirTrack} from '@motionstudies/core/domain/air'
import type {Airport,Land} from './data'
const context=()=>({...Object.fromEntries(['save','restore','setTransform','clearRect','drawImage','beginPath','moveTo','lineTo','closePath','fill','stroke','arc','fillRect','strokeRect','fillText'].map(key=>[key,vi.fn()])),createLinearGradient:vi.fn(()=>({addColorStop:vi.fn()}))}) as unknown as CanvasRenderingContext2D
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
it('draws the whole selected observed route with separate gaps and removes it on clear',()=>{
 const map=new AirMap(canvas,land,[]),empty:AirTrack[]=[]
 map.selectedFlight='visible'
 map.setFlightRoute({id:'visible',segments:[[[0,-4,50],[10,0,50]],[[100,4,50],[110,8,50]]]})
 map.draw(empty,5,undefined,'motion',cells)
 expect(ctx.moveTo).toHaveBeenCalledTimes(2);expect(ctx.lineTo).toHaveBeenCalledTimes(2)
 expect(ctx.arc).toHaveBeenCalledTimes(2)
 const paints=vi.mocked(ctx.stroke).mock.calls.length
 map.draw(empty,5,undefined,'motion',cells);expect(ctx.stroke).toHaveBeenCalledTimes(paints)
 map.selectedFlight=undefined;map.draw(empty,5,undefined,'motion',cells)
 expect(ctx.stroke).toHaveBeenCalledTimes(paints)
 map.dispose()
})
it('caches country borders and repaints fills and all airport markers on a paused selection change',()=>{
 const airports=[{icao:'TEST',latitude:50,longitude:0,iata:'TST',city:'Test',hasObservedMovements:false}] as Airport[]
 const map=new AirMap(canvas,land,airports),countries=[{code:'XX',name:'Test',aliases:[],airports:['TEST'],polygons:[[[[-1,49],[1,49],[1,51],[-1,51],[-1,49]]]]}]
 map.setCountries(countries);map.draw(tracks,5,undefined,'motion',cells)
 const basePaints=vi.mocked(backdrop.stroke).mock.calls.length
 map.draw(tracks,6,undefined,'motion',cells);expect(backdrop.stroke).toHaveBeenCalledTimes(basePaints)
 map.setCountries(countries,['XX']);map.draw(tracks,6,undefined,'motion',cells)
 expect(backdrop.arc).toHaveBeenCalledWith(expect.any(Number),expect.any(Number),4,0,Math.PI*2)
 expect(map.airportLabels[0]?.highlighted).toBe(true)
 map.setCountries(countries,[]);map.draw(tracks,6,undefined,'motion',cells)
 expect(map.airportLabels).toEqual([])
 map.setMotionEffectsEnabled(false);map.frameCountries(['XX'])
 expect(map.view.west).toBeLessThan(-1);expect(map.view.east).toBeGreaterThan(1)
 map.setCountries([{...countries[0],code:'OUT',polygons:[[[[60,10],[65,10],[65,15],[60,10]]]]}]);map.frameCountries(['OUT'])
 expect(map.view).toEqual(EUROPE)
 map.dispose()
})
it('animates camera changes while paused, settles, and cancels on gestures or reduced motion',()=>{
 const now=vi.spyOn(performance,'now').mockReturnValue(0),map=new AirMap(canvas,land,[])
 map.draw(tracks,5,undefined,'motion',cells)
 map.transitionTo(BRITAIN)
 now.mockReturnValue(350);map.draw(tracks,5,undefined,'motion',cells)
 expect(map.view.west).toBeCloseTo((EUROPE.west+BRITAIN.west)/2)
 now.mockReturnValue(700);map.draw(tracks,5,undefined,'motion',cells)
 expect(map.view).toEqual(BRITAIN)
 const frames=map.renderedFrames
 now.mockReturnValue(900);map.draw(tracks,5,undefined,'motion',cells)
 expect(map.renderedFrames).toBe(frames)
 map.transitionTo(EUROPE);map.pan(10,0);const manual={...map.view}
 now.mockReturnValue(2000);map.draw(tracks,5,undefined,'motion',cells)
 expect(map.view).toEqual(manual)
 map.setMotionEffectsEnabled(false);map.transitionTo(EUROPE)
 expect(map.view).toEqual(EUROPE)
 now.mockRestore();map.dispose()
})
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
 expect(painter.prepare).toHaveBeenCalledWith(gapped,[],undefined,undefined)
 expect(painter.aircraft).toHaveBeenLastCalledWith(0,expect.objectContaining({longitude:1.5,latitude:50}),true,1)
 map.draw(gapped,30,undefined,'motion',cells);expect(painter.aircraft).toHaveBeenLastCalledWith(0,undefined,false,0)
 const basePaints=vi.mocked(ctx.clearRect).mock.calls.length
 vi.stubGlobal('devicePixelRatio',2);map.draw(gapped,65,undefined,'motion',cells)
 expect(ctx.clearRect).toHaveBeenCalledTimes(basePaints+1)
 map.selectedFlight='gapped';map.draw(gapped,65,undefined,'motion',cells)
 expect(painter.prepare).toHaveBeenLastCalledWith(gapped,[],'gapped',undefined)
 expect(painter.begin).toHaveBeenLastCalledWith(1000,800,2,expect.objectContaining({xScale:.62*map.scale,yScale:-map.scale}),65)
 map.draw(gapped,65,undefined,'density',cells);expect(painter.clear).toHaveBeenCalledTimes(1)
 map.setPainter();expect(painter.dispose).toHaveBeenCalledTimes(1)
 expect(map.draw(gapped,65,undefined,'motion',cells)).toEqual(expected)
})

it('caps zoom-out at the recorded extent from Europe, Britain and airport views',()=>{
 const map=new AirMap(canvas,land,[])
 map.zoom(1.4);expect(map.view).toEqual(EUROPE)
 for(const view of [BRITAIN,{west:2,south:42,east:18,north:52}]){
  map.view={...view};const aspect=(view.east-view.west)/(view.north-view.south)
  map.zoom(100)
  expect(map.view.west).toBeGreaterThanOrEqual(EUROPE.west)
  expect(map.view.east).toBeLessThanOrEqual(EUROPE.east)
  expect(map.view.south).toBeGreaterThanOrEqual(EUROPE.south)
  expect(map.view.north).toBeLessThanOrEqual(EUROPE.north)
  expect((map.view.east-map.view.west)/(map.view.north-map.view.south)).toBeCloseTo(aspect)
 }
 map.zoom(.01);expect(map.view.east-map.view.west).toBeCloseTo(2)
 const close={...map.view};map.zoom(NaN);map.zoom(0);expect(map.view).toEqual(close)
})
it('fades the land outside the manifest bounds only when rebuilding its cached projection',()=>{
 const bounds={west:-12,south:47,east:16,north:62},map=new AirMap(canvas,land,[],bounds)
 expect(map.view).toEqual(bounds)
 map.draw(tracks,5,undefined,'motion',cells)
 expect(backdrop.createLinearGradient).toHaveBeenCalledTimes(2)
 expect(backdrop.globalCompositeOperation).toBe('source-over')
 map.draw(tracks,6,undefined,'motion',cells)
 expect(backdrop.createLinearGradient).toHaveBeenCalledTimes(2)
 map.zoom(.7);map.draw(tracks,6,undefined,'motion',cells)
 expect(backdrop.createLinearGradient).toHaveBeenCalledTimes(4)
 map.zoom(100);for(const key of ['west','east','south','north'] as const)expect(map.view[key]).toBeCloseTo(bounds[key])
})

it('dims context behind matches while keeping counts and picking scoped to the filter, including paused changes',()=>{
 const map=new AirMap(canvas,land,[])
 const other={...track('other',[[0,3,50,10000,300],[10,4,50,10000,300]]),destination:{icao:'TEST'}} as AirTrack
 const all=[...tracks,other],matching=new Set(['visible']),ink:number[]=[]
 vi.mocked(ctx.stroke).mockImplementation(()=>ink.push(ctx.globalAlpha))
 const counts=map.draw(all,5,undefined,'motion',cells,0,matching)
 expect(ink).toEqual([.14,1])
 expect(counts).toEqual({total:1,inbound:0,outbound:0,visible:1})
 expect(map.points.map(p=>p.track.id)).toEqual(['visible'])
 ink.length=0
 expect(map.draw(all,5,undefined,'motion',cells,0,new Set()).total).toBe(0)
 expect(ink).toEqual([.14,.14]);expect(map.points).toEqual([])
 ink.length=0
 expect(map.draw(all,5,undefined,'motion',cells).total).toBe(2)
 expect(ink).toEqual([1,1])
 const painter={begin:vi.fn(),prepare:vi.fn(),aircraft:vi.fn(),end:vi.fn(),clear:vi.fn(),dispose:vi.fn(),stats:vi.fn()}
 map.setPainter(painter)
 expect(map.draw(all,5,undefined,'motion',cells,0,matching)).toEqual(counts)
 expect(painter.prepare).toHaveBeenCalledWith(all,[],undefined,matching)
 expect(painter.aircraft).toHaveBeenCalledTimes(2)
 expect(map.points.map(p=>p.track.id)).toEqual(['visible'])
})
