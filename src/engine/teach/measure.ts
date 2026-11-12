// What Tempoloom measures in a video it is taught, with FFmpeg only: cut rhythm, motion, colour,
// layout and sound. Numbers only leave this file: the measurements, a fingerprint for finding
// similar videos, and (in the temporary study folder) frame sheets for the agent to look at.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ffmpeg,probe,run} from '../../renderer/ffmpeg-encoder.js';
import {analyzeMusic} from '../music/analyze.js';
import {measureLoudness} from '../sound-quality.js';

export type Crop={x:number;y:number;w:number;h:number};
export type Measured={
 media:{seconds:number;width:number;height:number;fps:number;shape:'vertical'|'square'|'horizontal';audio:boolean};
 pacing:{cuts:number;cutsPerMinute:number;shotMedian:number;shotShortest:number;shotLongest:number;firstCut:number|null;openingShots:number;endingShots:number;cutTimes:number[]};
 motion:{energy:number;stillShare:number;burstsPerSecond:number;peakAt:number|null};
 color:{brightness:number;saturation:number;contrast:number;palette:{hex:string;share:number}[];background:string;accent:string|null;hues:number[]};
 layout:{detail:number;top:number;middle:number;bottom:number;grid:number[]};
 sound:{bpm:number;tempoConfidence:number;eventsPerSecond:number;lufs:number|null;cutsOnBeat:number|null;cutsOnBeatByChance:number|null}|null;
 notes:string[]};

const r2=(n:number)=>Math.round(n*100)/100,r3=(n:number)=>Math.round(n*1000)/1000;
const median=(a:number[])=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]!:(s[m-1]!+s[m]!)/2;};
const hex=(r:number,g:number,b:number)=>'#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');

/** Runs FFmpeg and returns its raw output (frames) or its text output. */
function pipe(args:string[],text=false,timeoutMs=15*60*1000):Promise<Buffer>{
 return new Promise((resolve,reject)=>{
  const p=spawn(ffmpeg,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});const chunks:Buffer[]=[];let err='',size=0;
  const timer=setTimeout(()=>{p.kill();reject(new Error('Measuring the video took too long'));},timeoutMs);
  (text?p.stderr:p.stdout).on('data',(c:Buffer)=>{size+=c.length;if(size<600_000_000)chunks.push(c);});
  if(!text)p.stderr.on('data',(c:Buffer)=>{err=(err+c).slice(-4000);});else p.stdout.resume();
  p.on('error',e=>{clearTimeout(timer);reject(e);});
  p.on('close',code=>{clearTimeout(timer);code===0?resolve(Buffer.concat(chunks)):reject(new Error('FFmpeg could not read the video: '+(text?Buffer.concat(chunks).toString().slice(-600):err).trim().split('\n').slice(-2).join(' ')));});
 });
}

/** Length, size and sound of a file; throws when it is not a video. */
export async function inspect(file:string){
 let info:{streams?:Record<string,unknown>[];format?:{duration?:string}};
 try{info=await probe(file);}catch{throw new Error('This file is not a video FFmpeg can read');}
 const v=info.streams?.find(s=>s.codec_type==='video'&&(s.disposition as {attached_pic?:number}|undefined)?.attached_pic!==1);
 if(!v)throw new Error('This file has no video in it');
 const seconds=Number(info.format?.duration??v.duration);if(!(seconds>0))throw new Error('The video has no length');
 const [a,b]=String(v.avg_frame_rate??'0/1').split('/').map(Number);
 // Phone videos are often stored sideways with a rotation flag.
 const rot=Math.abs(Number((v.side_data_list as {rotation?:number}[]|undefined)?.find(s=>s.rotation!==undefined)?.rotation??(v.tags as {rotate?:string}|undefined)?.rotate??0))%180===90;
 const width=Number(rot?v.height:v.width),height=Number(rot?v.width:v.height);
 return {seconds,width,height,fps:b?r2(a!/b):0,audio:!!info.streams?.some(s=>s.codec_type==='audio')};
}

/** The part of a video to study: trimmed, cropped, at most 720 px on the short side, H.264. */
export async function studyClip(source:string,out:string,o:{start?:number;end?:number;crop?:Crop|null;sound?:boolean}={}){
 const info=await inspect(source),start=Math.max(0,Math.min(info.seconds-.2,o.start??0)),end=Math.max(start+.2,Math.min(info.seconds,o.end??info.seconds));
 const vf:string[]=[];
 if(o.crop){const c=o.crop,even=(n:number)=>Math.max(2,Math.floor(n/2)*2);
  const w=even(info.width*c.w),h=even(info.height*c.h),x=Math.max(0,Math.min(info.width-w,Math.round(info.width*c.x))),y=Math.max(0,Math.min(info.height-h,Math.round(info.height*c.y)));
  vf.push(`crop=${w}:${h}:${x}:${y}`);}
 vf.push("scale='if(lt(iw,ih),min(720,iw),-2)':'if(lt(iw,ih),-2,min(720,ih))'",'setsar=1','format=yuv420p');
 await run(ffmpeg,['-v','error','-y','-ss',String(start),'-i',source,'-t',String(r3(end-start)),'-map','0:v:0',...(info.audio&&o.sound!==false?['-map','0:a:0?','-c:a','aac','-b:a','128k']:['-an']),
  '-vf',vf.join(','),'-c:v','libx264','-preset','veryfast','-crf','20','-movflags','+faststart',out]);
 return {start:r3(start),end:r3(end)};
}

/** Hard cuts and their times: a frame that changes far more than the frames around it. */
async function cuts(file:string,fps:number){
 const out=(await pipe(['-hide_banner','-i',file,'-an','-vf',"scale=160:-2,select='gte(scene,0)',metadata=print:key=lavfi.scene_score",'-f','null','-'],true)).toString();
 const rows=[...out.matchAll(/pts_time:([\d.]+)[\s\S]*?scene_score=([\d.]+)/g)].map(m=>({t:Number(m[1]),s:Number(m[2])}));
 const times:number[]=[];let last=-1e9;
 for(let i=1;i<rows.length;i++){const around=[...rows.slice(Math.max(0,i-4),i),...rows.slice(i+1,i+5)].map(r=>r.s).sort((a,b)=>a-b),med=around[around.length>>1]??0;
  if(rows[i]!.s>=.15&&rows[i]!.s>=4*med+.05&&i-last>=Math.max(2,fps*.25)){times.push(r3(rows[i]!.t));last=i;}}
 return times;
}

const N=64,RATE=8;
/** Small frames (64×64, 8 a second) for motion, colour and layout. */
async function frames(file:string){
 const raw=await pipe(['-v','error','-i',file,'-an','-vf',`fps=${RATE},scale=${N}:${N}:flags=area`,'-pix_fmt','rgb24','-f','rawvideo','-']);
 const size=N*N*3,count=Math.floor(raw.length/size);if(count<2)throw new Error('The video is too short to study (under half a second)');
 return {raw,count,size};
}

export async function measure(file:string,o:{sound?:boolean}={}):Promise<Measured>{
 const media=await inspect(file),notes:string[]=[];
 const [cutTimes,{raw,count,size}]=await Promise.all([cuts(file,media.fps||30),frames(file)]);
 // ---- pacing ----
 const edges=[0,...cutTimes,media.seconds],shots=edges.slice(1).map((t,i)=>t-edges[i]!).filter(s=>s>.05);
 const third=media.seconds/3,inRange=(a:number,b:number)=>cutTimes.filter(t=>t>=a&&t<b).length;
 const pacing={cuts:cutTimes.length,cutsPerMinute:r2(cutTimes.length/media.seconds*60),shotMedian:r2(median(shots)),shotShortest:r2(Math.min(...shots)),shotLongest:r2(Math.max(...shots)),
  firstCut:cutTimes[0]??null,openingShots:inRange(0,third)+1,endingShots:inRange(2*third,media.seconds+1)+1,cutTimes:cutTimes.slice(0,400)};
 // ---- motion, colour, layout from the small frames ----
 const luma=new Float32Array(N*N),prev=new Float32Array(N*N),diffs:number[]=[],bins=new Map<number,{n:number;r:number;g:number;b:number}>();
 const grid=new Float64Array(64),hues=new Float64Array(6);let bright=0,sat=0,contrast=0,detail=0,bandTop=0,bandMid=0,bandBot=0,pixels=0;
 const step=Math.max(1,Math.floor(count/240)); // colour and layout from at most ~240 frames
 for(let f=0;f<count;f++){
  const o0=f*size;let sum=0,sum2=0;
  for(let i=0;i<N*N;i++){const r=raw[o0+i*3]!,g=raw[o0+i*3+1]!,b=raw[o0+i*3+2]!,y=(.299*r+.587*g+.114*b)/255;luma[i]=y;sum+=y;sum2+=y*y;}
  if(f>0){let d=0;for(let i=0;i<N*N;i++)d+=Math.abs(luma[i]!-prev[i]!);diffs.push(d/(N*N)*100);}
  prev.set(luma);
  if(f%step)continue;
  const mean=sum/(N*N);bright+=mean;contrast+=Math.sqrt(Math.max(0,sum2/(N*N)-mean*mean));
  for(let i=0;i<N*N;i++){
   const r=raw[o0+i*3]!,g=raw[o0+i*3+1]!,b=raw[o0+i*3+2]!,mx=Math.max(r,g,b),mn=Math.min(r,g,b),c=(mx-mn)/255;
   sat+=mx?(mx-mn)/mx:0;
   if(c>.12){let h=mx===r?((g-b)/(mx-mn))%6:mx===g?(b-r)/(mx-mn)+2:(r-g)/(mx-mn)+4;h=(h*60+360)%360;hues[Math.floor(h/60)%6]!+=c;}
   const key=(r>>4)<<8|(g>>4)<<4|(b>>4),e=bins.get(key);if(e){e.n++;e.r+=r;e.g+=g;e.b+=b;}else bins.set(key,{n:1,r,g,b});
   const x=i%N,y=(i/N)|0;grid[(y>>3)*8+(x>>3)]!+=luma[i]!;
   if(x<N-1&&y<N-1){const e2=Math.abs(luma[i]!-luma[i+1]!)+Math.abs(luma[i]!-luma[i+N]!);detail+=e2;if(y<N/3)bandTop+=e2;else if(y<2*N/3)bandMid+=e2;else bandBot+=e2;}
  }
  pixels++;
 }
 const cutFrames=new Set(cutTimes.map(t=>Math.round(t*RATE)-1));
 const within=diffs.filter((_,i)=>!cutFrames.has(i)&&!cutFrames.has(i-1)); // motion inside shots, not the cuts themselves
 const base=within.length?within:diffs,energy=base.reduce((a,b)=>a+b,0)/base.length;
 const thr=Math.max(2.5,median(base)*3);let bursts=0,lastB=-9;for(let i=1;i<base.length-1;i++)if(base[i]!>thr&&base[i]!>=base[i-1]!&&base[i]!>=base[i+1]!&&i-lastB>=3){bursts++;lastB=i;}
 let peak=0,peakAt:number|null=null;diffs.forEach((d,i)=>{if(!cutFrames.has(i)&&d>peak){peak=d;peakAt=r2((i+1)/RATE);}});
 const motion={energy:r2(energy),stillShare:r2(base.filter(d=>d<.35).length/base.length),burstsPerSecond:r2(bursts/media.seconds),peakAt};
 const total=pixels*N*N,top=[...bins.values()].sort((a,b)=>b.n-a.n);
 const palette=top.slice(0,6).map(e=>({hex:hex(e.r/e.n,e.g/e.n,e.b/e.n),share:r3(e.n/total)}));
 const chroma=(e:{n:number;r:number;g:number;b:number})=>(Math.max(e.r,e.g,e.b)-Math.min(e.r,e.g,e.b))/e.n/255;
 const vivid=top.filter(e=>e.n/total>=.006&&e!==top[0]&&chroma(e)>=.3).sort((a,b)=>chroma(b)*(b.n/total)**.2-chroma(a)*(a.n/total)**.2)[0];
 const hueSum=hues.reduce((a,b)=>a+b,0)||1,bands=bandTop+bandMid+bandBot||1;
 const color={brightness:r2(bright/pixels),saturation:r2(sat/total),contrast:r2(contrast/pixels),palette,background:palette[0]?.hex??'#000000',accent:vivid?hex(vivid.r/vivid.n,vivid.g/vivid.n,vivid.b/vivid.n):null,
  hues:[...hues].map(h=>r2(h/hueSum))};
 const layout={detail:r3(detail/total),top:r2(bandTop/bands),middle:r2(bandMid/bands),bottom:r2(bandBot/bands),grid:[...grid].map(g=>r2(g/(pixels*64)))};
 // ---- sound ----
 let sound:Measured['sound']=null;
 if(media.audio&&o.sound!==false){
  try{
   const a=await analyzeMusic(file),l=await measureLoudness(file);
   let on:number|null=null,chance:number|null=null;
   if(a.confidence>=.25&&cutTimes.length>=4){const tol=.085,hit=cutTimes.filter(t=>{const k=(t-a.offset)/a.beat;return Math.abs(k-Math.round(k))*a.beat<=tol;}).length;on=r2(hit/cutTimes.length);chance=r2(Math.min(1,2*tol/a.beat));}
   sound={bpm:a.bpm,tempoConfidence:a.confidence,eventsPerSecond:a.onsetsPerSecond,lufs:l.lufs,cutsOnBeat:on,cutsOnBeatByChance:chance};
   if(a.confidence<.25)notes.push('No clear musical tempo was found (speech only, or music without a steady beat), so cuts were not compared with the beat.');
  }catch{notes.push('The sound could not be analysed (too short or silent).');}
 }else notes.push(media.audio?'The sound was left out, as asked.':'The video has no sound.');
 if(cutTimes.length<2)notes.push('Almost no hard cuts: this is one continuous piece (motion graphics often are), so pacing comes from the motion, not the cuts.');
 notes.push('Text on screen is not measured: read it from the frame sheets.');
 const shape=media.width/media.height>1.15?'horizontal':media.width/media.height<.87?'vertical':'square';
 return {media:{...media,seconds:r2(media.seconds),shape},pacing,motion,color,layout,sound,notes};
}

/** A list of numbers that places a video among others: pacing, motion, colour, sound, layout. */
export const FINGERPRINT_PARTS={pacing:[0,3],motion:[3,6],color:[6,15],sound:[15,19],layout:[19,83]} as const;
export function fingerprint(m:Measured):number[]{
 const c=(n:number)=>Math.max(0,Math.min(1,n));
 return [
  c(Math.log2(1+m.pacing.shotMedian)/4),c(m.pacing.cutsPerMinute/90),c((m.pacing.firstCut??m.media.seconds)/6),
  c(m.motion.energy/8),m.motion.stillShare,c(m.motion.burstsPerSecond/3),
  m.color.brightness,m.color.saturation,c(m.color.contrast*2.5),...m.color.hues,
  m.sound?c((m.sound.bpm-60)/120):.5,m.sound?c(m.sound.eventsPerSecond/8):0,m.sound?.cutsOnBeat??.3,m.sound?.lufs!=null?c((m.sound.lufs+40)/35):.5,
  ...m.layout.grid].map(r3);
}
/** How alike two fingerprints are, 0..1, overall and by part. */
export function likeness(a:number[],b:number[]){
 const part=([from,to]:readonly [number,number])=>{let s=0;for(let i=from;i<to;i++)s+=(a[i]!-b[i]!)**2;return Math.max(0,1-Math.sqrt(s/(to-from))*2.2);};
 const p=Object.fromEntries(Object.entries(FINGERPRINT_PARTS).map(([k,v])=>[k,r2(part(v))])) as Record<keyof typeof FINGERPRINT_PARTS,number>;
 return {overall:r2(p.pacing*.28+p.motion*.22+p.color*.2+p.sound*.1+p.layout*.2),...p};
}

/** Frame sheets for the agent to look at: the whole video, the opening, the cuts, and every
 *  moment the user marked. They stay in the temporary study folder and are deleted with it. */
export async function frameSheets(file:string,dir:string,m:Measured,marks:{t:number;note:string}[]=[]){
 await fs.mkdir(dir,{recursive:true});
 const dur=m.media.seconds,clamp=(t:number)=>Math.max(0,Math.min(dur-.04,t));
 const cell=m.media.shape==='horizontal'?{w:320,h:180}:m.media.shape==='square'?{w:240,h:240}:{w:180,h:320};
 const sheets:{file:string;shows:string;times:number[]}[]=[];
 const sheet=async(name:string,shows:string,times:number[],columns:number)=>{
  if(!times.length)return;
  const tmp=path.join(dir,'_'+name);await fs.mkdir(tmp,{recursive:true});
  for(let i=0;i<times.length;i++)await run(ffmpeg,['-v','error','-y','-ss',String(clamp(times[i]!)),'-i',file,'-frames:v','1','-vf',`scale=${cell.w}:${cell.h}:force_original_aspect_ratio=decrease,pad=${cell.w}:${cell.h}:(ow-iw)/2:(oh-ih)/2:color=0x202020`,'-q:v','3',path.join(tmp,String(i).padStart(3,'0')+'.jpg')]);
  const out=path.join(dir,name+'.jpg');
  await run(ffmpeg,['-v','error','-y','-framerate','1','-i',path.join(tmp,'%03d.jpg'),'-vf',`tile=${Math.min(columns,times.length)}x${Math.ceil(times.length/columns)}:padding=4:color=0x101010`,'-frames:v','1','-q:v','3',out]);
  await fs.rm(tmp,{recursive:true,force:true});
  sheets.push({file:out,shows,times:times.map(r2)});
 };
 const n=Math.max(6,Math.min(24,Math.round(dur/1.5)));
 await sheet('overview','The whole video, left to right, top to bottom',Array.from({length:n},(_,i)=>dur*(i+.5)/n),6);
 await sheet('opening','The first 3 seconds, 4 frames a second (the hook)',Array.from({length:Math.min(12,Math.floor(Math.min(3,dur)*4))},(_,i)=>i/4),6);
 const cutPairs=m.pacing.cutTimes.slice(0,12).flatMap(t=>[t-.1,t+.1]);
 await sheet('cuts','The frame before and after each of the first cuts, in pairs',cutPairs,6);
 for(let i=0;i<marks.length&&i<12;i++)await sheet('mark-'+(i+1),`Your mark at ${r2(marks[i]!.t)} s (${marks[i]!.note||'no note'}): 8 frames across 1.2 seconds, to see how it moves`,Array.from({length:8},(_,k)=>marks[i]!.t-.6+k*1.2/7),8);
 if(m.motion.peakAt!==null)await sheet('busiest','The moment with the most motion: 8 frames across 1 second',Array.from({length:8},(_,k)=>m.motion.peakAt!-.5+k/7),8);
 return sheets;
}

/** A small still for the Teach page (kept locally, never committed). */
export async function thumbnail(file:string,out:string,at:number){
 await fs.mkdir(path.dirname(out),{recursive:true});
 await run(ffmpeg,['-v','error','-y','-ss',String(Math.max(0,at)),'-i',file,'-frames:v','1','-vf','scale=320:320:force_original_aspect_ratio=decrease','-q:v','4',out]);
}
