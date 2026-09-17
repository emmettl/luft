import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'

// Read the pinned OurAirports reference, including quoted commas and newlines.
function csvRows(text){
 const rows=[];let row=[],field='',quoted=false
 for(let i=0;i<text.length;i++){
  const c=text[i]
  if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted}
  else if(!quoted&&(c===','||c==='\n')){row.push(field);field='';if(c==='\n'){rows.push(row);row=[]}}
  else if(c!=='\r'||quoted)field+=c
 }
 if(field||row.length)rows.push([...row,field])
 return rows
}
const root=new URL('../public/data/',import.meta.url)
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const lock=JSON.parse(await readFile(new URL('../data-release.json',import.meta.url)))
const manifestBytes=await readFile(new URL('manifest.json',root))
if(hash(manifestBytes)!==lock.manifestSha256)throw new Error('Geography requires the pinned recorder manifest')
const manifest=JSON.parse(manifestBytes)
async function readVerified(descriptor){
 if(!descriptor||! /^[a-zA-Z0-9._-]+$/.test(descriptor.path))throw new Error('Invalid geography source')
 const bytes=await readFile(new URL(descriptor.path,root))
 if(bytes.length!==descriptor.bytes||hash(bytes)!==descriptor.sha256)throw new Error(`Geography source integrity mismatch: ${descriptor.path}`)
 return gunzipSync(bytes).toString('utf8')
}
const index=JSON.parse(await readVerified(manifest.index))
const reference=manifest.files.find(file=>file.path==='airports.csv.gz')
const [headers,...rows]=csvRows(await readVerified(reference))
const wanted=new Set(index.airports.map(a=>a.icao))
for(const track of index.aircraft)for(const endpoint of [track.origin,track.destination])if(endpoint)wanted.add(endpoint.icao)
const airports={}
for(const row of rows){
 const value=Object.fromEntries(headers.map((header,i)=>[header,row[i]]))
 if(wanted.has(value.ident))airports[value.ident]={country:value.iso_country||null,continent:value.continent||null}
}
const directory=new URL('../src/generated/',import.meta.url)
await mkdir(directory,{recursive:true})
await writeFile(new URL('geography.json',directory),JSON.stringify({date:manifest.date,sourceManifestSha256:lock.manifestSha256,sourceReferenceSha256:reference.sha256,airports})+'\n')
console.log(`Airport geography: ${Object.keys(airports).length} reference matches`)
