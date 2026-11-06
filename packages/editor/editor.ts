// Applies an edit decision list to footage with FFmpeg. Each operation re-encodes into a
// private work folder at high quality; the final export uses the chosen preset. The
// input is never modified and an existing output is never overwritten.
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {ROOT} from '../../engine/config.js';
import {ffmpeg,probe,run} from '../../renderer/ffmpeg-encoder.js';
import {edlSchema,exportPresets,aspectSizes,type Edl,type Operation} from './edl.js';
import {parseSrt} from './srt.js';
import {renderCaptionImages} from './captions.js';

export type MediaInfo={width:number;height:number;fps:number;duration:number;hasAudio:boolean};
type Step={op:Operation['op'];output:string;info:MediaInfo;note?:string};

export async function mediaInfo(file:string):Promise<MediaInfo>{
 const p=await probe(file);const v=p.streams.find((s:{codec_type:string})=>s.codec_type==='video');
 if(!v)throw new Error('No video stream in '+file);
 const [a,b]=String(v.avg_frame_rate&&v.avg_frame_rate!=='0/0'?v.avg_frame_rate:v.r_frame_rate).split('/').map(Number);
 return {width:v.width,height:v.height,fps:Math.round((b?a/b:a)*1000)/1000||30,duration:Number(p.format.duration??v.duration),hasAudio:p.streams.some((s:{codec_type:string})=>s.codec_type==='audio')};
}

const even=(n:number)=>Math.max(2,Math.round(n/2)*2);
const n=(x:number)=>Number(x.toFixed(4)).toString();
const intermediate=(audio:boolean,fps:number)=>['-r',n(fps),'-c:v','libx264','-preset','veryfast','-crf','14','-pix_fmt','yuv420p',...(audio?['-c:a','aac','-b:a','256k','-ar','48000']:['-an'])];
const keepRanges=(duration:number,remove:{start:number;end:number}[])=>{
 const out:{start:number;end:number}[]=[];let at=0;
 for(const r of [...remove].sort((a,b)=>a.start-b.start)){if(r.start>at)out.push({start:at,end:Math.min(r.start,duration)});at=Math.max(at,r.end);}
 if(at<duration)out.push({start:at,end:duration});
 return out.filter(r=>r.end-r.start>.001);
};
function segmentGraph(ranges:{start:number;end:number}[],audio:boolean){
 const parts=ranges.map((r,i)=>`[0:v]trim=start=${n(r.start)}:end=${n(r.end)},setpts=PTS-STARTPTS[v${i}]`+(audio?`;[0:a]atrim=start=${n(r.start)}:end=${n(r.end)},asetpts=PTS-STARTPTS[a${i}]`:''));
 const inputs=ranges.map((_,i)=>`[v${i}]`+(audio?`[a${i}]`:'')).join('');
 return parts.join(';')+`;${inputs}concat=n=${ranges.length}:v=1:a=${audio?1:0}[v]`+(audio?'[a]':'');
}
const atempo=(f:number)=>{const s:string[]=[];while(f>2){s.push('atempo=2');f/=2;}while(f<.5){s.push('atempo=0.5');f/=.5;}s.push('atempo='+n(f));return s.join(',');};

async function ff(args:string[]){await run(ffmpeg,['-hide_banner','-loglevel','error','-y',...args]);}

async function applyOperation(op:Operation,input:string,info:MediaInfo,out:string,base:string,work:string):Promise<{info:MediaInfo;note?:string}>{
 const a=info.hasAudio,vf=(f:string,af?:string)=>ff(['-i',input,'-vf',f,...(af&&a?['-af',af]:[]),...intermediate(a,info.fps),out]);
 switch(op.op){
  case 'trim':{
   const end=Math.min(op.end??info.duration,info.duration);if(end<=op.start)throw new Error('trim: end must be after start and inside the clip');
   await ff(['-ss',n(op.start),'-i',input,'-t',n(end-op.start),...intermediate(a,info.fps),out]);break;}
  case 'cut':{
   const ranges=keepRanges(info.duration,op.ranges);if(!ranges.length)throw new Error('cut would remove the whole clip');
   await ff(['-i',input,'-filter_complex',segmentGraph(ranges,a),'-map','[v]',...(a?['-map','[a]']:[]),...intermediate(a,info.fps),out]);break;}
  case 'split':{
   const points=[0,...[...new Set(op.at)].filter(t=>t>0&&t<info.duration).sort((x,y)=>x-y),info.duration];
   const segments=points.slice(1).map((end,i)=>({start:points[i],end}));
   const order=op.keep??segments.map((_,i)=>i);
   for(const i of order)if(!segments[i])throw new Error(`split: segment ${i} does not exist (there are ${segments.length})`);
   await ff(['-i',input,'-filter_complex',segmentGraph(order.map(i=>segments[i]),a),'-map','[v]',...(a?['-map','[a]']:[]),...intermediate(a,info.fps),out]);break;}
  case 'concat':{
   const others=op.files.map(f=>path.resolve(base,f));
   const files=op.position==='after'?[input,...others]:[...others,input];
   const infos=await Promise.all(files.map(mediaInfo));
   const {width:w,height:h,fps}=info;
   const graph=infos.map((m,i)=>`[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${n(fps)},format=yuv420p[v${i}];`+
    (m.hasAudio?`[${i}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}];`:`aevalsrc=0:c=stereo:s=48000:d=${n(m.duration)}[a${i}];`)).join('')+
    infos.map((_,i)=>`[v${i}][a${i}]`).join('')+`concat=n=${infos.length}:v=1:a=1[v][a]`;
   await ff([...files.flatMap(f=>['-i',f]),'-filter_complex',graph,'-map','[v]','-map','[a]',...intermediate(true,info.fps),out]);
   return {info:{...info,hasAudio:true,duration:infos.reduce((s,m)=>s+m.duration,0)}};}
  case 'crop':{
   const px=(v:number,of:number)=>v<=1?v*of:v;
   const w=even(Math.min(px(op.width,info.width),info.width)),h=even(Math.min(px(op.height,info.height),info.height));
   const x=Math.round(Math.min(px(op.x,info.width),info.width-w)),y=Math.round(Math.min(px(op.y,info.height),info.height-h));
   await vf(`crop=${w}:${h}:${x}:${y},setsar=1`);return {info:{...info,width:w,height:h}};}
  case 'reframe':{
   const [aw,ah]=op.aspect.split(':').map(Number),target=aw/ah;
   let cw=info.width,ch=info.height;if(info.width/info.height>target)cw=even(info.height*target);else ch=even(info.width/target);
   const x=Math.round(Math.max(0,Math.min(info.width-cw,op.focusX*info.width-cw/2))),y=Math.round(Math.max(0,Math.min(info.height-ch,op.focusY*info.height-ch/2)));
   const [dw,dh]=op.width&&op.height?[even(op.width),even(op.height)]:aspectSizes[op.aspect];
   await vf(`crop=${cw}:${ch}:${x}:${y},scale=${dw}:${dh}:flags=lanczos,setsar=1`);return {info:{...info,width:dw,height:dh},note:`${op.aspect} around (${op.focusX}, ${op.focusY})`};}
  case 'zoom':{
   const s=Math.min(op.start,info.duration),e=Math.min(op.end??info.duration,info.duration);if(e<=s)throw new Error('zoom: end must be after start');
   const r=Math.min(op.ramp,(e-s)/2),Z=n(op.scale),t='it';
   const z=r>0?`if(lt(${t},${n(s)}),1,if(lt(${t},${n(s+r)}),1+(${Z}-1)*(${t}-${n(s)})/${n(r)},if(lt(${t},${n(e-r)}),${Z},if(lt(${t},${n(e)}),1+(${Z}-1)*(${n(e)}-${t})/${n(r)},1))))`:`if(between(${t},${n(s)},${n(e)}),${Z},1)`;
   await vf(`zoompan=z='${z}':x='${n(op.focusX)}*(iw-iw/zoom)':y='${n(op.focusY)}*(ih-ih/zoom)':d=1:s=${info.width}x${info.height}:fps=${n(info.fps)},setsar=1`);break;}
  case 'speed':{
   await vf(`setpts=PTS/${n(op.factor)}`,atempo(op.factor));return {info:{...info,duration:info.duration/op.factor}};}
  case 'fade':{
   const v=[op.in>0?`fade=t=in:st=0:d=${n(op.in)}`:'',op.out>0?`fade=t=out:st=${n(Math.max(0,info.duration-op.out))}:d=${n(op.out)}`:''].filter(Boolean).join(',');
   const au=[op.in>0?`afade=t=in:st=0:d=${n(op.in)}`:'',op.out>0?`afade=t=out:st=${n(Math.max(0,info.duration-op.out))}:d=${n(op.out)}`:''].filter(Boolean).join(',');
   await vf(v,au);break;}
  case 'volume':{
   if(!a)return {info,note:'no audio stream; skipped'};
   await ff(['-i',input,'-c:v','copy','-af',`volume=${n(op.gainDb)}dB`,'-c:a','aac','-b:a','256k','-ar','48000',out]);break;}
  case 'loudness':{
   if(!a)return {info,note:'no audio stream; skipped'};
   const target=`I=${n(op.target)}:TP=${n(op.truePeak)}:LRA=${n(op.lra)}`;
   const stats=await loudnessStats(input,target).catch(()=>null);
   const second=stats?`loudnorm=${target}:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true`:`loudnorm=${target}`;
   await ff(['-i',input,'-c:v','copy','-af',second+',aresample=48000','-c:a','aac','-b:a','256k',out]);
   return {info,note:stats?'two-pass loudness normalization':'single-pass loudness normalization'};}
  case 'resize':{
   const w=even(op.width),h=even(op.height),c=op.color.slice(0,7);
   const f=op.mode==='pad'?`scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=${c}`:op.mode==='crop'?`scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`:`scale=${w}:${h}`;
   await vf(f+',setsar=1');return {info:{...info,width:w,height:h}};}
  case 'captions':{
   const cues=op.cues??parseSrt(await fs.readFile(path.resolve(base,op.srt!),'utf8'));
   const dir=path.join(work,'captions-'+randomUUID().slice(0,8));await fs.mkdir(dir,{recursive:true});
   const {files,font,language}=await renderCaptionImages(cues,op,{width:info.width,height:info.height},dir);
   let graph='',last='0:v';
   cues.forEach((c,i)=>{const next=i===cues.length-1?'v':'c'+i;graph+=`${graph?';':''}[${last}][${i+1}:v]overlay=0:0:enable='between(t,${n(c.start)},${n(c.end)})'[${next}]`;last=next;});
   await ff(['-i',input,...files.flatMap(f=>['-i',f]),'-filter_complex',graph,'-map','[v]',...(a?['-map','0:a','-c:a','copy']:['-an']),'-r',n(info.fps),'-c:v','libx264','-preset','veryfast','-crf','14','-pix_fmt','yuv420p',out]);
   return {info,note:`${cues.length} captions, ${language}, font ${path.basename(font)}`};}
 }
 return {info};
}

async function loudnessStats(input:string,target:string){
 const {spawn}=await import('node:child_process');
 const err=await new Promise<string>((resolve,reject)=>{const c=spawn(ffmpeg,['-hide_banner','-i',input,'-af',`loudnorm=${target}:print_format=json`,'-f','null','-'],{windowsHide:true});let e='';c.stderr.setEncoding('utf8');c.stderr.on('data',d=>e+=d);c.on('error',reject);c.on('close',code=>code===0?resolve(e):reject(new Error('loudness measurement failed')));});
 const json=err.slice(err.lastIndexOf('{'),err.lastIndexOf('}')+1);
 return JSON.parse(json) as Record<'input_i'|'input_tp'|'input_lra'|'input_thresh'|'target_offset',string>;
}

export async function measureLoudness(file:string){const s=await loudnessStats(file,'I=-14:TP=-1.5:LRA=11');return Number(s.input_i);}

async function defaultOutput(input:string){
 const dir=path.resolve(ROOT,process.env.VIDEO_OUTPUT||'mp2','edits');await fs.mkdir(dir,{recursive:true});
 const stem=path.basename(input,path.extname(input)).replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,60)||'edit';
 for(let i=1;;i++){const f=path.join(dir,`${stem}-edit-${String(i).padStart(3,'0')}.mp4`);try{await fs.access(f);}catch{return f;}}
}

export type EditResult={output:string;receipt:string;steps:{op:string;note?:string;width:number;height:number;fps:number;duration:number}[];info:MediaInfo};

/** Runs an edit decision list. `base` resolves relative paths (normally the EDL file's folder). */
export async function runEdl(raw:unknown,base=process.cwd(),options:{output?:string}={}):Promise<EditResult>{
 const edl:Edl=edlSchema.parse(raw);
 const input=path.resolve(base,edl.input);await fs.access(input);
 const output=options.output?path.resolve(options.output):edl.output?path.resolve(base,edl.output):await defaultOutput(input);
 const inputs=[input,...edl.operations.flatMap(o=>o.op==='concat'?o.files.map(f=>path.resolve(base,f)):[])];
 if(inputs.some(f=>path.resolve(f)===output))throw new Error('Output must not be one of the inputs');
 await fs.access(output).then(()=>{throw new Error('Output already exists; Reelwright never overwrites exports: '+output);},()=>{});
 const work=path.join(ROOT,'workspace','cache','editor',new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,6));
 await fs.mkdir(work,{recursive:true});
 const steps:Step[]=[];
 try{
  let current=input,info=await mediaInfo(input);
  for(const [i,op] of edl.operations.entries()){
   const out=path.join(work,`step-${String(i+1).padStart(2,'0')}-${op.op}.mp4`);
   const r=await applyOperation(op,current,info,out,base,work);
   const exists=await fs.access(out).then(()=>true,()=>false);
   if(exists){current=out;info={...(await mediaInfo(out)),hasAudio:r.info.hasAudio};}
   steps.push({op:op.op,output:current,info,note:r.note});
  }
  const p=exportPresets[edl.export.preset];
  await fs.mkdir(path.dirname(output),{recursive:true});
  await run(ffmpeg,['-hide_banner','-loglevel','error','-n','-i',current,'-c:v','libx264','-preset',p.preset,'-crf',String(p.crf),'-pix_fmt','yuv420p',
   ...(info.hasAudio?['-c:a','aac','-b:a',p.audioBitrate,'-ar','48000']:['-an']),'-movflags','+faststart',output]);
  const final=await mediaInfo(output);
  const receipt=output.replace(/\.mp4$/i,'')+'.edit.json';
  const summary=steps.map(s=>({op:s.op,note:s.note,width:s.info.width,height:s.info.height,fps:s.info.fps,duration:Number(s.info.duration.toFixed(3))}));
  await fs.writeFile(receipt,JSON.stringify({version:1,createdAt:new Date().toISOString(),input,output,edl,steps:summary,final},null,2)+'\n',{flag:'wx'});
  return {output,receipt,steps:summary,info:final};
 }finally{await fs.rm(work,{recursive:true,force:true});}
}
