import {useRef,useState,type PointerEvent} from 'react'
import {StudyTimeline,type StudyTimelineProps} from '@motionstudies/web/components/StudyTimeline'

type Props=Omit<StudyTimelineProps,'onSeek'>&{onSeek:(time:number)=>void|Promise<void>}
/** Keep the shared chart and accessible range; own pointer dragging across browsers. */
export function FlightTimeline({onSeek,onScrubStart,onScrubEnd,...props}:Props){
 const [preview,setPreview]=useState<number>()
 const active=useRef(false),pointer=useRef<number|undefined>(undefined),request=useRef(0),pending=useRef(false)
 const begin=()=>{if(!active.current){active.current=true;onScrubStart?.()}}
 const finish=()=>{pointer.current=undefined;if(active.current){active.current=false;onScrubEnd?.()}if(!pending.current)setPreview(undefined)}
 const seek=(time:number)=>{
  const id=++request.current;pending.current=true;setPreview(time)
  void Promise.resolve(onSeek(time)).finally(()=>{if(id!==request.current)return;pending.current=false;if(!active.current)setPreview(undefined)})
 }
 const inputFor=(event:PointerEvent<HTMLDivElement>)=>event.target instanceof HTMLInputElement&&event.target.type==='range'?event.target:undefined
 const seekPointer=(event:PointerEvent<HTMLDivElement>,input:HTMLInputElement)=>{
  const box=input.getBoundingClientRect(),fraction=Math.max(0,Math.min(1,(event.clientX-box.left-22)/Math.max(1,box.width-44))),step=props.step??1
  seek(Math.min(props.windowEnd,props.windowStart+Math.round(fraction*(props.windowEnd-props.windowStart)/step)*step))
 }
 return <div className="flight-timeline" onPointerDownCapture={event=>{
  const input=inputFor(event);if(!input||props.disabled||event.button!==0||!event.isPrimary)return
  // Native range dragging and explicit pointer capture can compete in Safari.
  event.preventDefault();event.stopPropagation();input.focus({preventScroll:true});pointer.current=event.pointerId;input.setPointerCapture(event.pointerId);begin();seekPointer(event,input)
 }} onPointerMoveCapture={event=>{
  const input=inputFor(event);if(pointer.current!==event.pointerId||!input)return
  event.preventDefault();event.stopPropagation();seekPointer(event,input)
 }} onPointerUpCapture={event=>{
  if(pointer.current!==event.pointerId)return
  event.preventDefault();event.stopPropagation();finish()
 }} onPointerCancelCapture={event=>{if(pointer.current===event.pointerId)finish()}} onLostPointerCaptureCapture={event=>{if(pointer.current===event.pointerId)finish()}} onBlurCapture={finish}>
  <StudyTimeline {...props} time={preview??props.time} onSeek={seek} onScrubStart={begin} onScrubEnd={finish}/>
 </div>
}
