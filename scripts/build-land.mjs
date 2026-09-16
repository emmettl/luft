// Manual, reproducible geography refresh; the derived asset is checked in.
import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const url='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_50m_land.geojson'
const sha256='e874b27a51d146452be360cafb3cc50c86001074a67d534113e6534682f9826b'
const response=process.argv[2]?null:await fetch(url)
if(response&&!response.ok)throw new Error(`Natural Earth download: ${response.status}`)
const bytes=process.argv[2]?await readFile(process.argv[2]):Buffer.from(await response.arrayBuffer())
if(createHash('sha256').update(bytes).digest('hex')!==sha256)throw new Error('Natural Earth source hash mismatch')
// Keep complete polygons and their holes. Six degrees of surrounding context
// extend beyond the map's four-degree fade without simplifying any coastline.
const contextBounds=[-31,28,51,78],polygons=[]
for(const {geometry} of JSON.parse(bytes).features){
 for(const polygon of geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates){
  let west=Infinity,south=Infinity,east=-Infinity,north=-Infinity
  for(const [lon,lat] of polygon[0]){west=Math.min(west,lon);east=Math.max(east,lon);south=Math.min(south,lat);north=Math.max(north,lat)}
  if(east>=contextBounds[0]&&west<=contextBounds[2]&&north>=contextBounds[1]&&south<=contextBounds[3])polygons.push(polygon)
 }
}
const asset={type:'FeatureCollection',source:{name:'Natural Earth 1:50m land',url,sha256,license:'Public domain',contextBounds,derivation:'Complete polygons intersecting context bounds; original coordinates and holes retained.'},features:[{type:'Feature',properties:{},geometry:{type:'MultiPolygon',coordinates:polygons}}]}
await writeFile(new URL('../src/assets/europe-land-50m.json',import.meta.url),JSON.stringify(asset)+'\n')
console.log(`Retained ${polygons.length} polygons, ${polygons.reduce((n,p)=>n+p.reduce((n,r)=>n+r.length,0),0)} vertices`)
