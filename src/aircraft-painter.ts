import type {AirTrack,AirPosition} from '@motionstudies/core/domain/air'
export type AircraftProjection={xScale:number;yScale:number;xOffset:number;yOffset:number}
export type AircraftStats={calls:number;triangles:number;points:number;geometryBuilds:number;geometryBytes:number;geometryPreparedBytes:number;stateUploadBytes:number}
/** Retained aircraft backend. Shared CPU sampling still owns validity, counts and picking. */
export interface AircraftPainter {
 begin(width:number,height:number,dpr:number,projection:AircraftProjection,time:number):void
 prepare(tracks:AirTrack[],airport?:string|readonly string[],selected?:string,matchingIds?:ReadonlySet<string>):void
 aircraft(index:number,position:AirPosition|undefined,visible:boolean,opacity?:number):void
 end():void
 clear():void
 dispose():void
 stats():AircraftStats
}
