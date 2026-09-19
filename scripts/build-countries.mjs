// Manual reproducible refresh; no geography downloads during normal builds.
import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {openAirRelease} from './daily/lib.mjs'
const root=new URL('../',import.meta.url),digest=bytes=>createHash('sha256').update(bytes).digest('hex')
const geography={url:'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_50m_admin_0_countries.geojson',sha256:'3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb'}
const detailGeography={url:geography.url.replace('ne_50m_', 'ne_10m_'),sha256:'239eec57ac17f100a11e2536cffc56752c318b50ae765b0918ff7aab4ce8f255'}
// Country index requires the pinned manifest; its airport index is read through the shared verifier.
const lock=JSON.parse(await readFile(new URL('data-release.json',root))),release=await openAirRelease(new URL('public/data/',root),lock.manifestSha256),manifest=release.manifest
async function source(descriptor,path){
 const response=path?null:await fetch(descriptor.url)
 if(response&&!response.ok)throw Error(`Country source unavailable: ${response.status}`)
 const bytes=path?await readFile(path):Buffer.from(await response.arrayBuffer())
 if(digest(bytes)!==descriptor.sha256)throw Error(`Country source hash mismatch: ${descriptor.url}`)
 return bytes
}
// RFC4180-style quoted fields, including embedded commas/newlines and escaped quotes.
function csv(text){
 const rows=[];let row=[],field='',quoted=false
 for(let i=0;i<text.length;i++){
  const c=text[i]
  if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted}
  else if(!quoted&&(c===','||c==='\n')){row.push(field);field='';if(c==='\n'){rows.push(row);row=[]}}
  else if(c!=='\r'||quoted)field+=c
 }
 if(field||row.length){row.push(field);rows.push(row)}
 const keys=rows.shift();return rows.map(row=>Object.fromEntries(keys.map((key,i)=>[key,row[i]])))
}
const geometry=JSON.parse(await source(geography,process.argv[2]))
const reference=csv((await source(manifest.references.airports,process.argv[3])).toString())
const airportCountries=new Map()
for(const row of reference){airportCountries.set(row.ident,row.iso_country);if(row.icao_code)airportCountries.set(row.icao_code,row.iso_country)}
const indexBytes=await release.read(manifest.index)
const airports=JSON.parse(gunzipSync(indexBytes)).airports
const contextBounds=[-31,28,51,78],countries=new Map()
const aliases={GB:['UK','Britain','Great Britain'],CH:['Swiss','Schweiz','Suisse','Svizzera'],CZ:['Czech Republic'],TR:['Türkiye','Turkiye'],NL:['Holland']}
const detailGeometry=JSON.parse(await source(detailGeography,process.argv[4]))
const existingCodes=new Set(geometry.features.map(f=>f.properties.ADM0_A3))
const features=[...geometry.features,...detailGeometry.features.filter(f=>!existingCodes.has(f.properties.ADM0_A3))]
for(const {properties:p,geometry:g} of features){
 // Align these map units with the country codes used by the airport reference.
 const code=({ALD:'FI',CYN:'CY'})[p.ADM0_A3]??p.ISO_A2_EH
 if(!code||code==='-99')continue
 const polygons=(g.type==='Polygon'?[g.coordinates]:g.coordinates).filter(poly=>{
  const xs=poly[0].map(p=>p[0]),ys=poly[0].map(p=>p[1])
  return Math.max(...xs)>=contextBounds[0]&&Math.min(...xs)<=contextBounds[2]&&Math.max(...ys)>=contextBounds[1]&&Math.min(...ys)<=contextBounds[3]
 })
 if(!polygons.length)continue
 let country=countries.get(code)
 if(!country){country={code,name:p.NAME_EN||p.NAME_LONG,aliases:[],polygons:[],airports:[]};countries.set(code,country)}
 if(p.ISO_A2_EH===code)country.name=p.NAME_EN||p.NAME_LONG
 country.aliases.push(...[p.NAME,p.NAME_LONG,p.NAME_DE,p.NAME_FR,p.NAME_IT,p.ISO_A3_EH,...(aliases[code]??[])].filter(v=>v&&v!=='-99'))
 country.polygons.push(...polygons)
}
for(const airport of airports){
 const code=airportCountries.get(airport.icao),country=countries.get(code)
 if(!country)throw Error(`No country geometry for airport ${airport.icao} (${code})`)
 country.airports.push(airport.icao)
}
const result=[...countries.values()].map(country=>({...country,searchable:country.polygons.some(poly=>{const xs=poly[0].map(p=>p[0]),ys=poly[0].map(p=>p[1]);return Math.max(...xs)>=manifest.bounds[0]&&Math.min(...xs)<=manifest.bounds[2]&&Math.max(...ys)>=manifest.bounds[1]&&Math.min(...ys)<=manifest.bounds[3]}),aliases:[...new Set(country.aliases)].filter(s=>s!==country.name),airports:country.airports.sort()})).sort((a,b)=>a.name.localeCompare(b.name))
await writeFile(new URL('src/assets/europe-countries-50m.json',root),JSON.stringify({source:{name:'Natural Earth 1:50m countries',...geography,supplement:detailGeography,license:'Public domain',contextBounds,airports:manifest.references.airports,sourceManifestSha256:lock.manifestSha256,derivation:'Complete polygons intersecting context bounds; Åland grouped with Finland and Northern Cyprus with Cyprus to match airport reference codes. Airport membership from the pinned OurAirports reference.'},countries:result})+'\n')
console.log(`${result.length} countries/territories; ${airports.length} mapped airports`)
