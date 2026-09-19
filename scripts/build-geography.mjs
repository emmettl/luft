import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import {openAirRelease} from './daily/lib.mjs'

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
const lock=JSON.parse(await readFile(new URL('../data-release.json',import.meta.url)))
// Geography requires the pinned recorder manifest; sources are read through the shared verifier.
const release=await openAirRelease(root,lock.manifestSha256),manifest=release.manifest
async function readVerified(descriptor){
 return gunzipSync(await release.read(descriptor,'Invalid geography source')).toString('utf8')
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
