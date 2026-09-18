import {useEffect,useRef,useState} from 'react'
import {Soundtrack,type SoundState} from './soundtrack'

export function useSoundtrack(){
 const player=useRef<Soundtrack|null>(null)
 const [state,setState]=useState<SoundState>('off')
 useEffect(()=>{
  const hide=()=>{if(document.hidden)player.current?.stop(true)}
  const leave=()=>player.current?.stop(true)
  document.addEventListener('visibilitychange',hide);window.addEventListener('pagehide',leave)
  return()=>{document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',leave);player.current?.dispose();player.current=null}
 },[])
 const toggle=()=>{
  player.current??=new Soundtrack(setState)
  if(state==='on'||state==='loading')player.current.stop()
  else void player.current.start()
 }
 return {state,toggle}
}

export function SoundControl({state,toggle}:ReturnType<typeof useSoundtrack>){
 return <div className="sound-control">
  <button className="sound-toggle" aria-label="Sound" aria-pressed={state==='on'||state==='loading'} onClick={toggle} title={state==='on'?'Turn off ambient soundtrack':state==='loading'?'Cancel soundtrack':'Play ambient soundtrack'}>
   <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M2 6h3l4-3v10l-4-3H2z"/>{state==='on'||state==='loading'?<path d="M11 5c2 1.5 2 4.5 0 6m2-8c3 2.5 3 7.5 0 10"/>:<path d="m11 6 4 4m0-4-4 4"/>}</svg>
   <span>Sound</span>
  </button>
  {state==='loading'&&<span className="sound-note" role="status">Opening sound…</span>}
  {state==='error'&&<span className="sound-note" role="status">Sound unavailable. Tap Sound to retry.</span>}
 </div>
}
