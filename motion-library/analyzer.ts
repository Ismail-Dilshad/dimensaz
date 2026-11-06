import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {spawn} from 'node:child_process';
import {ffmpeg,ffprobe} from '../renderer/ffmpeg-encoder.js';
import {MANAGED,toRelative} from './paths.js';
import type {ReferenceRecord} from './model.js';
export const ANALYZER_VERSION=1;
export async function contentHash(file:string){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
export function execute(exe:string,args:string[],timeoutMs=120000):Promise<string>{
 return new Promise((resolve,reject)=>{
  const child=spawn(exe,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let out='',err='',settled=false;
  const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(out);};
  const timer=setTimeout(()=>{child.kill();finish(new Error('Reference analysis timed out: '+path.basename(exe)));},timeoutMs);
  child.stdout.on('data',c=>{out+=c;if(out.length>12_000_000){child.kill();finish(new Error('Analysis output limit exceeded'));}});
  child.stderr.on('data',c=>err=(err+c).slice(-12000));child.on('error',finish);
  child.on('close',code=>finish(code===0?undefined:new Error(path.basename(exe)+' failed: '+err)));
 });
}
export function inferFromName(name:string):ReferenceRecord['automatic']{
 const s=name.toLowerCase(),cats=new Set<ReferenceRecord['automatic']['categories'][number]>(),tags:string[]=[];
 const tutorial=/tutorial|how to|hacks|recreating|membuat|with ease/.test(s);
 if(tutorial)cats.add('Tutorials');
 if(/capcut/.test(s)){cats.add('CapCut-Style Animations');tags.push('capcut');}
 if(/text|typograph|kinetic|editorial/.test(s)){cats.add('Viral Typography');tags.push('typography');}
 if(/transition|preset/.test(s))cats.add('Text Transitions');
 if(/business|branding|website|seo|saas/.test(s))cats.add('SaaS Motion Graphics');
 if(/clay|3d/.test(s))cats.add('Claymorphism and 3D');
 if(/gradient|background|sfx/.test(s)){cats.add('Motion Effects');tags.push('background');}
 return {kind:tutorial?'tutorial':'uncertain',confidence:tutorial?.45:.2,categories:[...cats],tags,
  description:'Unreviewed reference. Filename hints only; inspect generated frames before identifying visual techniques.',
  uncertainties:['Content type and style require visual review.','Exact easing, fonts, editor parameters and tutorial steps cannot be established from the filename.']};
}
export function parseCuts(text:string){return [...text.matchAll(/pts_time:([\d.]+)/g)].map(m=>Number(m[1]));}
export async function analyze(file:string,id:string,hash:string){
 const info=JSON.parse(await execute(ffprobe,['-v','error','-show_streams','-show_format','-of','json',file]));
 const v=info.streams.find((s:any)=>s.codec_type==='video');if(!v)throw new Error('No video stream');
 const duration=Number(info.format.duration||v.duration);if(!Number.isFinite(duration)||duration<=0)throw new Error('Invalid source duration');
 const [a,b]=String(v.avg_frame_rate||'0/1').split('/').map(Number);
 const media={duration,width:v.width,height:v.height,fps:b?a/b:0,audio:info.streams.some((s:any)=>s.codec_type==='audio')};
 const output=path.join(MANAGED,'derived',id,hash.slice(0,12),randomUUID());await fs.mkdir(output,{recursive:true});
 const window=Math.min(duration,120);
 const [cutText,motionText]=await Promise.all([
  execute(ffmpeg,['-v','error','-i',file,'-t',String(window),'-an','-vf',"scale=160:-2,select='gt(scene,0.30)',metadata=print:file=-",'-f','null','-']),
  execute(ffmpeg,['-v','error','-i',file,'-t',String(window),'-an','-vf','fps=4,scale=160:-2,tblend=all_mode=difference,signalstats,metadata=print:file=-','-f','null','-'])
 ]);
 const cuts=parseCuts(cutText).filter((t,i,all)=>i===0||t-all[i-1]>.2);
 const luma=[...motionText.matchAll(/lavfi.signalstats.YAVG=([\d.]+)/g)].map(m=>Number(m[1]));
 // Uniform full-duration samples plus the strongest detected cut neighborhoods.
 const uniform=Array.from({length:10},(_,i)=>Math.min(duration-.02,Math.max(.01,(duration-.04)*i/9)));
 const times=[...uniform,...cuts.slice(0,6).map(t=>Math.min(duration-.02,t+.08))].sort((a,b)=>a-b).filter((t,i,all)=>i===0||t-all[i-1]>.15);
 const previews:{time:number;path:string}[]=[];
 for(let i=0;i<times.length;i++){
  const frame=path.join(output,String(i).padStart(3,'0')+'.jpg');
  await execute(ffmpeg,['-v','error','-n','-ss',String(times[i]),'-i',file,'-frames:v','1','-vf','scale=320:-2','-q:v','3',frame]);
  previews.push({time:times[i],path:toRelative(frame)});
 }
 const sheet=path.join(output,'contact-sheet.jpg');
 await execute(ffmpeg,['-v','error','-n','-framerate','1','-i',path.join(output,'%03d.jpg'),'-vf','scale=240:400:force_original_aspect_ratio=decrease,pad=240:400:(ow-iw)/2:(oh-ih)/2:color=0xf4f6fb,tile=4x'+Math.ceil(previews.length/4),'-frames:v','1','-q:v','2',sheet]);
 return {media,measurements:{sampledWindow:window,cutCandidates:cuts,meanLumaDifference:luma.length?luma.reduce((s,n)=>s+n,0)/luma.length:undefined,motionSamples:luma.length,
  notes:['Cut candidates are pixel-change thresholds, not verified editorial cuts.','Luma difference measures frame changes; it cannot identify easing or distinguish editor UI from the animation.',duration>120?'Motion/cut measurements cover the first 120 seconds; frame samples span the full video.':'Uniform frame samples and cut neighborhoods cover this short reference.']},
  previews,contactSheet:toRelative(sheet)};
}
