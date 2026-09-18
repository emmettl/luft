import {useCallback,useEffect,useRef,useState,type RefObject} from 'react'

/** Fullscreen is optional: the same unobstructed view works when it is unavailable. */
export function useWatchMode(surface:RefObject<HTMLElement|null>,onEnter:()=>void,onExit:()=>void){
 const [active,setActive]=useState(false),[awake,setAwake]=useState(true)
 const activeRef=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined)
 const callbacks=useRef({onEnter,onExit});callbacks.current={onEnter,onExit}
 const restoreFocus=useRef<HTMLElement|null>(null),ownedFullscreen=useRef(false)
 const reveal=useCallback(()=>{
  if(!activeRef.current)return
  setAwake(true);clearTimeout(timer.current)
  timer.current=setTimeout(()=>setAwake(false),3500)
 },[])
 const exit=useCallback(()=>{
  if(!activeRef.current)return
  activeRef.current=false;setActive(false);clearTimeout(timer.current)
  callbacks.current.onExit()
  if(ownedFullscreen.current&&document.fullscreenElement===surface.current)void document.exitFullscreen().catch(()=>{})
  ownedFullscreen.current=false
  requestAnimationFrame(()=>restoreFocus.current?.focus({preventScroll:true}))
 },[surface])
 const enter=useCallback((trigger?:HTMLElement)=>{
  if(activeRef.current||!surface.current)return
  restoreFocus.current=trigger??(document.activeElement instanceof HTMLElement?document.activeElement:null)
  activeRef.current=true;setActive(true);callbacks.current.onEnter();reveal()
  surface.current.focus({preventScroll:true})
  // Request synchronously inside the click gesture; unsupported/denied requests retain watch mode.
  if(!document.fullscreenElement&&surface.current.requestFullscreen){
   void surface.current.requestFullscreen().then(()=>{
    if(!activeRef.current){if(document.fullscreenElement===surface.current)void document.exitFullscreen().catch(()=>{});return}
    ownedFullscreen.current=true
   }).catch(()=>{})
  }
 },[surface,reveal])
 useEffect(()=>{
  const changed=()=>{
   if(document.fullscreenElement===surface.current)ownedFullscreen.current=true
   else if(ownedFullscreen.current)exit()
  }
  const key=(event:KeyboardEvent)=>{
   if(!activeRef.current)return
   if(event.key==='Escape'){event.preventDefault();exit()}
   else if(event.key==='Tab')reveal()
  }
  document.addEventListener('fullscreenchange',changed);document.addEventListener('keydown',key)
  return()=>{clearTimeout(timer.current);document.removeEventListener('fullscreenchange',changed);document.removeEventListener('keydown',key)}
 },[surface,exit,reveal])
 return {active,awake,enter,exit,reveal}
}
