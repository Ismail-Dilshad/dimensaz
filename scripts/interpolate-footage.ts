import {parseArgs} from 'node:util';import path from 'node:path';import fs from 'node:fs/promises';import {ffmpeg,run,probe,validateVideo} from '../renderer/ffmpeg-encoder.js';
const {values:v}=parseArgs({options:{input:{type:'string'},output:{type:'string'},fps:{type:'string',default:'60'}}});
if(!v.input||!v.output)throw new Error('--input and a NEW --output file required');
const input=path.resolve(v.input),output=path.resolve(v.output),fps=Number(v.fps);
if(input===output||![24,30,60,120].includes(fps))throw new Error('Use separate output and 24/30/60/120 FPS');
try{await fs.access(output);throw new Error('Output exists; originals and exports are never overwritten');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
const meta=await probe(input),video=meta.streams.find((s:{codec_type:string})=>s.codec_type==='video');if(!video)throw new Error('Input has no video');
const duration=Number(video.duration||meta.format.duration),rounded=Math.ceil(duration*fps-1e-9)/fps;
await run(ffmpeg,['-v','error','-n','-i',input,'-vf',`tpad=stop_mode=clone:stop_duration=0.2,minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,trim=duration=${rounded},setpts=PTS-STARTPTS`,'-map','0:v:0','-map','0:a?','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-af','apad','-t',String(rounded),'-movflags','+faststart',output]);
console.log(JSON.stringify(await validateVideo(output,{width:video.width,height:video.height,fps,duration:rounded,audio:meta.streams.some((s:{codec_type:string})=>s.codec_type==='audio')}),null,2));
console.error('Opt-in footage interpolation only. Inspect edges, cuts and any text for artifacts. Native animation exports never use interpolation.');
