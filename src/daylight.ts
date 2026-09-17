const radians=Math.PI/180

/** Approximate geometric sun position, using NOAA's fractional-year equations.
 * https://gml.noaa.gov/grad/solcalc/solareqns.PDF
 * UTC throughout; this is ambient map context, not a sunrise forecast.
 */
export function solarPosition(date:string,seconds:number){
 const midnight=Date.parse(`${date}T00:00:00Z`),day=new Date(midnight+seconds*1000)
 const year=day.getUTCFullYear(),yearStart=Date.UTC(year,0,1)
 const days=(Date.UTC(year+1,0,1)-yearStart)/86400000
 const gamma=2*Math.PI/days*((day.getTime()-yearStart)/86400000-.5)
 const equation=229.18*(.000075+.001868*Math.cos(gamma)-.032077*Math.sin(gamma)-.014615*Math.cos(2*gamma)-.040849*Math.sin(2*gamma))
 const declination=.006918-.399912*Math.cos(gamma)+.070257*Math.sin(gamma)-.006758*Math.cos(2*gamma)+.000907*Math.sin(2*gamma)-.002697*Math.cos(3*gamma)+.00148*Math.sin(3*gamma)
 const minutes=day.getUTCHours()*60+day.getUTCMinutes()+day.getUTCSeconds()/60
 return {declination,longitude:180-(minutes+equation)/4}
}
export function solarElevation(latitude:number,longitude:number,sun:ReturnType<typeof solarPosition>){
 const lat=latitude*radians,hour=(longitude-sun.longitude)*radians
 return Math.asin(Math.max(-1,Math.min(1,Math.sin(lat)*Math.sin(sun.declination)+Math.cos(lat)*Math.cos(sun.declination)*Math.cos(hour))))/radians
}

/** Small cached raster sits below aircraft, keeping their semantic colours intact. */
export class DaylightLayer {
 private readonly canvas=document.createElement('canvas')
 private key=''
 constructor(private readonly date:string){}
 draw(ctx:CanvasRenderingContext2D,width:number,height:number,projection:{west:number;north:number;left:number;top:number;scale:number},time:number){
  const minute=Math.floor(time/60),key=[width,height,...Object.values(projection),minute].join(':')
  if(key!==this.key){
   this.key=key
   const w=160,h=Math.max(1,Math.round(w*height/width))
   this.canvas.width=w;this.canvas.height=h
   const raster=this.canvas.getContext('2d')!,image=raster.createImageData(w,h),sun=solarPosition(this.date,minute*60)
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const longitude=projection.west+((x+.5)/w*width-projection.left)/(.62*projection.scale)
    const latitude=projection.north-((y+.5)/h*height-projection.top)/projection.scale
    if(latitude < -90||latitude > 90)continue
    const elevation=solarElevation(latitude,longitude,sun)
    const night=Math.max(0,Math.min(1,(3-elevation)/12)),smooth=night*night*(3-2*night)
    const dusk=Math.exp(-Math.pow(elevation/5,2)),i=(y*w+x)*4
    const nightAlpha=.48*smooth,duskAlpha=.065*dusk*(1-nightAlpha),alpha=nightAlpha+duskAlpha
    if(alpha>0){
     image.data[i]=Math.round((5*nightAlpha+190*duskAlpha)/alpha)
     image.data[i+1]=Math.round((12*nightAlpha+146*duskAlpha)/alpha)
     image.data[i+2]=Math.round((27*nightAlpha+84*duskAlpha)/alpha)
     image.data[i+3]=Math.round(255*alpha)
    }
   }
   raster.putImageData(image,0,0)
  }
  ctx.drawImage(this.canvas,0,0,width,height)
 }
 dispose(){this.canvas.width=0;this.canvas.height=0}
}
