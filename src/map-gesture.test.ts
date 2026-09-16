import {expect,it,vi} from 'vitest'
import {MapGesture} from './map-gesture'

const pointer=(pointerId:number,clientX:number,clientY=200)=>({pointerId,clientX,clientY})
const setup=()=>({gesture:new MapGesture(),map:{pan:vi.fn(),zoom:vi.fn()}})

it.each([1,2])('continues dragging from the remaining finger after finger %i lifts',lifted=>{
 const {gesture,map}=setup()
 gesture.down(pointer(1,100));gesture.down(pointer(2,200))
 gesture.move(pointer(1,90),map);gesture.move(pointer(2,210),map)
 expect(map.zoom.mock.calls.map(([factor])=>factor)).toEqual([100/110,110/120])
 expect(gesture.up(pointer(lifted,lifted===1?90:210))).toBe(false)
 const remaining=lifted===1?2:1,x=remaining===1?90:210
 gesture.move(pointer(remaining,x+3,204),map)
 expect(map.pan).toHaveBeenCalledExactlyOnceWith(3,4)
 expect(gesture.up(pointer(remaining,x+3,204))).toBe(false)
})

it('starts a new pinch from the current fingers after dragging or adding a third finger',()=>{
 const {gesture,map}=setup()
 gesture.down(pointer(1,100));gesture.down(pointer(2,200))
 gesture.move(pointer(2,220),map);gesture.up(pointer(2,220))
 gesture.move(pointer(1,120),map);gesture.down(pointer(3,220))
 gesture.move(pointer(3,240),map)
 expect(map.zoom).toHaveBeenLastCalledWith(100/120)
 gesture.down(pointer(4,300));gesture.move(pointer(4,350),map)
 expect(map.pan).toHaveBeenCalledExactlyOnceWith(20,0)
 expect(map.zoom).toHaveBeenCalledTimes(2)
 gesture.up(pointer(3,240));gesture.move(pointer(4,370),map)
 expect(map.zoom).toHaveBeenLastCalledWith(230/250)
})

it('cancellation or lost capture cannot leave a stale finger or select an aircraft',()=>{
 const {gesture,map}=setup()
 gesture.down(pointer(1,100));gesture.down(pointer(2,200))
 gesture.cancel(pointer(2,200));gesture.move(pointer(2,500),map)
 gesture.move(pointer(1,102),map)
 expect(map.pan).toHaveBeenCalledExactlyOnceWith(2,0)
 expect(gesture.up(pointer(1,102))).toBe(false)
 gesture.cancel(pointer(1,102))
 gesture.down(pointer(3,150));expect(gesture.up(pointer(3,150))).toBe(true)
 expect(gesture.up(pointer(3,150))).toBe(false)
})

it('distinguishes taps from slow drags and stationary two-finger gestures',()=>{
 const {gesture,map}=setup()
 gesture.down(pointer(1,100))
 for(const x of [101,102,103,104])gesture.move(pointer(1,x),map)
 expect(gesture.up(pointer(1,104))).toBe(false)
 gesture.down(pointer(2,100));gesture.down(pointer(3,200))
 expect(gesture.up(pointer(3,200))).toBe(false)
 expect(gesture.up(pointer(2,100))).toBe(false)
 gesture.down(pointer(4,100));expect(gesture.up(pointer(4,101))).toBe(true)
})

it('does not zoom by an invalid factor when fingers overlap',()=>{
 const {gesture,map}=setup()
 gesture.down(pointer(1,100));gesture.down(pointer(2,200))
 gesture.move(pointer(2,100),map);gesture.move(pointer(2,110),map)
 expect(map.zoom).not.toHaveBeenCalled()
 gesture.move(pointer(2,120),map);expect(map.zoom).toHaveBeenCalledExactlyOnceWith(.5)
})
