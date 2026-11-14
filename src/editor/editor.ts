// Applies an edit decision list to footage with FFmpeg. Each operation re-encodes into a
// private work folder at high quality; the final export uses the chosen preset. The
// input is never modified and an existing output is never overwritten.
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {ROOT} from '../engine/config.js';
import {ffmpeg,probe,run} from '../renderer/ffmpeg-encoder.js';
import {edlSchema,exportPresets,aspectSizes,type Edl,type Operation} from './edl.js';
import {parseSrt} from './srt.js';
import {renderCaptionImages,renderCaptionTrack} from './captions.js';
import {brandAssets,logoPng,endCard} from './brand-layer.js';
import {isVertical,margins,captionMargin} from '../engine/safe-areas.js';
import {followCommands,followSummary} from './follow.js';
import {measureShake,steadyFilter} from './steady.js';
import {loopGraph,loopSeam} from './loop.js';

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
function segmentGraph(raw:{start:number;end:number}[],audio:boolean,fps?:number){
 // Parts start and end on a frame, so the sound (cut to the sample) stays with the picture
 // (cut to the frame) however many parts there are.
 const snap=(t:number)=>fps?Math.round(t*fps)/fps:t,ranges=raw.map(r=>({start:snap(r.start),end:snap(r.end)})).filter(r=>r.end>r.start);
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
   await ff(['-i',input,'-filter_complex',segmentGraph(ranges,a,info.fps),'-map','[v]',...(a?['-map','[a]']:[]),...intermediate(a,info.fps),out]);break;}
  case 'split':{
   const points=[0,...[...new Set(op.at)].filter(t=>t>0&&t<info.duration).sort((x,y)=>x-y),info.duration];
   const segments=points.slice(1).map((end,i)=>({start:points[i],end}));
   const order=op.keep??segments.map((_,i)=>i);
   for(const i of order)if(!segments[i])throw new Error(`split: segment ${i} does not exist (there are ${segments.length})`);
   await ff(['-i',input,'-filter_complex',segmentGraph(order.map(i=>segments[i]),a,info.fps),'-map','[v]',...(a?['-map','[a]']:[]),...intermediate(a,info.fps),out]);break;}
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
   if(op.follow?.length){
    // The crop glides with the speaker: one position per frame, sent to the crop filter as it plays.
    const cmds=path.join(work,`follow-${randomUUID().slice(0,8)}.txt`);
    await fs.writeFile(cmds,followCommands(op.follow,{fps:info.fps,duration:info.duration,width:info.width,height:info.height,cw,ch}));
    const esc=cmds.replace(/\\/g,'/').replace(/:/g,'\\:').replace(/'/g,"\\'");
    await vf(`sendcmd=f='${esc}',crop=w=${cw}:h=${ch}:x=${x}:y=${y},scale=${dw}:${dh}:flags=lanczos,setsar=1`);
    const s=followSummary(op.follow);return {info:{...info,width:dw,height:dh},note:`${op.aspect}, following the speaker (${s.moves} points, the crop travels ${Math.round(s.travel*100)}% of the width)`};}
   await vf(`crop=${cw}:${ch}:${x}:${y},scale=${dw}:${dh}:flags=lanczos,setsar=1`);return {info:{...info,width:dw,height:dh},note:`${op.aspect} around (${op.focusX}, ${op.focusY})`};}
  case 'sounds':{
   // The same sounds and levels as motion videos; pushed down while someone speaks.
   const {kitSource,renderSoundBed,cueSounds}=await import('../engine/piece-sounds.js'),{readSfxIndex}=await import('../engine/sfx.js');
   const pick=await kitSource(op.kit,cueSounds(await readSfxIndex())),TARGET:Record<string,number>={whoosh:-31,click:-27,tick:-34,pop:-28,success:-31,impact:-28},LEN:Record<string,number>={whoosh:1,click:.2,tick:.06,pop:.4,success:1,impact:.5};
   const lvl=op.level,count=new Map<string,number>(),placed=op.cues.filter(c=>c.time<info.duration-.02).flatMap(c=>{const k=count.get(c.sound)??0,s=pick(c.sound,k);if(!s)return [];count.set(c.sound,k+1);
    return [{at:c.time,sound:c.sound,gain:c.gain,why:c.why??'',scene:0,time:c.time,file:s.file,volume:+Math.min(4,10**((TARGET[c.sound]!-s.rmsDb)/20)*c.gain*lvl).toFixed(3),length:+Math.min(s.duration,LEN[c.sound]!).toFixed(3)}];});
   if(!placed.length)return {info,note:'no sound could be placed'};
   const bed=await renderSoundBed(placed,info.duration,path.join(work,`sounds-${randomUUID().slice(0,8)}.wav`));
   const graph=a?(op.underVoice?'[0:a]aresample=48000,aformat=channel_layouts=stereo,asplit=2[v][side];[1:a][side]sidechaincompress=threshold=0.03:ratio=8:attack=8:release=250[s];[v][s]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[a]'
    :'[0:a]aresample=48000,aformat=channel_layouts=stereo[v];[v][1:a]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[a]'):'[1:a]anull[a]';
   await ff(['-i',input,'-i',bed,'-filter_complex',graph,'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','256k','-ar','48000','-t',n(info.duration),out]);
   return {info:{...info,hasAudio:true},note:`${placed.length} sounds (${op.kit}${a&&op.underVoice?', under the voice':''})`};}
  case 'loop':{
   const x=op.crossfade;if(info.duration<3*x)throw new Error(`loop: the clip is too short for a ${x} s crossfade (it needs at least ${(3*x).toFixed(1)} s)`);
   await ff(['-i',input,'-filter_complex',loopGraph(info.duration,x,a,info.fps),'-map','[v]',...(a?['-map','[a]']:[]),...intermediate(a,info.fps),out]);
   const seam=await loopSeam(out);return {info:{...info,duration:info.duration-x},note:`a loop with a ${x} s crossfade (${seam.seamless?'seamless':'a seam remains: '+seam.note})`};}
  case 'cursor':{
   // A circle that follows the cursor (positions sent to the overlay as it plays), a ring at each click.
   const D=even(op.size*info.width),R=even(D*1.9),hex=op.color.slice(1,7),[cr,cg,cb]=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
   const dot=path.join(work,`cursor-${randomUUID().slice(0,6)}.png`),ring=dot.replace('.png','-ring.png');
   await ff(['-f','lavfi','-i',`color=c=black@0:s=${D}x${D},format=rgba,geq=r=${cr}:g=${cg}:b=${cb}:a='if(lte(hypot(X-W/2\,Y-H/2)\,W/2-1)\,${Math.round(op.opacity*255)}\,0)'`,'-frames:v','1',dot]);
   await ff(['-f','lavfi','-i',`color=c=black@0:s=${R}x${R},format=rgba,geq=r=${cr}:g=${cg}:b=${cb}:a='if(between(hypot(X-W/2\,Y-H/2)\,W/2-${Math.max(3,Math.round(R*.06))}\,W/2-1)\,230\,0)'`,'-frames:v','1',ring]);
   const pts=[...op.path].sort((p,q)=>p.t-q.t),lines:string[]=[],frames=Math.ceil(info.duration*info.fps);let k=0;
   for(let f=0;f<frames;f++){const t=f/info.fps;while(k<pts.length-2&&pts[k+1]!.t<=t)k++;const a1=pts[k]!,b1=pts[Math.min(k+1,pts.length-1)]!,u=b1.t>a1.t?Math.min(1,Math.max(0,(t-a1.t)/(b1.t-a1.t))):0;
    const x=(a1.x+(b1.x-a1.x)*u)*info.width,y=(a1.y+(b1.y-a1.y)*u)*info.height;
    lines.push(`${t.toFixed(4)} overlay@dot x ${Math.round(x-D/2)}, overlay@dot y ${Math.round(y-D/2)}, overlay@ring x ${Math.round(x-R/2)}, overlay@ring y ${Math.round(y-R/2)};`);}
   const cmds=path.join(work,`cursor-${randomUUID().slice(0,6)}.txt`);await fs.writeFile(cmds,lines.join('\n')+'\n');
   const esc=cmds.replace(/\\/g,'/').replace(/:/g,'\\:').replace(/'/g,"\\'"),on=op.clicks.length?op.clicks.map(c=>`between(t,${n(c)},${n(c+.35)})`).join('+'):'0';
   await ff(['-i',input,'-loop','1','-i',dot,'-loop','1','-i',ring,'-filter_complex',`[0:v]sendcmd=f='${esc}'[s];[s][1:v]overlay@dot=x=-${D}:y=-${D}:shortest=1[a];[a][2:v]overlay@ring=x=-${R}:y=-${R}:shortest=1:enable='${on}',format=yuv420p[v]`,
    '-map','[v]',...(a?['-map','0:a']:[]),...intermediate(a,info.fps),out]);
   return {info,note:`cursor highlighted${op.clicks.length?`, ${op.clicks.length} click${op.clicks.length>1?'s':''} ringed`:''}`};}
  case 'zooms':{
   // Each zoom eases in and out (smoothstep over the ramp's seconds); between zooms the frame is whole.
   const ramp=op.ramp,sm=(u:string)=>`(${u})*(${u})*(3-2*(${u}))`,ease=(z:{start:number;end:number})=>{const r=Math.min(ramp,(z.end-z.start)/2);return `${sm(`clip((it-${n(z.start)})/${n(r)},0,1)`)}*${sm(`clip((${n(z.end)}-it)/${n(r)},0,1)`)}`;};
   const items=op.items.filter(z=>z.start<info.duration),Z='1'+items.map(z=>`+${n(z.scale-1)}*${ease(z)}`).join('');
   const cx='0.5'+items.map(z=>`+${n(z.x-.5)}*${ease(z)}`).join(''),cy='0.5'+items.map(z=>`+${n(z.y-.5)}*${ease(z)}`).join('');
   const fe=(s:string)=>s.replace(/,/g,'\\,');
   await vf(`zoompan=z='${fe(Z)}':x='${fe(`clip((${cx})*iw-iw/zoom/2,0,iw-iw/zoom)`)}':y='${fe(`clip((${cy})*ih-ih/zoom/2,0,ih-ih/zoom)`)}':d=1:s=${info.width}x${info.height}:fps=${n(info.fps)},setsar=1`);
   return {info,note:`${items.length} zoom${items.length>1?'s':''} in and out`};}
  case 'blur':{
   // Up to 12 areas a pass: each is cut out, blurred and laid back where it is at that moment.
   let cur=input;const all=op.regions,strength=op.strength,batches=Math.ceil(all.length/12);
   for(let b0=0;b0<batches;b0++){
    const rs=all.slice(b0*12,b0*12+12),last=b0===batches-1,dst=last?out:path.join(work,`blur-${randomUUID().slice(0,8)}.mp4`),cmds:string[]=[],frames=Math.ceil(info.duration*info.fps);
    const box=rs.map(r=>({W:Math.min(even(Math.max(...r.keys.map(k=>k.w))*info.width),even(info.width)),H:Math.min(even(Math.max(...r.keys.map(k=>k.h))*info.height),even(info.height))}));
    const at=(r:typeof rs[number],t:number)=>{const ks=[...r.keys].sort((p,q)=>p.t-q.t);let k=0;while(k<ks.length-2&&ks[k+1]!.t<=t)k++;const a1=ks[k]!,b1=ks[Math.min(k+1,ks.length-1)]!,u=b1.t>a1.t?Math.min(1,Math.max(0,(t-a1.t)/(b1.t-a1.t))):0;
     return {cx:(a1.x+a1.w/2+((b1.x+b1.w/2)-(a1.x+a1.w/2))*u)*info.width,cy:(a1.y+a1.h/2+((b1.y+b1.h/2)-(a1.y+a1.h/2))*u)*info.height};};
    for(let f=0;f<frames;f++){const t=f/info.fps,parts:string[]=[];
     rs.forEach((r,k)=>{if(t<r.start-.05||t>r.end+.05)return;const {cx,cy}=at(r,t),X=Math.round(Math.min(info.width-box[k]!.W,Math.max(0,cx-box[k]!.W/2))),Y=Math.round(Math.min(info.height-box[k]!.H,Math.max(0,cy-box[k]!.H/2)));
      parts.push(`crop@c${k} x ${X}, crop@c${k} y ${Y}, overlay@o${k} x ${X}, overlay@o${k} y ${Y}`);});
     if(parts.length)cmds.push(`${t.toFixed(4)} ${parts.join(', ')};`);}
    const file=path.join(work,`blur-${randomUUID().slice(0,8)}.txt`);await fs.writeFile(file,(cmds.join('\n')||'0.0 crop@c0 x 0;')+'\n');
    const esc=file.replace(/\\/g,'/').replace(/:/g,'\\:').replace(/'/g,"\\'");
    let g=`[0:v]sendcmd=f='${esc}',split=${rs.length+1}[b]${rs.map((_,k)=>`[c${k}]`).join('')};`,lastL='b';
    rs.forEach((r,k)=>{const sigma=Math.max(6,Math.round(Math.min(box[k]!.W,box[k]!.H)*.3*strength));
     g+=`[c${k}]crop@c${k}=w=${box[k]!.W}:h=${box[k]!.H}:x=0:y=0,gblur=sigma=${sigma}:steps=3[g${k}];[${lastL}][g${k}]overlay@o${k}=x=0:y=0:enable='between(t,${n(r.start)},${n(r.end)})'${k===rs.length-1?',format=yuv420p':''}[l${k}];`;lastL=`l${k}`;});
    await ff(['-i',cur,'-filter_complex',g.slice(0,-1),'-map',`[${lastL}]`,...(a?['-map','0:a']:[]),...intermediate(a,info.fps),dst]);cur=dst;}
   const kinds=['face','plate','phone','you'].map(k=>[k,all.filter(r=>r.kind===k).length] as const).filter(([,c])=>c).map(([k,c])=>`${c} ${k==='you'?'area':k}${c>1?'s':''}`);
   return {info,note:`blurred: ${kinds.join(', ')}`};}
  case 'steady':{
   const before=await measureShake(input),filter=await steadyFilter(input,work,op.smoothing);await vf(filter);const after=await measureShake(out);
   return {info,note:`steadied: shake ${before.shake} → ${after.shake}${before.verdict==='too-shaky'?` (${before.why})`:''}`};}
  case 'arrange':{
   const ranges=op.segments.map(r=>({start:Math.min(r.start,info.duration),end:Math.min(r.end,info.duration)})).filter(r=>r.end-r.start>.001);
   if(!ranges.length)throw new Error('arrange: no part of the clip is inside it');
   await ff(['-i',input,'-filter_complex',segmentGraph(ranges,a,info.fps),'-map','[v]',...(a?['-map','[a]']:[]),...intermediate(a,info.fps),out]);
   return {info:{...info,duration:ranges.reduce((t,r)=>t+r.end-r.start,0)},note:`${ranges.length} parts`};}
  case 'zoom':{
   const s=Math.min(op.start,info.duration),e=Math.min(op.end??info.duration,info.duration);if(e<=s)throw new Error('zoom: end must be after start');
   const r=Math.min(op.ramp,(e-s)/2),Z=n(op.scale),t='it';
   const z=r>0?`if(lt(${t},${n(s)}),1,if(lt(${t},${n(s+r)}),1+(${Z}-1)*(${t}-${n(s)})/${n(r)},if(lt(${t},${n(e-r)}),${Z},if(lt(${t},${n(e)}),1+(${Z}-1)*(${n(e)}-${t})/${n(r)},1))))`:`if(between(${t},${n(s)},${n(e)}),${Z},1)`;
   await vf(`zoompan=z='${z}':x='${n(op.focusX)}*(iw-iw/zoom)':y='${n(op.focusY)}*(ih-ih/zoom)':d=1:s=${info.width}x${info.height}:fps=${n(info.fps)},setsar=1`);break;}
  case 'punch':{
   const ranges=op.ranges.map(r=>({s:Math.min(r.start,info.duration),e:Math.min(r.end,info.duration),k:r.scale-1})).filter(r=>r.e>r.s&&r.k>0);
   if(!ranges.length)return {info,note:'no ranges inside the video'};
   const z='1'+ranges.map(r=>`+${n(r.k)}*between(it,${n(r.s)},${n(r.e)})`).join('');
   await vf(`zoompan=z='${z}':x='${n(op.focusX)}*(iw-iw/zoom)':y='${n(op.focusY)}*(ih-ih/zoom)':d=1:s=${info.width}x${info.height}:fps=${n(info.fps)},setsar=1`);
   return {info,note:`${ranges.length} punch-ins`};}
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
   // The sound ends with the picture (loudnorm's resampling would otherwise leave it a little longer).
   await ff(['-i',input,'-c:v','copy','-af',second+`,aresample=48000,atrim=duration=${n(info.duration)}`,'-c:a','aac','-b:a','256k',out]);
   return {info,note:stats?'two-pass loudness normalization':'single-pass loudness normalization'};}
  case 'resize':{
   const w=even(op.width),h=even(op.height),c=op.color.slice(0,7);
   const f=op.mode==='pad'?`scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=${c}`:op.mode==='crop'?`scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`:`scale=${w}:${h}`;
   await vf(f+',setsar=1');return {info:{...info,width:w,height:h}};}
  case 'brand':{
   let current=input,notes:string[]=[];
   if(op.watermark){
    const {logo}=await brandAssets(op.logo);
    const png=await logoPng(logo,info.width*op.width,path.join(work,'brand-logo-'+randomUUID().slice(0,8)+'.png'));
    const bytes=await fs.readFile(png),lw=bytes.readUInt32BE(16),lh=bytes.readUInt32BE(20);
    const left=op.position.endsWith('left'),top=op.position.startsWith('top');
    let mx=info.width*op.margin,my=Math.max(info.height*op.margin,mx);
    // On a vertical video the logo stays out of the platforms' top bar and side buttons.
    if(op.safeArea&&isVertical(info.width,info.height)){const m=margins();const side=left?m.left:m.right;const nx=Math.max(mx,info.width*(side+.015)),ny=Math.max(my,info.height*((top?m.top:m.bottom)+.01));if(nx!==mx||ny!==my)notes.push('watermark moved clear of the platforms\' buttons');mx=nx;my=ny;}
    const x=(left?mx+lw/2:info.width-mx-lw/2)/info.width,y=(top?my+lh/2:info.height-my-lh/2)/info.height;
    const marked=op.endCard?path.join(work,'brand-marked-'+randomUUID().slice(0,8)+'.mp4'):out;
    await applyOperation({op:'overlay',file:png,start:0,x,y,width:lw/info.width,opacity:op.opacity,loop:false},current,info,marked,base,work);
    current=marked;notes.push(`watermark ${op.position}`);
   }
   if(op.endCard){
    const card=await endCard({width:info.width,height:info.height,fps:info.fps,duration:op.endCardDuration,text:op.endCardText,logo:op.logo,out:path.join(work,'brand-endcard-'+randomUUID().slice(0,8)+'.mp4')});
    const r=await applyOperation({op:'concat',files:[card],position:'after'},current,info,out,base,work);
    notes.push(`end card ${op.endCardDuration} s`);
    return {info:r.info,note:notes.join(', ')};
   }
   return {info,note:notes.join(', ')};}
  case 'music':{
   const file=path.resolve(base,op.file);await fs.access(file);
   const end=Math.min(info.duration,op.end??info.duration),len=Math.max(.1,end-op.start);
   const ms=Math.round(op.start*1000);
   const music=`[1:a]atrim=start=${n(op.offset)}:duration=${n(len)},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,volume=${n(op.gainDb)}dB`+
    (op.fadeIn>0?`,afade=t=in:st=0:d=${n(Math.min(op.fadeIn,len/2))}`:'')+(op.fadeOut>0?`,afade=t=out:st=${n(Math.max(0,len-op.fadeOut))}:d=${n(Math.min(op.fadeOut,len/2))}`:'')+
    `,adelay=${ms}|${ms},apad=whole_dur=${n(info.duration)}[m]`;
   // Ratio from the requested depth: about duckDb of reduction while the voice is above the threshold.
   const ratio=Math.max(2,Math.min(20,Math.pow(10,op.duckDb/12)));
   const graph=!a?`${music};[m]atrim=0:${n(info.duration)}[a]`
    :op.duck?`${music};[0:a]aresample=48000,aformat=channel_layouts=stereo,asplit=2[voice][key];[m][key]sidechaincompress=threshold=0.015:ratio=${n(ratio)}:attack=20:release=450:knee=4[ducked];[voice][ducked]amix=inputs=2:duration=first:normalize=0[a]`
    :`${music};[0:a]aresample=48000,aformat=channel_layouts=stereo[voice];[voice][m]amix=inputs=2:duration=first:normalize=0[a]`;
   await ff(['-i',input,...(op.loop?['-stream_loop','-1']:[]),'-i',file,'-filter_complex',graph,'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','256k','-ar','48000','-t',n(info.duration),out]);
   return {info:{...info,hasAudio:true},note:`${path.basename(file)} at ${n(op.gainDb)} dB`+(a&&op.duck?`, lowered about ${n(op.duckDb)} dB under speech`:a?'':', footage had no sound')};}
  case 'overlay':{
   const file=path.resolve(base,op.file);await fs.access(file);
   const still=/\.(png|jpe?g|webp|bmp)$/i.test(file);
   const own=still?null:await mediaInfo(file).catch(()=>null);
   const end=Math.min(info.duration,op.end??(still||op.loop?info.duration:op.start+(own?.duration??info.duration)));
   const w=even(info.width*op.width),x=n(info.width*op.x),y=n(info.height*op.y);
   // FFmpeg's built-in VP9 decoder drops transparency; libvpx keeps it.
   const decoder=/\.webm$/i.test(file)?['-c:v','libvpx-vp9']:[];
   const source=still?['-loop','1','-i',file]:[...(op.loop?['-stream_loop','-1']:[]),...decoder,'-i',file];
   const fade=op.opacity<1?`,colorchannelmixer=aa=${n(op.opacity)}`:'';
   const graph=`[1:v]scale=${w}:-2,format=rgba${fade},setpts=PTS-STARTPTS+${n(op.start)}/TB[o];`+
    `[0:v][o]overlay=x=${x}-w/2:y=${y}-h/2:eof_action=pass:enable='between(t,${n(op.start)},${n(end)})',format=yuv420p[v]`;
   await ff(['-i',input,...source,'-filter_complex',graph,'-map','[v]',...(a?['-map','0:a','-c:a','copy']:['-an']),'-t',n(info.duration),'-r',n(info.fps),'-c:v','libx264','-preset','veryfast','-crf','14','-pix_fmt','yuv420p',out]);
   return {info,note:`${path.basename(file)} from ${n(op.start)} to ${n(end)} s`};}
  case 'overlays':{
   const items=await Promise.all(op.items.map(async o=>{const file=path.resolve(base,o.file);await fs.access(file);const still=/\.(png|jpe?g|webp|bmp)$/i.test(file);
    const own=still?null:await mediaInfo(file).catch(()=>null);return {...o,file,still,end:Math.min(info.duration,o.end??(still?info.duration:o.start+(own?.duration??info.duration)))};}));
   let graph='',last='0:v';
   items.forEach((o,i)=>{const w=even(info.width*o.width),next=i===items.length-1?'v':'o'+i;
    graph+=`${graph?';':''}[${i+1}:v]scale=${w}:-2,format=rgba,setpts=PTS-STARTPTS+${n(o.start)}/TB[s${i}];[${last}][s${i}]overlay=x=${n(info.width*o.x)}-w/2:y=${n(info.height*o.y)}-h/2:eof_action=pass:enable='between(t,${n(o.start)},${n(o.end)})'${next==='v'?',format=yuv420p':''}[${next}]`;last=next;});
   const sources=items.flatMap(o=>o.still?['-loop','1','-i',o.file]:[...(/\.webm$/i.test(o.file)?['-c:v','libvpx-vp9']:[]),'-i',o.file]);
   await ff(['-i',input,...sources,'-filter_complex',graph,'-map','[v]',...(a?['-map','0:a','-c:a','copy']:['-an']),'-t',n(info.duration),'-r',n(info.fps),'-c:v','libx264','-preset','veryfast','-crf','14','-pix_fmt','yuv420p',out]);
   return {info,note:`${items.length} overlays`};}
  case 'captions':{
   // On a vertical video the captions sit just above where the platforms draw their own captions and buttons.
   let moved='';if(op.safeArea&&isVertical(info.width,info.height)){const m=margins(),need=op.position==='bottom'?captionMargin(m):op.position==='top'?+(m.top+.02).toFixed(3):0;if(need>op.margin){moved=`, moved clear of the platforms' buttons (${Math.round(op.margin*100)}% to ${Math.round(need*100)}% from the ${op.position})`;op={...op,margin:need};}}
   const cues=op.cues??parseSrt(await fs.readFile(path.resolve(base,op.srt!),'utf8'));
   const dir=path.join(work,'captions-'+randomUUID().slice(0,8));await fs.mkdir(dir,{recursive:true});
   // A styled look (words following the speech, a key word lit, a way of coming in) is one picture track.
   if(op.style!=='phrase'||op.reveal!=='none'||op.keyword||op.upper){
    const tr=await renderCaptionTrack(cues,op,{width:info.width,height:info.height},dir,info.fps,info.duration);
    await ff(['-i',input,'-f','concat','-safe','0','-i',tr.list,'-filter_complex','[1:v]format=rgba[c];[0:v][c]overlay=0:0:eof_action=pass,format=yuv420p[v]','-map','[v]',...(a?['-map','0:a','-c:a','copy']:['-an']),'-r',n(info.fps),'-c:v','libx264','-preset','veryfast','-crf','14','-pix_fmt','yuv420p',out]);
    return {info,note:`${cues.length} captions (${op.style}${op.keyword?', key word lit':''}${op.reveal!=='none'?`, ${op.reveal} in`:''}), ${tr.language}, font ${path.basename(tr.font)}${moved}`};}
   const {files,font,language}=await renderCaptionImages(cues,op,{width:info.width,height:info.height},dir);
   let graph='',last='0:v';
   cues.forEach((c,i)=>{const next=i===cues.length-1?'v':'c'+i;graph+=`${graph?';':''}[${last}][${i+1}:v]overlay=0:0:enable='between(t,${n(c.start)},${n(c.end)})'[${next}]`;last=next;});
   await ff(['-i',input,...files.flatMap(f=>['-i',f]),'-filter_complex',graph,'-map','[v]',...(a?['-map','0:a','-c:a','copy']:['-an']),'-r',n(info.fps),'-c:v','libx264','-preset','veryfast','-crf','14','-pix_fmt','yuv420p',out]);
   return {info,note:`${cues.length} captions, ${language}, font ${path.basename(font)}${moved}`};}
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
 const inputs=[input,...edl.operations.flatMap(o=>o.op==='concat'?o.files.map(f=>path.resolve(base,f)):o.op==='overlay'||o.op==='music'?[path.resolve(base,o.file)]:o.op==='overlays'?o.items.map(x=>path.resolve(base,x.file)):[])];
 if(inputs.some(f=>path.resolve(f)===output))throw new Error('Output must not be one of the inputs');
 await fs.access(output).then(()=>{throw new Error('Output already exists; Tempoloom never overwrites exports: '+output);},()=>{});
 const work=path.join(ROOT,'workspace','cache','editor',new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,6));
 await fs.mkdir(work,{recursive:true});
 const steps:Step[]=[];let resume='';
 try{
  let current=input,info=await mediaInfo(input);
  // Each finished step is kept until the edit is exported, so an edit that stopped continues from
  // its last finished step: the same input and the same steps before it give the same result.
  const stamp=async(f:string)=>{const st=await fs.stat(f).catch(()=>null);return st?`${path.resolve(f)}:${st.size}:${st.mtimeMs}`:path.resolve(f);};
  let key=createHash('sha256').update(await stamp(input)).digest('hex');
  resume=path.join(ROOT,'workspace','cache','editor','resume',key.slice(0,24));await fs.mkdir(resume,{recursive:true});
  let reused=0;
  for(const [i,op] of edl.operations.entries()){
   const refs=op.op==='concat'?op.files:op.op==='overlay'||op.op==='music'?[op.file]:op.op==='overlays'?op.items.map(x=>x.file):[];
   key=createHash('sha256').update(key+JSON.stringify(op)+(await Promise.all(refs.map(f=>stamp(path.resolve(base,f))))).join('|')).digest('hex');
   const kept=path.join(resume,key.slice(0,32)+'.mp4'),meta=path.join(resume,key.slice(0,32)+'.json');
   const was=await fs.readFile(meta,'utf8').then(x=>JSON.parse(x) as {made:boolean;hasAudio:boolean;note?:string},()=>null);
   if(was&&(!was.made||await fs.access(kept).then(()=>true,()=>false))){
    reused++;if(was.made){current=kept;info={...(await mediaInfo(kept)),hasAudio:was.hasAudio};}
    steps.push({op:op.op,output:current,info,...(was.note?{note:was.note}:{})});continue;}
   const out=path.join(work,`step-${String(i+1).padStart(2,'0')}-${op.op}.mp4`);
   const r=await applyOperation(op,current,info,out,base,work);
   const exists=await fs.access(out).then(()=>true,()=>false);
   if(exists){await fs.copyFile(out,kept+'.part');await fs.rename(kept+'.part',kept);current=kept;info={...(await mediaInfo(kept)),hasAudio:r.info.hasAudio};}
   await fs.writeFile(meta,JSON.stringify({made:exists,hasAudio:r.info.hasAudio,...(r.note?{note:r.note}:{})}));
   steps.push({op:op.op,output:current,info,note:r.note});
  }
  if(reused)console.error(`Continued the edit from step ${reused+1}: ${reused} step${reused>1?'s':''} finished before.`);
  const p=exportPresets[edl.export.preset];
  await fs.mkdir(path.dirname(output),{recursive:true});
  await run(ffmpeg,['-hide_banner','-loglevel','error','-n','-i',current,'-c:v','libx264','-preset',p.preset,'-crf',String(p.crf),'-pix_fmt','yuv420p',
   ...(info.hasAudio?['-c:a','aac','-b:a',p.audioBitrate,'-ar','48000']:['-an']),'-movflags','+faststart',output]);
  const final=await mediaInfo(output);
  const receipt=output.replace(/\.mp4$/i,'')+'.edit.json';
  const summary=steps.map(s=>({op:s.op,note:s.note,width:s.info.width,height:s.info.height,fps:s.info.fps,duration:Number(s.info.duration.toFixed(3))}));
  await fs.writeFile(receipt,JSON.stringify({version:1,createdAt:new Date().toISOString(),input,output,edl,steps:summary,final},null,2)+'\n',{flag:'wx'});
  await fs.rm(resume,{recursive:true,force:true});
  return {output,receipt,steps:summary,info:final};
 }catch(e){
  const left=resume?(await fs.readdir(resume).catch(()=>[])).filter(n=>n.endsWith('.json')).length:0;
  if(left&&e instanceof Error)e.message+=` (${left} finished step${left>1?'s are':' is'} kept: run the same edit again to continue from there)`;throw e;
 }finally{await fs.rm(work,{recursive:true,force:true});}
}
