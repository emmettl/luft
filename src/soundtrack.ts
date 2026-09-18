const LOOP_SECONDS=64
const SAMPLE_RATE=22050
const LEVEL=.4
const FADE_SECONDS=1.2
export type SoundState='off'|'loading'|'on'|'error'

/** An original, unhurried D-major study. Render once, then loop off the UI thread. */
export async function renderSoundtrack():Promise<AudioBuffer>{
 // Render two repetitions and retain the second, including tails from the first.
 // Every voice has ended within one repetition, so the join has identical history.
 const context=new OfflineAudioContext(2,LOOP_SECONDS*2*SAMPLE_RATE,SAMPLE_RATE)
 const chords=[[50,57,61,64,69],[47,54,57,62,64],[43,54,57,62,66],[45,52,57,59,64]]
 const envelope=Float32Array.from({length:129},(_,i)=>Math.sin(Math.PI*i/128)**2)
 const tone=(midi:number,start:number,duration:number,level:number,pan:number,bell=false)=>{
  const gain=context.createGain(),stereo=context.createStereoPanner()
  stereo.pan.value=pan;gain.connect(stereo);stereo.connect(context.destination)
  if(bell){
   gain.gain.setValueAtTime(0,start)
   gain.gain.linearRampToValueAtTime(level,start+.06)
   gain.gain.exponentialRampToValueAtTime(.00001,start+duration-.2)
   gain.gain.linearRampToValueAtTime(0,start+duration)
  }else gain.gain.setValueCurveAtTime(envelope.map(value=>value*level),start,duration)
  for(const [ratio,weight] of (bell?[[1,.8],[2,.15],[3,.05]]:[[.999,.45],[1.001,.45],[2,.1]])){
   const oscillator=context.createOscillator(),partial=context.createGain()
   oscillator.frequency.value=440*2**((midi-69)/12)*ratio
   partial.gain.value=weight;oscillator.connect(partial);partial.connect(gain)
   oscillator.start(start);oscillator.stop(start+duration)
  }
 }
 for(let cycle=0;cycle<2;cycle++)chords.forEach((chord,index)=>{
  const start=cycle*LOOP_SECONDS+index*16
  chord.forEach((note,voice)=>tone(note,start,32,.065,(voice-2)*.3))
  // Sparse, softly struck upper notes with a quieter echo across the stereo field.
  const notes=[chord[3]+12,chord[2]+12]
  notes.forEach((note,i)=>{
   const at=start+5+i*7,pan=i===0?-.35:.35
   tone(note,at,9,.032,pan,true);tone(note,at+.8,9,.009,-pan,true)
  })
 })
 const rendered=await context.startRendering()
 const loop=new AudioBuffer({numberOfChannels:2,length:LOOP_SECONDS*SAMPLE_RATE,sampleRate:SAMPLE_RATE})
 for(let channel=0;channel<2;channel++)loop.copyToChannel(rendered.getChannelData(channel).subarray(loop.length),channel)
 return loop
}

/** Owns a single audio graph; no context or score exists until a user asks for sound. */
export class Soundtrack{
 private context?:AudioContext
 private gain?:GainNode
 private source?:AudioBufferSourceNode
 private rendering?:Promise<AudioBuffer>
 private timer?:ReturnType<typeof setTimeout>
 private generation=0
 private state:SoundState='off'
 constructor(private changed:(state:SoundState)=>void){}
 private publish(state:SoundState){this.state=state;this.changed(state)}
 async start(){
  const generation=++this.generation
  clearTimeout(this.timer);this.publish('loading')
  try{
   if(!this.context){
    const context=new AudioContext();this.context=context
    this.gain=context.createGain();this.gain.gain.value=0;this.gain.connect(context.destination)
    context.onstatechange=()=>{
     // Device interruptions must not leave a misleading active Sound button.
     if(this.state==='on'&&context.state!=='running')this.stop(true)
    }
   }
   const context=this.context
   // Resume inside the click gesture, before awaiting the offline composition.
   const resumed=context.resume()
   this.rendering??=renderSoundtrack().catch(error=>{this.rendering=undefined;throw error})
   const [,buffer]=await Promise.all([resumed,this.rendering])
   if(generation!==this.generation)return
   if(context.state!=='running')throw new Error('Audio unavailable')
   if(!this.source){
    this.source=context.createBufferSource();this.source.buffer=buffer;this.source.loop=true
    this.source.connect(this.gain!);this.source.start()
   }
   const gain=this.gain!.gain,now=context.currentTime
   gain.cancelAndHoldAtTime(now);gain.linearRampToValueAtTime(LEVEL,now+FADE_SECONDS)
   this.publish('on')
  }catch{
   if(generation!==this.generation)return
   this.stop(true);this.publish('error')
  }
 }
 stop(immediate=false){
  ++this.generation;clearTimeout(this.timer);this.publish('off')
  const context=this.context,gain=this.gain?.gain
  if(!context||!gain||context.state==='closed')return
  const now=context.currentTime
  gain.cancelAndHoldAtTime(now)
  if(immediate){gain.setValueAtTime(0,now);void context.suspend().catch(()=>{})}
  else{
   gain.linearRampToValueAtTime(0,now+FADE_SECONDS)
   this.timer=setTimeout(()=>{void context.suspend().catch(()=>{})},(FADE_SECONDS+.1)*1000)
  }
 }
 dispose(){
  ++this.generation;clearTimeout(this.timer)
  if(this.context){this.context.onstatechange=null;void this.context.close().catch(()=>{})}
  this.source?.disconnect();this.gain?.disconnect();this.rendering=undefined
 }
}
