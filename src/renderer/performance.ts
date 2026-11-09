import os from 'node:os';
import {ffmpeg,run} from './ffmpeg-encoder.js';
import type {Config} from '../engine/schema.js';
export function captureWorkers(requested:number|undefined=1){
 const cpu=os.availableParallelism?.()??os.cpus().length;
 const budget=Math.min(4,Math.max(1,Math.floor(cpu/3)),Math.max(1,Math.floor((os.freemem()-2*1024**3)/(1.5*1024**3))));
 return Math.min(requested||1,budget);
}
/** Pages that render preview frames together: one per spare CPU (up to 4), within free memory;
 *  DIMENSAZ_PREVIEW_WORKERS overrides. A short preview does not open more pages than it needs. */
export function previewWorkers(frames:number){
 const env=Number(process.env.DIMENSAZ_PREVIEW_WORKERS);if(Number.isInteger(env)&&env>=1)return Math.min(env,8,Math.max(1,frames));
 const cpu=os.availableParallelism?.()??os.cpus().length,mem=Math.max(1,Math.floor((os.freemem()-1024**3)/(.6*1024**3)));
 return Math.max(1,Math.min(4,cpu-1||1,mem,Math.ceil(frames/4)));
}
let encoderProbe:Promise<boolean>|undefined;
export async function encoderConfig(c:Config){
 // Auto remains software until an end-to-end benchmark justifies hardware encoding.
 if(c.codec!=='h264_nvenc')return {codec:'libx264',args:['-c:v','libx264','-preset',c.preset,'-crf',String(c.crf)],fallback:null};
 encoderProbe??=run(ffmpeg,['-v','error','-f','lavfi','-i','color=size=128x128:rate=30','-frames:v','2','-c:v','h264_nvenc','-f','null','-']).then(()=>true,()=>false);
 if(await encoderProbe)return {codec:'h264_nvenc',args:['-c:v','h264_nvenc','-preset','p5','-rc','vbr','-cq',String(c.crf),'-b:v','0'],fallback:null};
 return {codec:'libx264',args:['-c:v','libx264','-preset',c.preset,'-crf',String(c.crf)],fallback:'NVENC runtime probe failed; using libx264'};
}
export const renderProfiles={draft:{width:540,height:960,fps:30,preset:'ultrafast',crf:23,captureConcurrency:2},preview:{width:720,height:1280,fps:30,preset:'fast',crf:20,captureConcurrency:2},final:{width:1080,height:1920,fps:60,preset:'medium',crf:18,captureConcurrency:2}} as const;
export function frameCount(duration:number,fps:number){return Math.ceil(duration*fps-1e-9);}
