import {expect,it} from 'vitest'
import {appendRouteSamples,routeBucket,type RouteSegments} from './flight-route'
it('joins chunk boundaries without duplicating guards, retaining observation gaps',()=>{
 const routes=new Map<string,RouteSegments>()
 appendRouteSamples(routes,'a',[[0,0,0,0,0],[20,1,1,0,0],[40,2,2,0,0],[60,3,3,0,0]],0,60)
 appendRouteSamples(routes,'a',[[40,2,2,0,0],[60,3,3,0,0],[80,4,4,0,0],[140,5,5,0,0]],60,180)
 expect(routes.get('a')).toEqual([[[0,0,0,0],[40,2,2,0],[60,3,3,0],[80,4,4,0]],[[140,5,5,0]]])
})
it('preserves a route bend and keeps independent flights separate',()=>{
 const routes=new Map<string,RouteSegments>()
 appendRouteSamples(routes,'a',[[0,0,0,0,0],[20,1,0,0,0],[40,1,1,0,0]],0,60)
 appendRouteSamples(routes,'b',[[0,10,10,0,0]],0,60)
 expect(routes.get('a')?.[0]).toHaveLength(3);expect(routes.get('b')).toEqual([[[0,10,10,0]]])
 expect(routeBucket('a')).toMatch(/^[0-9a-f]{2}$/);expect(routeBucket('a')).toBe(routeBucket('a'))
})

it('retains altitude changes even on a geographically straight route',()=>{
 const routes=new Map<string,RouteSegments>()
 appendRouteSamples(routes,'climb',[[0,0,0,0,0],[20,1,1,10000,0],[40,2,2,10000,0]],0,60)
 expect(routes.get('climb')?.[0]).toHaveLength(3)
 expect(routes.get('climb')?.[0][1][3]).toBe(10000)
})
