// Shaky footage: how much a clip shakes, whether stabilising can save it, and a steady copy. FFmpeg's
// own stabiliser (vid.stab), so no extra tools are needed: the camera's movement is measured, its
// path smoothed, and each frame moved onto the smooth path with only the zoom it needs.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {ffmpeg,probe,run} from '../renderer/ffmpeg-encoder.js';

/** Shake is measured on a 640 px wide copy, in pixels of that copy (as the media tools do). */
export const ANALYSIS_WIDTH=640,STEADY=1.5,SAVEABLE=14,MAX_ZOOM=1.2;
export type Shake={file:string;seconds:number;fps:number;shake:number;worst:{time:number;shake:number}[];zoomNeeded:number;
 verdict:'steady'|'fix'|'too-shaky';why:string;perSecond:{time:number;shake:number}[]};
const esc=(f:string)=>f.replace(/\\/g,'/').replace(/:/g,'\\:').replace(/'/g,"\\'");
const median=(a:number[])=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]!;};
/** Parses vid.stab's text transforms: each frame's movement is the median of its fields' movements. */
export function parseTrf(text:string){
 const out:{dx:number;dy:number}[]=[];
 for(const line of text.split('\n')){const m=/^Frame (\d+) \(List \d+ \[(.*)\]\)/.exec(line);if(!m)continue;
  const v=[...m[2]!.matchAll(/\(LM (-?\d+) (-?\d+) /g)].map(x=>({dx:Number(x[1]),dy:Number(x[2])}));
  out[Number(m[1])-1]={dx:median(v.map(x=>x.dx)),dy:median(v.map(x=>x.dy))};}
 return Array.from(out,x=>x??{dx:0,dy:0});
}
/** Shake: how far the camera's path strays from its own smooth version (about half a second). */
export function jitter(moves:{dx:number;dy:number}[],fps:number,o:{seconds?:number}={}){
 const n=moves.length;if(n<3)return {mean:0,max:0,each:[] as number[]};
 const px:number[]=[],py:number[]=[];let x=0,y=0;for(const m of moves){x+=m.dx;y+=m.dy;px.push(x);py.push(y);}
 const r=Math.max(1,Math.round(fps*(o.seconds??.5))),each:number[]=[];
 // The smooth path near each frame is a straight line fitted to the half second around it, so a
 // steady pan (or the start and end of a clip) is not counted as shake.
 const fit=(p:number[],i:number,a:number,b:number)=>{let st=0,sv=0,stt=0,stv=0,c=0;for(let k=a;k<=b;k++){st+=k;sv+=p[k]!;stt+=k*k;stv+=k*p[k]!;c++;}
  const d=c*stt-st*st,slope=d?(c*stv-st*sv)/d:0;return (sv-slope*st)/c+slope*i;};
 for(let i=0;i<n;i++){const a=Math.max(0,i-r),b=Math.min(n-1,i+r);each.push(Math.hypot(px[i]!-fit(px,i,a,b),py[i]!-fit(py,i,a,b)));}
 return {mean:each.reduce((a,b)=>a+b,0)/n,max:Math.max(...each),each};
}
async function info(file:string){const p=await probe(file),v=(p.streams as {codec_type:string;width?:number;height?:number;avg_frame_rate?:string}[]).find(s=>s.codec_type==='video');
 if(!v)throw new Error('Not a video: '+file);const [a,b]=String(v.avg_frame_rate??'30/1').split('/').map(Number);
 return {width:Number(v.width),height:Number(v.height),fps:b?a!/b:a||30,seconds:Number(p.format?.duration)||0};}
/** How much a clip shakes, where it is worst, and whether stabilising can save it. */
export async function measureShake(file:string):Promise<Shake>{
 const i=await info(file),dir=await fs.mkdtemp(path.join(os.tmpdir(),'tl-shake-')),trf=path.join(dir,'t.trf');
 try{
  await run(ffmpeg,['-v','error','-i',file,'-an','-vf',`scale=${ANALYSIS_WIDTH}:-2,vidstabdetect=shakiness=8:accuracy=9:stepsize=6:fileformat=1:result='${esc(trf)}'`,'-f','null','-']);
  const moves=parseTrf(await fs.readFile(trf,'utf8')),j=jitter(moves,i.fps);
  const step=Math.max(1,Math.round(i.fps)),perSecond:{time:number;shake:number}[]=[];
  for(let s=0;s<j.each.length;s+=step){const part=j.each.slice(s,s+step);perSecond.push({time:+(s/i.fps).toFixed(1),shake:+(part.reduce((a,b)=>a+b,0)/part.length).toFixed(2)});}
  // The zoom that hides the edges a frame moves by: twice its largest stray, against the width.
  const zoomNeeded=+(1+2*j.max/ANALYSIS_WIDTH).toFixed(3),shake=+j.mean.toFixed(2);
  const verdict:Shake['verdict']=shake<=STEADY?'steady':shake<=SAVEABLE&&zoomNeeded<=MAX_ZOOM?'fix':'too-shaky';
  const why=verdict==='steady'?`It is steady (shake ${shake}, ${STEADY} or less is steady).`
   :verdict==='fix'?`It shakes (${shake}); stabilising fixes it with a ${Math.round((zoomNeeded-1)*100)}% zoom at most.`
   :shake>SAVEABLE?`Too shaky to save: it shakes by ${shake}, and above ${SAVEABLE} a steady copy looks like it is swimming. Use another take, or only its steadiest part.`
   :`Too shaky to save: steadying it would crop ${Math.round((1-1/zoomNeeded)*100)}% of the picture away. Use another take, or only its steadiest part.`;
  return {file,seconds:+i.seconds.toFixed(2),fps:+i.fps.toFixed(3),shake,worst:[...perSecond].sort((a,b)=>b.shake-a.shake).slice(0,3),zoomNeeded,verdict,why,perSecond};
 }finally{await fs.rm(dir,{recursive:true,force:true});}
}
/** The FFmpeg filters that steady a clip, from its measured transforms (two passes). */
export async function steadyFilter(file:string,work:string,smoothing=1){
 const i=await info(file),trf=path.join(work,`steady-${randomUUID().slice(0,8)}.trf`);
 await run(ffmpeg,['-v','error','-i',file,'-an','-vf',`vidstabdetect=shakiness=8:accuracy=15:result='${esc(trf)}'`,'-f','null','-']);
 return `vidstabtransform=input='${esc(trf)}':smoothing=${Math.max(1,Math.round(i.fps*smoothing))}:optzoom=1:zoomspeed=0.25:interpol=bicubic,unsharp=5:5:0.6:3:3:0.3`;
}
/** A steady copy of a clip (the sound kept), with its shake before and after. Never overwrites. */
export async function stabilize(file:string,o:{out?:string;smoothing?:number}={}){
 const input=path.resolve(file),before=await measureShake(input);
 let out=o.out?path.resolve(o.out):input.replace(/\.[^.]+$/,'')+'-stabilized.mp4';
 if(o.out){if(await fs.access(out).then(()=>true,()=>false))throw new Error('Output already exists; never overwriting: '+out);}
 else for(let k=2;await fs.access(out).then(()=>true,()=>false);k++)out=input.replace(/\.[^.]+$/,'')+`-stabilized-${k}.mp4`;
 const work=await fs.mkdtemp(path.join(os.tmpdir(),'tl-steady-'));
 try{
  const vf=await steadyFilter(input,work,o.smoothing??1);
  await fs.mkdir(path.dirname(out),{recursive:true});
  await run(ffmpeg,['-v','error','-n','-i',input,'-vf',vf,'-map','0:v','-map','0:a?','-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',out]);
 }finally{await fs.rm(work,{recursive:true,force:true});}
 const after=await measureShake(out);
 return {input,output:out,shakeBefore:before.shake,shakeAfter:after.shake,verdict:before.verdict,why:before.why,
  note:before.verdict==='too-shaky'?'Made anyway, as asked; check it before using it.':'The picture is zoomed in only as much as the shake needs.'};
}
