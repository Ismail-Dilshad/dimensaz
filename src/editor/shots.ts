// Where the picture cuts: the shots of a video, from FFmpeg's scene score (no extra tools). Used
// for the scenes of a video on the Studio page and for the shots of the user's own footage.
import {ffmpeg,probe,run} from '../renderer/ffmpeg-encoder.js';

export type Shot={n:number;start:number;end:number};
/** The shots of a video: a cut where the picture changes a lot, no shot shorter than `min` seconds. */
export async function findShots(file:string,o:{threshold?:number;min?:number}={}):Promise<{duration:number;shots:Shot[]}>{
 const info=await probe(file),duration=Number(info.format?.duration)||0,min=o.min??.5;
 const txt=await run(ffmpeg,['-v','error','-i',file,'-an','-vf',`select='gt(scene,${o.threshold??.3})',metadata=mode=print:file=-`,'-f','null','-']).catch(()=>'');
 const cuts=[...txt.matchAll(/pts_time:([\d.]+)/g)].map(x=>Number(x[1])).filter(x=>x>=min&&x<=duration-min);
 const marks=[0];for(const c of cuts)if(c-marks.at(-1)!>=min)marks.push(c);marks.push(duration);
 return {duration,shots:marks.slice(0,-1).map((s,i)=>({n:i+1,start:+s.toFixed(2),end:+marks[i+1]!.toFixed(2)}))};
}
