import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {readAirEnrichment} from '@motionstudies/core/air-enrichment'
const hash=b=>createHash('sha256').update(b).digest('hex')
const lock=JSON.parse(await readFile(new URL('../enrichment-release.json',import.meta.url))),data=JSON.parse(await readFile(new URL('../data-release.json',import.meta.url)))
const root=new URL('../public/',import.meta.url),manifestBytes=await readFile(new URL('data/manifest.json',root))
if(hash(manifestBytes)!==data.manifestSha256||lock.sourceManifestSha256!==data.manifestSha256||lock.date!==data.date)throw Error('Enrichment/release binding mismatch')
const manifest=JSON.parse(manifestBytes),indexBytes=await readFile(new URL(`data/${manifest.index.path}`,root))
if(hash(indexBytes)!==manifest.index.sha256||indexBytes.length!==manifest.index.bytes)throw Error('Index integrity mismatch')
if(!/^enrichment\/[a-zA-Z0-9._-]+$/.test(lock.path))throw Error('Unsafe enrichment path')
const bytes=await readFile(new URL(lock.path,root))
if(hash(bytes)!==lock.sha256||bytes.length!==lock.bytes)throw Error('Enrichment integrity mismatch')
const decoded=gunzipSync(bytes,{maxOutputLength:16*1024**2})
if(decoded.length!==lock.decodedBytes)throw Error('Enrichment decoded length mismatch')
const enrichment=readAirEnrichment(JSON.parse(decoded),{date:data.date,sourceManifestSha256:data.manifestSha256,tracks:JSON.parse(gunzipSync(indexBytes)).aircraft})
for(const source of enrichment.sources.filter(s=>s.url.startsWith('reports/'))){
 const report=await readFile(new URL(`enrichment/${source.url}`,root));if(hash(report)!==source.sha256)throw Error('Enrichment source report mismatch')
}
console.log(`Verified endpoint enrichment: ${enrichment.proposals.length} proposals; canonical release unchanged`)
