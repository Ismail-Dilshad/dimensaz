import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
const require=createRequire(import.meta.url);
function optional(name:string,fallback:string):string {try {const value=require(name);return typeof value==='string'?value:value.path;} catch {return fallback;}}
export const ffmpeg=process.env.FFMPEG_PATH||optional('ffmpeg-static','ffmpeg');
export const ffprobe=process.env.FFPROBE_PATH||optional('ffprobe-static','ffprobe');
export function run(exe:string,args:string[]):Promise<string>{
 return new Promise((resolve,reject)=>{const child=spawn(exe,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let out='',err='';child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
 child.stdout.on('data',c=>out+=c);child.stderr.on('data',c=>err=(err+c).slice(-20000));child.on('error',reject);
 child.on('close',code=>code===0?resolve(out):reject(new Error(exe+' failed ('+code+'): '+err)));});
}
export async function probe(file:string){return JSON.parse(await run(ffprobe,['-v','error','-show_streams','-show_format','-of','json',file]));}
export async function validateVideo(file:string,expected?:{width:number;height:number;fps:number;duration?:number;audio?:boolean}){
 const stat=await fs.stat(file);if(stat.size<128)throw new Error('Empty video');const meta=await probe(file);
 const v=meta.streams.find((s:any)=>s.codec_type==='video');if(!v||v.codec_name!=='h264'||v.pix_fmt!=='yuv420p')throw new Error('Expected H.264 yuv420p video');
 const [a,b]=v.avg_frame_rate.split('/').map(Number),fps=a/b,duration=Number(meta.format.duration);
 if(!Number.isFinite(duration)||duration<=0)throw new Error('Invalid duration');
 if(expected){if(v.width!==expected.width||v.height!==expected.height||Math.abs(fps-expected.fps)>.01)throw new Error('Video geometry/FPS mismatch');
 if(expected.duration&&Math.abs(duration-expected.duration)>Math.max(.15,2/expected.fps))throw new Error('Duration mismatch');
 if(expected.audio!==undefined&&meta.streams.some((s:any)=>s.codec_type==='audio')!==expected.audio)throw new Error('Audio preservation mismatch');}
 const counted=JSON.parse(await run(ffprobe,['-v','error','-select_streams','v:0','-count_frames','-show_entries','stream=nb_read_frames,start_time,duration','-of','json',file])).streams[0];
 const decodedFrames=Number(counted.nb_read_frames);
 if(expected?.duration!==undefined&&decodedFrames!==Math.ceil(expected.duration*expected.fps-1e-9))throw new Error('Decoded frame count mismatch');
 const timestamps=JSON.parse(await run(ffprobe,['-v','error','-select_streams','v:0','-show_frames','-show_entries','frame=best_effort_timestamp_time','-of','json',file])).frames as Array<{best_effort_timestamp_time:string}>;
 for(let i=1;i<timestamps.length;i++){const delta=Number(timestamps[i].best_effort_timestamp_time)-Number(timestamps[i-1].best_effort_timestamp_time);if(Math.abs(delta-1/fps)>.00002)throw new Error('Nonuniform or duplicate frame presentation timestamp');}
 const audioStream=meta.streams.find((s:any)=>s.codec_type==='audio');
 if(audioStream&&Math.abs(Number(audioStream.start_time||0)-Number(v.start_time||0))>1/fps+.025)throw new Error('Unexpected audio/video start offset');
 if(audioStream?.duration&&v.duration&&Math.abs(Number(audioStream.duration)-Number(v.duration))>.08)throw new Error('Audio/video duration mismatch');
 // Decode the entire stream: metadata alone cannot establish playability.
 await run(ffmpeg,['-v','error','-xerror','-i',file,'-f','null','-']);
 return {file,width:v.width,height:v.height,fps,duration,audio:meta.streams.some((s:any)=>s.codec_type==='audio'),bytes:stat.size,decodedFrames,audioStartSeconds:audioStream?Number(audioStream.start_time||0):null,videoStartSeconds:Number(v.start_time||0)};
}

