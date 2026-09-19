import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {gunzipSync} from 'node:zlib'
import {readAirEnrichment} from '@motionstudies/core/air-enrichment'
import {digestHex} from '@motionstudies/data/release'
import {readReleaseFile} from '@motionstudies/data/release-files'
import {openAirRelease} from './daily/lib.mjs'
const lock=JSON.parse(await readFile(new URL('../enrichment-release.json',import.meta.url))),data=JSON.parse(await readFile(new URL('../data-release.json',import.meta.url)))
const root=new URL('../public/',import.meta.url)
if(lock.sourceManifestSha256!==data.manifestSha256||lock.date!==data.date)throw Error('Enrichment/release binding mismatch')
// The pinned manifest and its index are read through the shared verifier.
const release=await openAirRelease(new URL('data/',root),data.manifestSha256),indexBytes=await release.read(release.manifest.index)
if(!/^enrichment\/[a-zA-Z0-9._-]+$/.test(lock.path))throw Error('Unsafe enrichment path')
const bytes=await readReleaseFile(fileURLToPath(root),lock)
const decoded=gunzipSync(bytes,{maxOutputLength:16*1024**2})
if(decoded.length!==lock.decodedBytes)throw Error('Enrichment decoded length mismatch')
const enrichment=readAirEnrichment(JSON.parse(decoded),{date:data.date,sourceManifestSha256:data.manifestSha256,tracks:JSON.parse(gunzipSync(indexBytes)).aircraft})
for(const source of enrichment.sources.filter(s=>s.url.startsWith('reports/'))){
 if(!/^reports\/[a-zA-Z0-9._-]+$/.test(source.url))throw Error('Unsafe enrichment source report path')
 const report=await readFile(new URL(`enrichment/${source.url}`,root));if(await digestHex(report)!==source.sha256)throw Error('Enrichment source report mismatch')
}
console.log(`Verified endpoint enrichment: ${enrichment.proposals.length} proposals; canonical release unchanged`)
