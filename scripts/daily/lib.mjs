import {createHash} from 'node:crypto'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {dirname,join} from 'node:path'
import {spawn} from 'node:child_process'

export const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
export const json=async path=>JSON.parse(await readFile(path,'utf8'))
export async function writeJson(path,value){await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(value,null,2)+'\n')}
export function recordedDate(input,now=new Date()){
 const date=input||new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-1)).toISOString().slice(0,10)
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>=now.toISOString().slice(0,10))throw Error('Choose a completed UTC day (YYYY-MM-DD)')
 return date
}
export function releaseTag(date){return `air-${recordedDate(date)}-v1`}
export function run(command,args,options={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{stdio:'inherit',...options})
  child.on('error',reject);child.on('exit',(code,signal)=>code===0?resolve():reject(Error(`${command} failed (${signal??code})`)))
 })
}
export async function verifiedFile(root,descriptor){
 if(!descriptor||! /^[a-zA-Z0-9._-]+$/.test(descriptor.path))throw Error('Unsafe release path')
 const bytes=await readFile(join(root,descriptor.path))
 if(bytes.length!==descriptor.bytes||hash(bytes)!==descriptor.sha256)throw Error(`Integrity mismatch: ${descriptor.path}`)
 return bytes
}
export async function verifyRelease(root,expectedDate){
 const bytes=await readFile(join(root,'manifest.json')),manifest=JSON.parse(bytes)
 if(manifest.kind!=='air-day-release'||manifest.schemaVersion!==1||manifest.date!==expectedDate||manifest.timezone!=='UTC'||manifest.audit.sourceFrames!==8640||manifest.sources.length!==48||manifest.chunks.length!==144)throw Error('Incomplete or mismatched recorded day')
 if(manifest.audit.aircraft<1||manifest.audit.tracks<1)throw Error('Empty recorded day')
 for(const descriptor of manifest.files)await verifiedFile(root,descriptor)
 for(const [i,chunk] of manifest.chunks.entries()){
  if(chunk.start!==i*600||chunk.end!==(i+1)*600||!manifest.files.some(f=>f.path===chunk.path&&f.sha256===chunk.sha256&&f.bytes===chunk.bytes))throw Error('Incomplete playback coverage')
 }
 return {manifest,manifestSha256:hash(bytes)}
}
export async function download(url,path,{sha256,maxBytes=512*1024**2}={}){
 const response=await fetch(url,{signal:AbortSignal.timeout(300000)})
 if(!response.ok)throw Error(`Source unavailable (${response.status}): ${url}`)
 const parts=[];let size=0
 for await(const part of response.body){size+=part.length;if(size>maxBytes)throw Error(`Source exceeds download budget: ${url}`);parts.push(part)}
 const bytes=Buffer.concat(parts)
 if(sha256&&hash(bytes)!==sha256)throw Error(`Source hash mismatch: ${url}`)
 await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes);return bytes
}
