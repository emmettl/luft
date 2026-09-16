/** Aircraft-only backend. Projection, observed positions, gaps and picking stay in AirMap. */
export interface AircraftPainter {
 begin(width:number,height:number,dpr:number):void
 style(layer:number,colour:string,opacity:number,width:number,radius:number):void
 segment(x1:number,y1:number,x2:number,y2:number):void
 point(x:number,y:number):void
 end():void
 clear():void
 dispose():void
 stats():{calls:number;triangles:number;points:number}
}
