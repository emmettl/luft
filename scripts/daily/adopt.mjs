// Only called in the disposable daily checkout (or explicitly by an operator).
import {readFile,mkdir,rm,cp} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {parseArgs} from 'node:util'
import {gunzipSync} from 'node:zlib'
import {execFileSync} from 'node:child_process'
import {json,hash,run,verifyRelease,verifiedFile} from './lib.mjs'
const {values:v}=parseArgs({options:{candidate:{type:'string'}}})
if(!v.candidate)throw Error('Required: --candidate VERIFIED_CANDIDATE_DIRECTORY')
const candidate=resolve(v.candidate),lock=await json(join(candidate,'data-release.json')),current=await json('data-release.json'),metadata=await json(join(candidate,'candidate.json'))
if(lock.recorderCommit!==(await json('daily-feed.json')).recorderCommit)throw Error('Candidate uses another recorder revision')
if(lock.date<=current.date)throw Error('Refusing to replace an equal or newer recorded day')
if(metadata.date!==lock.date||!/^luft-air-\d{4}-\d{2}-\d{2}-v1\.tar\.gz$/.test(metadata.archive)||lock.url!==`https://github.com/emmettl/luft/releases/download/air-${lock.date}-v1/${metadata.archive}`)throw Error('Candidate identity mismatch')
await verifiedFile(candidate,{path:metadata.archive,bytes:lock.bytes,sha256:lock.sha256})
await verifiedFile(candidate,metadata.enrichmentArchive)
const stage=join(candidate,'verified');await mkdir(stage)
function entries(archive){return execFileSync('tar',['-tzf',archive],{encoding:'utf8'}).trim().split('\n')}
if(entries(join(candidate,metadata.archive)).some(p=>p!== './'&&!/^\.\/[a-zA-Z0-9._-]+$/.test(p)))throw Error('Unsafe day archive')
if(entries(join(candidate,'enrichment.tar.gz')).some(p=>!/^enrichment\/(?:reports\/)?[a-zA-Z0-9._-]*\/?$/.test(p)))throw Error('Unsafe enrichment archive')
await mkdir(join(stage,'data'))
await run('tar',['-xzf',join(candidate,metadata.archive),'-C',join(stage,'data')])
const verified=await verifyRelease(join(stage,'data'),lock.date)
if(verified.manifestSha256!==lock.manifestSha256)throw Error('Candidate manifest mismatch')
await run('tar',['-xzf',join(candidate,'enrichment.tar.gz'),'-C',stage])
const enrichmentLock=await json(join(candidate,'enrichment-release.json'))
if(enrichmentLock.date!==lock.date||enrichmentLock.sourceManifestSha256!==lock.manifestSha256||enrichmentLock.path!=='enrichment/endpoints.json.gz.bin')throw Error('Enrichment date mismatch')
const compressed=await verifiedFile(join(stage,'enrichment'),{...enrichmentLock,path:'endpoints.json.gz.bin'})
const decoded=gunzipSync(compressed,{maxOutputLength:16*1024**2})
if(decoded.length!==enrichmentLock.decodedBytes)throw Error('Enrichment decoded size mismatch')
const {readAirEnrichment}=await import('@motionstudies/core/air-enrichment')
const tracks=JSON.parse(gunzipSync(await verifiedFile(join(stage,'data'),verified.manifest.index))).aircraft
const enrichment=readAirEnrichment(JSON.parse(decoded),{date:lock.date,sourceManifestSha256:lock.manifestSha256,tracks})
for(const source of enrichment.sources.filter(s=>s.url.startsWith('reports/'))){if(!/^reports\/[a-zA-Z0-9._-]+$/.test(source.url)||hash(await readFile(join(stage,'enrichment',source.url)))!==source.sha256)throw Error('Enrichment report mismatch')}
// All incoming bytes are now verified. Rebuild all date-bound assets before validation/promotion.
await rm('public/data',{recursive:true,force:true});await cp(join(stage,'data'),'public/data',{recursive:true})
await rm('public/enrichment',{recursive:true,force:true});await cp(join(stage,'enrichment'),'public/enrichment',{recursive:true})
await cp(join(candidate,'data-release.json'),'data-release.json');await cp(join(candidate,'enrichment-release.json'),'enrichment-release.json')
const airportBytes=gunzipSync(await readFile('public/data/airports.csv.gz'))
const airportPath=join(stage,'airports.csv');await import('node:fs/promises').then(fs=>fs.writeFile(airportPath,airportBytes))
await run(process.execPath,['scripts/build-countries.mjs','',airportPath])
await run(process.execPath,['scripts/verify-enrichment.mjs'])
console.log(`Adopted candidate ${lock.date}; publication still requires build and tests`)
