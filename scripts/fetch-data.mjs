import {readFile,writeFile,mkdir,rm,rename,stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {resolve,join} from 'node:path'
const hash=b=>createHash('sha256').update(b).digest('hex')
const lock=JSON.parse(await readFile(new URL('../data-release.json',import.meta.url)))
const output=resolve('public/data'),stage=resolve('public/data.partial')
async function verify(root){
 const bytes=await readFile(join(root,'manifest.json'))
 if(hash(bytes)!==lock.manifestSha256)throw new Error('Manifest hash differs from pinned release')
 const manifest=JSON.parse(bytes)
 if(manifest.kind!=='air-day-release'||manifest.date!==lock.date)throw new Error('Unexpected release')
 for(const f of manifest.files){if(!/^[a-zA-Z0-9._-]+$/.test(f.path))throw new Error('Unsafe release path');const bytes=await readFile(join(root,f.path));if(bytes.length!==f.bytes||hash(bytes)!==f.sha256)throw new Error(`Invalid ${f.path}`)}
}
if(await stat(output).then(()=>true,()=>false)){await verify(output);console.log('Pinned recorder data verified');process.exit(0)}
await rm(stage,{recursive:true,force:true});await mkdir(stage,{recursive:true})
try{
 const response=await fetch(lock.url,{signal:AbortSignal.timeout(300000)})
 if(!response.ok)throw new Error(`Release download: ${response.status}`)
 const bytes=Buffer.from(await response.arrayBuffer())
 if(bytes.length!==lock.bytes||hash(bytes)!==lock.sha256)throw new Error('Release archive integrity mismatch')
 const archive=join(stage,'release.tar.gz');await writeFile(archive,bytes)
 const entries=execFileSync('tar',['-tzf',archive],{encoding:'utf8'}).trim().split('\n')
 if(entries.some(p=>!/^\.\/[a-zA-Z0-9._-]+$/.test(p)&&p!=='./'))throw new Error('Unexpected archive paths')
 execFileSync('tar',['-xzf',archive,'-C',stage]);await rm(archive);await verify(stage);await rename(stage,output)
 console.log(`Verified ${lock.date} recorder release`)
}catch(error){await rm(stage,{recursive:true,force:true});throw error}
