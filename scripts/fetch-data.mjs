import {readFile,writeFile,mkdir,rm,rename,stat} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {resolve,join} from 'node:path'
import {digestHex} from '@motionstudies/data/release'
import {openAirRelease} from './daily/lib.mjs'
const lock=JSON.parse(await readFile(new URL('../data-release.json',import.meta.url)))
const output=resolve('public/data'),stage=resolve('public/data.partial')
// Shared verifier: pinned manifest digest, kind and schema, then every described file by size and SHA-256.
async function verify(root){
 const release=await openAirRelease(root,lock.manifestSha256)
 if(release.manifest.date!==lock.date||!Array.isArray(release.manifest.files))throw new Error('Unexpected release')
 for(const f of release.descriptors)await release.read(f)
}
if(await stat(output).then(()=>true,()=>false)){await verify(output);console.log('Pinned recorder data verified');process.exit(0)}
await rm(stage,{recursive:true,force:true});await mkdir(stage,{recursive:true})
try{
 const response=await fetch(lock.url,{signal:AbortSignal.timeout(300000)})
 if(!response.ok)throw new Error(`Release download: ${response.status}`)
 const bytes=Buffer.from(await response.arrayBuffer())
 if(bytes.length!==lock.bytes||await digestHex(bytes)!==lock.sha256)throw new Error('Release archive integrity mismatch')
 const archive=join(stage,'release.tar.gz');await writeFile(archive,bytes)
 const entries=execFileSync('tar',['-tzf',archive],{encoding:'utf8'}).trim().split('\n')
 if(entries.some(p=>!/^\.\/[a-zA-Z0-9._-]+$/.test(p)&&p!=='./'))throw new Error('Unexpected archive paths')
 execFileSync('tar',['-xzf',archive,'-C',stage]);await rm(archive);await verify(stage);await rename(stage,output)
 console.log(`Verified ${lock.date} recorder release`)
}catch(error){await rm(stage,{recursive:true,force:true});throw error}
