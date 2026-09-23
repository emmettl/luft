import {momentTime} from './moments'
export async function exportScene(image:HTMLCanvasElement,{date,time,selection,flight,comparison,mode}:{date:string;time:number;selection:string;flight?:string;comparison?:readonly string[];mode:string}){
 const scale=Math.min(2,2400/Math.max(image.width,image.height)),width=Math.round(image.width*scale),height=Math.round(image.height*scale)
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
 const ctx=canvas.getContext('2d')!;ctx.fillStyle='#090f19';ctx.fillRect(0,0,width,height);ctx.drawImage(image,0,0,width,height)
 const unit=Math.max(1,width/1200),pad=28*unit,header=110*unit,footer=126*unit
 const shade=(y:number,h:number)=>{ctx.fillStyle='#090f19ed';ctx.fillRect(0,y,width,h)}
 shade(0,header);shade(height-footer,footer)
 ctx.fillStyle='#d9c698';ctx.font=`${10*unit}px monospace`;ctx.fillText('MOTION STUDIES / RECORDED OBSERVATIONS',pad,pad)
 ctx.fillStyle='#eef0ed';ctx.font=`${40*unit}px sans-serif`;ctx.fillText('L U F T',pad,pad+49*unit)
 ctx.font=`${12*unit}px monospace`;ctx.textAlign='right';ctx.fillText(`${date} · ${momentTime(time)} UTC`,width-pad,pad+30*unit);ctx.textAlign='left'
 const ellipsis=(text:string,max:number)=>{let result=text;while(result.length&&ctx.measureText(result).width>max)result=result.slice(0,-1);return result===text?text:result.slice(0,-1)+'…'}
 ctx.fillStyle='#eed9b3';ctx.font=`${14*unit}px sans-serif`;ctx.fillText(ellipsis(flight||selection||'Flights over Europe',width-pad*2),pad,height-footer+30*unit)
 ctx.fillStyle='#acbec9';ctx.font=`${10*unit}px monospace`;ctx.fillText(mode==='density'?'Hourly density · five-minute snapshots':'Recorded aircraft · three-minute trails',pad,height-footer+53*unit)
 if(comparison){comparison.forEach((name,i)=>{ctx.fillStyle=i?'#efbd72':'#81d9f1';ctx.fillText(ellipsis(name,(width-pad*2)/2-12*unit),pad+i*(width-pad*2)/2,height-footer+74*unit)})}
 ctx.fillStyle='#92a6b5';ctx.font=`${9*unit}px monospace`;ctx.fillText('ADSB.lol contributors · ODbL 1.0 / OurAirports / Natural Earth',pad,height-25*unit)
 ctx.fillText('motionstudies.app/luft',pad,height-10*unit)
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Image export unavailable')),'image/png'))
 const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`luft-${date}-${momentTime(time).replace(':','')}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000)
}
