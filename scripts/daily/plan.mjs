import {appendFile} from 'node:fs/promises'
import {json,recordedDate} from './lib.mjs'
const config=await json('daily-feed.json'),current=await json('data-release.json'),date=recordedDate(process.env.FEED_DATE)
if(date<current.date)throw Error('Daily refresh cannot roll the site back to an older day')
if(!/^[a-f0-9]{40}$/.test(config.recorderCommit))throw Error('Recorder must be pinned to a full commit')
const result={date,changed:String(date>current.date),recorder:config.recorderCommit}
if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,Object.entries(result).map(([k,v])=>`${k}=${v}\n`).join(''))
console.log(JSON.stringify(result))
