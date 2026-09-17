// Prepare an immutable candidate outside the checkout. Publication is a separate step.
import {readFile,writeFile,mkdir,cp,stat} from 'node:fs/promises'
import {resolve,join,relative,isAbsolute} from 'node:path'
import {parseArgs} from 'node:util'
import {execFileSync} from 'node:child_process'
import {gunzipSync} from 'node:zlib'
import {json,writeJson,hash,run,download,recordedDate,releaseTag,verifyRelease,verifiedFile} from './lib.mjs'
const {values:v}=parseArgs({options:{date:{type:'string'},recorder:{type:'string'},work:{type:'string'}}})
if(!v.recorder||!v.work)throw Error('Required: --recorder CHECKOUT --work NEW_WORK_DIRECTORY [--date YYYY-MM-DD]')
const date=recordedDate(v.date),recorder=resolve(v.recorder),work=resolve(v.work),config=await json('daily-feed.json')
for(const protectedRoot of [process.cwd(),recorder]){
 const path=relative(protectedRoot,work)
 if(!path||(!path.startsWith('..')&&!isAbsolute(path)))throw Error('Candidate work directory must be outside both source checkouts')
}
const commit=execFileSync('git',['-C',recorder,'rev-parse','HEAD'],{encoding:'utf8'}).trim()
if(commit!==config.recorderCommit)throw Error('Recorder checkout differs from pinned compiler')
const tag=releaseTag(date),archiveName=`luft-${tag}.tar.gz`,release=join(work,'audit/release'),candidate=join(work,'candidate')
await mkdir(work,{recursive:true});await mkdir(candidate)

// Use the retained, hash-pinned airport and land inputs, never a moving reference URL.
let reference=resolve('public/data')
if(await readFile(join(reference,'manifest.json')).then(b=>hash(b)!==config.referenceRelease.manifestSha256,()=>true)){
 reference=join(work,'reference');await mkdir(reference,{recursive:true})
 const archive=join(work,'reference.tar.gz')
 await download(config.referenceRelease.url,archive,{sha256:config.referenceRelease.sha256})
 await run('tar',['-xzf',archive,'-C',reference])
}
const referenceBytes=await readFile(join(reference,'manifest.json'))
if(hash(referenceBytes)!==config.referenceRelease.manifestSha256)throw Error('Reference manifest mismatch')
const manifest=JSON.parse(referenceBytes),airports=gunzipSync(await verifiedFile(reference,manifest.files.find(f=>f.path==='airports.csv.gz')))
if(hash(airports)!==manifest.references.airports.sha256)throw Error('Airport reference mismatch')
await writeFile(join(work,'airports.csv'),airports)
await writeFile(join(work,'land.geojson'),await verifiedFile(reference,manifest.land))
await run(process.execPath,[join(recorder,'scripts/capture-air-day.mjs'),'--date',date,'--store',join(work,'source')])
await run(process.execPath,[join(recorder,'scripts/release-air-day.mjs'),'--date',date,'--store',join(work,'source'),'--airports',join(work,'airports.csv'),'--land',join(work,'land.geojson'),'--out',release])
const verified=await verifyRelease(release,date)

// The shared exporter accepts no reviews for a new day: candidates remain explicitly unreviewed.
const routes=config.routeReference,vrsDirectory=`standing-data-${routes.commit}`
const vrsArchive=join(work,'vrs.tar.gz'),vrsRoot=join(work,'audit',vrsDirectory)
await download(`https://codeload.github.com/vradarserver/standing-data/tar.gz/${routes.commit}`,vrsArchive,{maxBytes:256*1024**2})
await run('tar',['-xzf',vrsArchive,'-C',join(work,'audit')])
for(const [path,sha256] of Object.entries(routes.routeFilesSha256)){
 if(!/^routes\/schema-01\/[A-Z0-9]\/[-A-Za-z0-9]+\.csv$/.test(path)||hash(await readFile(join(vrsRoot,path)))!==sha256)throw Error(`Route reference mismatch: ${path}`)
}
await writeJson(join(work,'audit/vrs-audit.json'),{manifestSha256:verified.manifestSha256,airportReferenceSha256:hash(airports),vrsDirectory,routeFilesSha256:routes.routeFilesSha256})
await writeJson(join(work,'reviews.json'),[])
await run(process.execPath,[join(recorder,'scripts/export-air-enrichment.mjs'),'--audit',join(work,'audit'),'--reviews',join(work,'reviews.json'),'--out',join(candidate,'enrichment')])
await run('tar',['-czf',join(candidate,archiveName),'-C',release,'.'])
const archive=await readFile(join(candidate,archiveName))
const lock={date,url:`https://github.com/emmettl/luft/releases/download/${tag}/${archiveName}`,bytes:archive.length,sha256:hash(archive),manifestSha256:verified.manifestSha256,recorderCommit:commit}
await writeJson(join(candidate,'data-release.json'),lock)
await cp(join(candidate,'enrichment/enrichment-lock.json'),join(candidate,'enrichment-release.json'))
await run('tar',['-czf',join(candidate,'enrichment.tar.gz'),'-C',candidate,'enrichment'])
const enrichmentArchive=await readFile(join(candidate,'enrichment.tar.gz'))
await writeJson(join(candidate,'candidate.json'),{date,tag,archive:archiveName,enrichmentArchive:{path:'enrichment.tar.gz',bytes:enrichmentArchive.length,sha256:hash(enrichmentArchive)},audit:verified.manifest.audit})
await writeFile(join(candidate,'release-notes.md'),`Recorded aircraft over Europe: ${date}, 00:00–24:00 UTC.\n\n${verified.manifest.audit.aircraft.toLocaleString('en-US')} observed aircraft identities; ${verified.manifest.audit.tracks.toLocaleString('en-US')} track segments. All 48 source slices and 8,640 ten-second frames verified.\n\nADSB.lol and contributors, ODbL 1.0. OurAirports and Natural Earth, public domain. VRS route references, CC0. Source URLs and hashes accompany the data. Observed boundaries are not confirmed flights or airport events. Endpoint candidates are opt-in; this daily export carries no manual corroboration from another date.\n\nRecorder: ${commit}. The attached descriptors pin the archive and enrichment to the same day.\n`)
console.log(`Prepared ${date}: ${candidate} (${(await stat(join(candidate,archiveName))).size} bytes)`)
