import {expect,it} from 'vitest'
import {mkdtemp,writeFile,rm,mkdir,symlink} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {recordedDate,verifyRelease,verifiedFile,openAirRelease,hash} from './daily/lib.mjs'
it('selects the previous UTC day across calendar boundaries and rejects incomplete days',()=>{
 expect(recordedDate('',new Date('2026-01-01T00:01:00Z'))).toBe('2025-12-31')
 expect(recordedDate('',new Date('2024-03-01T23:59:00Z'))).toBe('2024-02-29')
 for(const date of ['2026-09-17','2026-09-18','2026-02-30','../2026-09-16','bad'])expect(()=>recordedDate(date,new Date('2026-09-17T07:00:00Z'))).toThrow()
})
it('rejects incomplete days, changed payloads and unsafe paths before adoption',async()=>{
 const root=await mkdtemp(join(tmpdir(),'luft-verify-'))
 try{
  const bytes=Buffer.from('{}'),files=[{path:'chunk.json',bytes:bytes.length,sha256:hash(bytes)}]
  const manifest={kind:'air-day-release',schemaVersion:1,date:'2026-09-16',timezone:'UTC',audit:{sourceFrames:8640,aircraft:1,tracks:1},sources:Array.from({length:48},()=>({})),files,chunks:Array.from({length:144},(_,i)=>({...files[0],start:i*600,end:(i+1)*600}))}
  const write=()=>writeFile(join(root,'manifest.json'),JSON.stringify(manifest))
  await writeFile(join(root,'chunk.json'),bytes);await write()
  await expect(verifyRelease(root,'2026-09-16')).resolves.toHaveProperty('manifest.date','2026-09-16')
  await expect(verifyRelease(root,'2026-09-15')).rejects.toThrow('mismatched')
  manifest.audit.sourceFrames--;await write();await expect(verifyRelease(root,'2026-09-16')).rejects.toThrow('Incomplete')
  manifest.audit.sourceFrames++;manifest.chunks[143].end--;await write();await expect(verifyRelease(root,'2026-09-16')).rejects.toThrow('coverage')
  manifest.chunks[143].end++;await write();await writeFile(join(root,'chunk.json'),'bad');await expect(verifyRelease(root,'2026-09-16')).rejects.toThrow('Integrity')
  files[0].path='../outside';await write();await expect(verifyRelease(root,'2026-09-16')).rejects.toThrow('Unsafe')
  // LUFT keeps flat release paths, stricter than the shared verifier's nested paths.
  await mkdir(join(root,'nested'));await writeFile(join(root,'nested','chunk.json'),bytes);files[0].path='nested/chunk.json'
  for(const chunk of manifest.chunks)chunk.path='nested/chunk.json'
  await write();await expect(verifyRelease(root,'2026-09-16')).rejects.toThrow('Unsafe')
  // Every descriptor for one path must describe the same bytes.
  files[0].path='chunk.json';for(const chunk of manifest.chunks)chunk.path='chunk.json'
  await writeFile(join(root,'chunk.json'),bytes);manifest.chunks[5].bytes++;await write()
  await expect(verifyRelease(root,'2026-09-16')).rejects.toThrow('Conflicting')
 }finally{await rm(root,{recursive:true,force:true})}
})
it('reads pinned, described files only and refuses links out of the release',async()=>{
 const base=await mkdtemp(join(tmpdir(),'luft-links-')),root=join(base,'release')
 try{
  await mkdir(root);const secret=Buffer.from('outside'),inside=Buffer.from('{}')
  await writeFile(join(base,'secret.json'),secret);await symlink(join(base,'secret.json'),join(root,'link.json'))
  await expect(verifiedFile(root,{path:'link.json',bytes:secret.length,sha256:hash(secret)})).rejects.toThrow('Integrity mismatch')
  await writeFile(join(root,'index.json'),inside)
  const manifest=Buffer.from(JSON.stringify({kind:'air-day-release',schemaVersion:1,index:{path:'index.json',bytes:inside.length,sha256:hash(inside)}}))
  await writeFile(join(root,'manifest.json'),manifest)
  await expect(openAirRelease(root,hash(Buffer.from('other')))).rejects.toThrow('pinned digest')
  const release=await openAirRelease(root,hash(manifest))
  await expect(release.read(release.manifest.index)).resolves.toEqual(inside)
  await expect(release.read({path:'link.json',bytes:secret.length,sha256:hash(secret)})).rejects.toThrow('not described')
  await expect(release.read(undefined,'Invalid geography source')).rejects.toThrow('Invalid geography source')
 }finally{await rm(base,{recursive:true,force:true})}
})
