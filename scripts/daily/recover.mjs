import {mkdir,appendFile} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {resolve} from 'node:path'
import {recordedDate,releaseTag,run} from './lib.mjs'
const date=recordedDate(process.env.FEED_DATE),tag=releaseTag(date),candidate=resolve(process.env.FEED_CANDIDATE)
// A successful listing distinguishes a missing release from an authentication/network failure.
const releases=JSON.parse(execFileSync('gh',['release','list','--repo','emmettl/luft','--limit','100','--json','tagName'],{encoding:'utf8'}))
let recovered=releases.some(r=>r.tagName===tag)
if(recovered){
 const release=JSON.parse(execFileSync('gh',['release','view',tag,'--repo','emmettl/luft','--json','assets,isDraft'],{encoding:'utf8'}))
 const required=[`luft-${tag}.tar.gz`,'enrichment.tar.gz','data-release.json','enrichment-release.json','candidate.json']
 if(required.some(name=>!release.assets.some(a=>a.name===name))){
  if(!release.isDraft)throw Error('Published release is incomplete; refusing to replace immutable public data')
  // An interrupted upload is still private. Discard only its incomplete draft, preserving the tag.
  await run('gh',['release','delete',tag,'--repo','emmettl/luft','--yes']);recovered=false
 }
}
if(recovered){
 await mkdir(candidate,{recursive:true})
 await run('gh',['release','download',tag,'--repo','emmettl/luft','--dir',candidate,'--pattern',`luft-${tag}.tar.gz`,'--pattern','enrichment.tar.gz','--pattern','data-release.json','--pattern','enrichment-release.json','--pattern','candidate.json'])
}
if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`recovered=${recovered}\n`)
console.log(recovered?`Reusing immutable candidate ${tag}`:`No existing candidate for ${tag}`)
