import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {json,download} from './lib.mjs'
const lock=await json('data-release.json'),directory=await mkdtemp(join(tmpdir(),'luft-public-'))
try{await download(lock.url,join(directory,'release.tar.gz'),{sha256:lock.sha256,maxBytes:lock.bytes});console.log(`Public archive verified: ${lock.date}`)}
finally{await rm(directory,{recursive:true,force:true})}
