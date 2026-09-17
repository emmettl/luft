import {execFileSync} from 'node:child_process'
import {resolve,join} from 'node:path'
import {json,run} from './lib.mjs'
const candidate=resolve(process.env.FEED_CANDIDATE),metadata=await json(join(candidate,'candidate.json')),lock=await json('data-release.json')
if(metadata.date!==lock.date)throw Error('Validated candidate differs from checkout')
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim()
const original=git('rev-parse','HEAD'),remote=git('ls-remote','origin','refs/heads/main').split(/\s/)[0]
if(remote!==original)throw Error('Main changed while validating; rerun the refresh against the new code')
const releases=JSON.parse(execFileSync('gh',['release','list','--repo','emmettl/luft','--limit','100','--json','tagName,isDraft'],{encoding:'utf8'}))
const existing=releases.find(r=>r.tagName===metadata.tag)
if(!existing){
 await run('gh',['release','create',metadata.tag,'--repo','emmettl/luft','--target',original,'--draft','--title',`Aircraft over Europe · ${metadata.date}`,'--notes-file',join(candidate,'release-notes.md'),... [metadata.archive,'enrichment.tar.gz','data-release.json','enrichment-release.json','candidate.json'].map(p=>join(candidate,p))])
}
if(!existing||existing.isDraft)await run('gh',['release','edit',metadata.tag,'--repo','emmettl/luft','--draft=false','--latest=false'])
// Download once from the public URL and verify it before any pin reaches main.
await run(process.execPath,['scripts/daily/check-public.mjs'])
git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
git('add','data-release.json','enrichment-release.json','src/assets/europe-countries-50m.json','public/enrichment','public/feed.json')
git('commit','-m',`Refresh recorded aircraft day to ${metadata.date}`)
await run('git',['push','origin','HEAD:main'])
console.log(`Published and pinned ${metadata.tag}`)
