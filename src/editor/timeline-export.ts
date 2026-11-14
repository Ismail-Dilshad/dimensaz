// Export to an editor: an edit list becomes a timeline another editor opens, with the source clips
// cut where the edit cuts them, so the user can keep working there. Premiere Pro and DaVinci Resolve
// read Final Cut Pro 7 XML (xmeml); Final Cut Pro and Resolve read FCPXML; nearly every editor reads
// a CMX 3600 EDL (one picture track). Captions go with it as SubRip. CapCut cannot open a timeline
// from another editor, so it gets the clips and the captions file only. What only a render can make
// (a steady picture, blur, captions burned in, a reframe) is listed, not imitated.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {edlSchema,aspectSizes,type Operation} from './edl.js';
import {mediaInfo} from './editor.js';
import {probe} from '../renderer/ffmpeg-encoder.js';
import {parseSrt,writeSrt} from './srt.js';

type Cue={start:number;end:number;text:string};
type Seg={file:string;in:number;out:number;speed:number};
type Item={kind:'overlay'|'music';file:string;start:number;end:number;srcIn:number;width?:number;x?:number;y?:number;opacity?:number;gainDb?:number;still?:boolean};
export type Timeline={name:string;width:number;height:number;fps:number;segments:Seg[];items:Item[];cues:Cue[];renderOnly:string[];notes:string[];files:Record<string,{duration:number;width?:number;height?:number;audio:boolean;still:boolean}>};
export const targets=['premiere','resolve','fcp','edl','capcut'] as const;
export type Target=typeof targets[number];

const IMAGE=/\.(png|jpe?g|webp|gif|svg)$/i;
const length=(s:Seg[])=>s.reduce((t,x)=>t+(x.out-x.in)/x.speed,0);
/** The parts of the timeline in [a,b), as segments of their sources. */
function slice(segs:Seg[],a:number,b:number){const out:Seg[]=[];let t=0;
 for(const s of segs){const d=(s.out-s.in)/s.speed,lo=Math.max(a,t),hi=Math.min(b,t+d);
  if(hi-lo>1e-6)out.push({...s,in:s.in+(lo-t)*s.speed,out:s.in+(hi-t)*s.speed});t+=d;}
 return out;}
/** Keeps these ranges of the timeline in this order; what lay on top of them moves with them. */
function keep(tl:Timeline,ranges:{start:number;end:number}[]){
 const segs:Seg[]=[],items:Item[]=[],cues:Cue[]=[];let at=0;
 for(const r of ranges){const shift=at-r.start;segs.push(...slice(tl.segments,r.start,r.end));
  for(const it of tl.items){const lo=Math.max(it.start,r.start),hi=Math.min(it.end,r.end);if(hi-lo>1e-3)items.push({...it,start:lo+shift,end:hi+shift,srcIn:it.srcIn+(lo-it.start)});}
  for(const c of tl.cues){const lo=Math.max(c.start,r.start),hi=Math.min(c.end,r.end);if(hi-lo>.05)cues.push({...c,start:lo+shift,end:hi+shift});}
  at+=r.end-r.start;}
 tl.segments=segs;tl.items=items;tl.cues=cues;}

const ONLY_RENDER:Partial<Record<Operation['op'],string>>={steady:'the steady picture',blur:'the blur',reframe:'the reframe (use the editor\'s own auto reframe)',crop:'the crop',resize:'the resize',
 zoom:'the zoom',punch:'the punch-ins',zooms:'the screen zooms',cursor:'the cursor highlight',fade:'the fades',volume:'the volume change',loudness:'the loudness levelling',
 sounds:'the sound design layer',brand:'the logo and end card',loop:'the loop crossfade'};

/** Reads an edit list into a timeline of its sources (paths relative to `base`). */
export async function timelineOf(edlInput:unknown,base:string,o:{name?:string}={}):Promise<Timeline>{
 const edl=edlSchema.parse(edlInput),input=path.resolve(base,edl.input),files:Timeline['files']={};
 const info=async(f:string)=>{if(!files[f]){if(IMAGE.test(f))files[f]={duration:0,audio:false,still:true};else{const p=await probe(f),v=(p.streams as {codec_type:string;width?:number;height?:number}[]).find(x=>x.codec_type==='video');
  files[f]={duration:Number(p.format?.duration)||0,...(v?{width:Number(v.width),height:Number(v.height)}:{}),audio:(p.streams as {codec_type:string}[]).some(x=>x.codec_type==='audio'),still:false};}}return files[f]!;};
 const src=await mediaInfo(input);files[input]={duration:src.duration,width:src.width,height:src.height,audio:src.hasAudio,still:false};
 const tl:Timeline={name:o.name??path.basename(input,path.extname(input)),width:src.width,height:src.height,fps:src.fps,segments:[{file:input,in:0,out:src.duration,speed:1}],items:[],cues:[],renderOnly:[],notes:[],files};
 for(const op of edl.operations){const total=length(tl.segments);
  switch(op.op){
   case 'trim':keep(tl,[{start:op.start,end:Math.min(total,op.end??total)}]);break;
   case 'cut':{const rs=[...op.ranges].sort((a,b)=>a.start-b.start),k:{start:number;end:number}[]=[];let t=0;for(const r of rs){if(r.start>t)k.push({start:t,end:Math.min(r.start,total)});t=Math.max(t,r.end);}if(t<total)k.push({start:t,end:total});keep(tl,k);break;}
   case 'split':{const at=[0,...[...op.at].sort((a,b)=>a-b).filter(x=>x>0&&x<total),total],parts=at.slice(1).map((e,i)=>({start:at[i]!,end:e}));keep(tl,(op.keep??parts.map((_,i)=>i)).map(i=>parts[i]).filter((p):p is {start:number;end:number}=>!!p));break;}
   case 'arrange':keep(tl,op.segments.map(s=>({start:s.start,end:Math.min(s.end,total)})).filter(s=>s.end>s.start));break;
   case 'speed':tl.segments=tl.segments.map(s=>({...s,speed:s.speed*op.factor}));tl.items=tl.items.map(i=>({...i,start:i.start/op.factor,end:i.end/op.factor}));tl.cues=tl.cues.map(c=>({...c,start:c.start/op.factor,end:c.end/op.factor}));break;
   case 'concat':{const add:Seg[]=[];for(const f of op.files){const p=path.resolve(base,f),m=await info(p);add.push({file:p,in:0,out:m.duration,speed:1});}
    if(op.position==='before'){const d=length(add);tl.segments=[...add,...tl.segments];tl.items=tl.items.map(i=>({...i,start:i.start+d,end:i.end+d}));tl.cues=tl.cues.map(c=>({...c,start:c.start+d,end:c.end+d}));}
    else tl.segments.push(...add);break;}
   case 'overlay':case 'overlays':{const list=op.op==='overlay'?[op]:op.items;
    for(const it of list){const p=path.resolve(base,it.file),m=await info(p),loop=op.op==='overlay'&&op.loop;
     const end=Math.min(total,it.end??(m.still||loop?total:it.start+m.duration));if(end-it.start<.04)continue;
     if(loop&&!m.still&&end-it.start>m.duration+.05)tl.notes.push(`${path.basename(p)} loops in the render; the timeline plays it once.`);
     tl.items.push({kind:'overlay',file:p,start:it.start,end:m.still||loop?end:Math.min(end,it.start+m.duration),srcIn:0,width:it.width,x:it.x,y:it.y,...(op.op==='overlay'?{opacity:op.opacity}:{}),still:m.still});}
    break;}
   case 'music':{const p=path.resolve(base,op.file),m=await info(p),end=Math.min(total,op.end??total),play=Math.min(end-op.start,Math.max(0,m.duration-op.offset));
    if(play>.1)tl.items.push({kind:'music',file:p,start:op.start,end:op.start+play,srcIn:op.offset,gainDb:op.gainDb});
    if(end-op.start>play+.1)tl.notes.push(`The music loops in the render; the timeline plays ${path.basename(p)} once.`);
    if(op.duck)tl.notes.push('The music is lowered under speech only in the render; in the editor, duck it there (for example Premiere\'s Auto Ducking, Resolve\'s Ducking).');break;}
   case 'captions':{const cues=op.cues??parseSrt(await fs.readFile(path.resolve(base,op.srt!),'utf8'));tl.cues.push(...cues.map(c=>({start:c.start,end:c.end,text:c.text})));break;}
   default:{const what=ONLY_RENDER[op.op]??`the ${op.op} step`;if(!tl.renderOnly.includes(what))tl.renderOnly.push(what);
    if(op.op==='reframe'||op.op==='resize'){const [w,h]=op.op==='reframe'?(op.width&&op.height?[op.width,op.height]:aspectSizes[op.aspect]):[op.width,op.height];tl.width=w;tl.height=h;}}
  }}
 tl.cues.sort((a,b)=>a.start-b.start);
 return tl;}

// ---------- time ----------
/** A frame rate as editors write it: 24, 25, 30, 50, 60, or 23.976/29.97/59.94 as NTSC. */
function rate(fps:number){const ntsc=[23.976,29.97,59.94].find(r=>Math.abs(fps-r)<.01);const base=ntsc?Math.round(ntsc):Math.round(fps);return {base,ntsc:!!ntsc,num:ntsc?1001:100,den:ntsc?base*1000:base*100};}
const F=(t:number,fps:number)=>Math.round(t*fps+1e-6);
/** FCPXML time: a whole number of frames as a fraction of a second. */
const R=(frames:number,r:ReturnType<typeof rate>)=>frames===0?'0s':`${frames*r.num}/${r.den}s`;
const tc=(frames:number,base:number)=>{const ff=frames%base,s=Math.floor(frames/base);return [Math.floor(s/3600),Math.floor(s/60)%60,s%60,ff].map(n=>String(n).padStart(2,'0')).join(':');};
const x=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const url=(f:string)=>pathToFileURL(f).href.replace(/^file:\/\//,'file://localhost');

// ---------- Final Cut Pro 7 XML (Premiere Pro, DaVinci Resolve) ----------
export function toXmeml(tl:Timeline){
 const r=rate(tl.fps),fr=(t:number)=>F(t,r.base*(r.ntsc?1000/1001:1)),rt=`<rate><timebase>${r.base}</timebase><ntsc>${r.ntsc?'TRUE':'FALSE'}</ntsc></rate>`;
 const ids=new Map<string,string>(),seen=new Set<string>();
 const fileEl=(f:string)=>{if(!ids.has(f))ids.set(f,`file-${ids.size+1}`);const id=ids.get(f)!;if(seen.has(id))return `<file id="${id}"/>`;seen.add(id);const m=tl.files[f]!;
  return `<file id="${id}"><name>${x(path.basename(f))}</name><pathurl>${x(url(f))}</pathurl>${rt}<duration>${m.still?fr(tl.files[Object.keys(tl.files)[0]!]!.duration):fr(m.duration)}</duration><media>${m.still||m.width?`<video><samplecharacteristics>${rt}<width>${m.width??tl.width}</width><height>${m.height??tl.height}</height></samplecharacteristics></video>`:''}${m.audio?`<audio><samplecharacteristics><depth>16</depth><samplerate>48000</samplerate></samplecharacteristics><channelcount>2</channelcount></audio>`:''}</media></file>`;};
 let n=0;const clip=(name:string,f:string,start:number,end:number,inF:number,outF:number,extra='',media:'video'|'audio'='video')=>{const m=tl.files[f]!;
  return `<clipitem id="clipitem-${++n}"><name>${x(name)}</name><enabled>TRUE</enabled><duration>${m.still?end-start:fr(m.duration)}</duration>${rt}<start>${start}</start><end>${end}</end><in>${inF}</in><out>${outF}</out>${fileEl(f)}${media==='audio'?'<sourcetrack><mediatype>audio</mediatype><trackindex>1</trackindex></sourcetrack>':''}${extra}</clipitem>`;};
 // Picture and its sound on the first tracks, in order.
 let t=0;const v1:string[]=[],a1:string[]=[];
 for(const s of tl.segments){const d=(s.out-s.in)/s.speed,a=fr(t),b=fr(t+d);if(b>a){const name=path.basename(s.file);
  v1.push(clip(name,s.file,a,b,fr(s.in),fr(s.in)+(b-a)));
  if(tl.files[s.file]!.audio)a1.push(clip(name,s.file,a,b,fr(s.in),fr(s.in)+(b-a),'','audio'));}t+=d;}
 // Overlays above, each on its own track when they overlap; music below.
 const lanes:Item[][]=[];for(const it of tl.items.filter(i=>i.kind==='overlay')){const lane=lanes.find(l=>l.every(o=>o.end<=it.start||o.start>=it.end));if(lane)lane.push(it);else lanes.push([it]);}
 const motion=(it:Item)=>{const m=tl.files[it.file]!,w=m.width;if(!w||it.width===undefined)return '';const scale=+(it.width*tl.width/w*100).toFixed(2);
  const centred=Math.abs((it.x??.5)-.5)<.001&&Math.abs((it.y??.5)-.5)<.001;if(scale===100&&centred)return '';
  return `<filter><effect><name>Basic Motion</name><effectid>basic</effectid><effectcategory>motion</effectcategory><effecttype>motion</effecttype><mediatype>video</mediatype><parameter><parameterid>scale</parameterid><name>Scale</name><value>${scale}</value></parameter></effect></filter>`;};
 const vTracks=[v1,...lanes.map(l=>l.map(it=>clip(path.basename(it.file),it.file,fr(it.start),fr(it.end),fr(it.srcIn),fr(it.srcIn)+fr(it.end)-fr(it.start),motion(it))))];
 const music=tl.items.filter(i=>i.kind==='music').map(it=>clip(path.basename(it.file),it.file,fr(it.start),fr(it.end),fr(it.srcIn),fr(it.srcIn)+fr(it.end)-fr(it.start),'','audio'));
 const total=fr(length(tl.segments));
 return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE xmeml>\n<xmeml version="4"><sequence id="sequence-1"><name>${x(tl.name)}</name><duration>${total}</duration>${rt}<timecode>${rt}<string>00:00:00:00</string><frame>0</frame><displayformat>NDF</displayformat></timecode><media><video><format><samplecharacteristics>${rt}<width>${tl.width}</width><height>${tl.height}</height><pixelaspectratio>square</pixelaspectratio></samplecharacteristics></format>${vTracks.map(c=>`<track>${c.join('')}</track>`).join('')}</video><audio>${[a1,...(music.length?[music]:[])].map(c=>`<track>${c.join('')}</track>`).join('')}</audio></media></sequence></xmeml>\n`;
}

// ---------- FCPXML (Final Cut Pro, DaVinci Resolve) ----------
export function toFcpxml(tl:Timeline){
 const r=rate(tl.fps),fps=r.base*(r.ntsc?1000/1001:1),fr=(t:number)=>F(t,fps),T=(t:number)=>R(fr(t),r);
 const assets=[...new Set([...tl.segments.map(s=>s.file),...tl.items.map(i=>i.file)])],aid=(f:string)=>`r${assets.indexOf(f)+2}`;
 const res=assets.map(f=>{const m=tl.files[f]!;return `<asset id="${aid(f)}" name="${x(path.basename(f))}" start="0s" duration="${m.still?'0s':T(m.duration)}" hasVideo="${m.audio&&!m.width&&!m.still?0:1}" hasAudio="${m.audio?1:0}"${m.width&&!m.still?' format="r1"':''}${m.audio?' audioSources="1" audioChannels="2" audioRate="48000"':''}><media-rep kind="original-media" src="${x(pathToFileURL(f).href)}"/></asset>`;});
 // The spine: the source clips in order. Overlays and music are connected to the clip they start in.
 let t=0;const spine:{s:Seg;at:number;dur:number}[]=[];for(const s of tl.segments){const d=(s.out-s.in)/s.speed;if(fr(t+d)>fr(t))spine.push({s,at:t,dur:d});t+=d;}
 const lanes:Item[][]=[];for(const it of tl.items.filter(i=>i.kind==='overlay')){const lane=lanes.find(l=>l.every(o=>o.end<=it.start||o.start>=it.end));if(lane)lane.push(it);else lanes.push([it]);}
 const laneOf=(it:Item)=>it.kind==='music'?-1:lanes.findIndex(l=>l.includes(it))+1;
 const children=new Map<number,string[]>();
 for(const it of tl.items){const k=Math.max(0,spine.findIndex(p=>it.start>=p.at-1e-6&&it.start<p.at+p.dur-1e-6)),p=spine[k];if(!p)continue;
  // A connected clip's offset is in its parent's own time (the parent's start in its source, plus how far in).
  const off=fr(p.s.in)+(fr(it.start)-fr(p.at)),m=tl.files[it.file]!;
  const tr=it.kind==='overlay'&&it.width!==undefined&&m.width?(()=>{const sc=+(it.width!*tl.width/m.width!).toFixed(4),dx=+(((it.x??.5)-.5)*100*tl.width/tl.height).toFixed(3),dy=+((.5-(it.y??.5))*100).toFixed(3);
   return sc===1&&!dx&&!dy?'':`<adjust-transform position="${dx} ${dy}" scale="${sc} ${sc}"/>`;})():'';
  const vol=it.kind==='music'&&it.gainDb!==undefined?`<adjust-volume amount="${it.gainDb}dB"/>`:'';
  const tag=m.still?'video':'asset-clip';
  (children.get(k)??children.set(k,[]).get(k)!).push(`<${tag} ref="${aid(it.file)}" lane="${laneOf(it)}" offset="${R(off,r)}" name="${x(path.basename(it.file))}" start="${T(it.srcIn)}" duration="${R(fr(it.end)-fr(it.start),r)}"${it.kind==='music'?' audioRole="music"':''}>${tr}${vol}</${tag}>`);}
 const clips=spine.map((p,k)=>{const d=fr(p.at+p.dur)-fr(p.at),inner=(children.get(k)??[]).join('');
  return `<asset-clip ref="${aid(p.s.file)}" offset="${R(fr(p.at),r)}" name="${x(path.basename(p.s.file))}" start="${T(p.s.in)}" duration="${R(d,r)}" tcFormat="NDF">${inner}</asset-clip>`;});
 const total=R(fr(t),r);
 return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE fcpxml>\n<fcpxml version="1.10"><resources><format id="r1" name="FFVideoFormat${tl.height}p${r.base}" frameDuration="${R(1,r)}" width="${tl.width}" height="${tl.height}"/>${res.join('')}</resources><library><event name="Tempoloom"><project name="${x(tl.name)}"><sequence format="r1" duration="${total}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k"><spine>${clips.join('')}</spine></sequence></project></event></library></fcpxml>\n`;
}

// ---------- CMX 3600 EDL (one picture track and its sound) ----------
export function toCmx(tl:Timeline){
 const r=rate(tl.fps),fps=r.base*(r.ntsc?1000/1001:1),fr=(t:number)=>F(t,fps),lines=[`TITLE: ${tl.name.replace(/[^\x20-\x7e]/g,'_').slice(0,70)}`,'FCM: NON-DROP FRAME',''];
 let t=0,n=0;const reels=[...new Set(tl.segments.map(s=>s.file))];
 for(const s of tl.segments){const d=(s.out-s.in)/s.speed,a=fr(t),b=fr(t+d);if(b<=a){t+=d;continue;}
  const reel=`R${String(reels.indexOf(s.file)+1).padStart(3,'0')}`,i=fr(s.in),o=i+Math.round((b-a)*s.speed),ev=String(++n).padStart(3,'0');
  lines.push(`${ev}  ${reel.padEnd(8)} ${tl.files[s.file]!.audio?'AA/V':'V   '}  C        ${tc(i,r.base)} ${tc(o,r.base)} ${tc(a,r.base)} ${tc(b,r.base)}`);
  if(s.speed!==1)lines.push(`M2   ${reel.padEnd(8)} ${(r.base*s.speed).toFixed(1).padStart(5)}                ${tc(i,r.base)}`);
  lines.push(`* FROM CLIP NAME: ${path.basename(s.file)}`,`* SOURCE FILE: ${s.file}`,'');t+=d;}
 return lines.join('\n')+'\n';
}

const clock=(t:number)=>`${Math.floor(t/60)}:${(t%60).toFixed(2).padStart(5,'0')}`;
/** The edit as plain lines: each part of a source, where it plays. */
export function cutList(tl:Timeline){let t=0;return tl.segments.map((s,i)=>{const d=(s.out-s.in)/s.speed,line=`${i+1}. ${clock(t)} to ${clock(t+d)}: ${path.basename(s.file)} from ${clock(s.in)} to ${clock(s.out)}${s.speed!==1?` at ${s.speed}x speed`:''}`;t+=d;return line;})
 .concat(tl.items.map(it=>`On top, ${clock(it.start)} to ${clock(it.end)}: ${it.kind==='music'?'music ':''}${path.basename(it.file)}${it.kind==='overlay'&&it.width!==undefined&&it.width<1?` (${Math.round(it.width*100)}% wide, centred at ${Math.round((it.x??.5)*100)}% across, ${Math.round((it.y??.5)*100)}% down)`:''}`));}
/** Writes the timeline for an editor into a new folder: the timeline file(s), the captions, and a
 *  note of what only the render has. Never writes over anything. */
export async function exportTimeline(edlFile:string,o:{to:Target[];out?:string;name?:string}){
 const file=path.resolve(edlFile),edl=JSON.parse(await fs.readFile(file,'utf8')),tl=await timelineOf(edl,path.dirname(file),{name:o.name});
 let dir=path.resolve(o.out??file.replace(/(\.edit)?\.json$/i,'')+'-timeline');
 for(let k=2;await fs.access(dir).then(()=>true,()=>false);k++)dir=path.resolve(o.out??file.replace(/(\.edit)?\.json$/i,'')+'-timeline')+`-${k}`;
 await fs.mkdir(dir,{recursive:true});
 const safe=tl.name.replace(/[^\p{L}\p{N}._-]+/gu,'-').replace(/^-|-$/g,'')||'timeline',written:Record<string,string>={};
 const put=async(name:string,text:string)=>{const f=path.join(dir,name);await fs.writeFile(f,text,{flag:'wx'});return f;};
 const want=new Set(o.to),speeds=(edl.operations??[]).filter((x:{op:string})=>x.op==='speed') as {factor:number}[];
 // A speed change is carried by the EDL (its M2 line); the XML timelines keep the clips at their own
 // speed, so the editor's own speed control sets it (how each editor reads speed in XML differs).
 const plain=speeds.length?await timelineOf({...edl,operations:edl.operations.filter((x:{op:string})=>x.op!=='speed')},path.dirname(file),{name:o.name}):tl;
 if(want.has('premiere')||want.has('resolve'))written.premiere=written.resolve=await put(`${safe}.xml`,toXmeml(plain));
 if(want.has('fcp')||want.has('resolve'))written.fcp=await put(`${safe}.fcpxml`,toFcpxml(plain));
 if(speeds.length&&(want.has('premiere')||want.has('resolve')||want.has('fcp')))tl.notes.push(`The edit plays at ${speeds.reduce((a,b)=>a*b.factor,1)}x speed; the XML timeline is at normal speed, so set the clips' speed to ${Math.round(speeds.reduce((a,b)=>a*b.factor,1)*100)}% there (the EDL carries it).`);
 if(want.has('edl'))written.edl=await put(`${safe}.edl`,toCmx(tl));
 if(tl.cues.length)written.captions=await put(`${safe}.srt`,writeSrt(tl.cues.map(c=>({...c}))));
 const how:Record<Target,string>={premiere:`Premiere Pro: File, Import, choose ${safe}.xml (the clips are linked where they are).`,
  resolve:`DaVinci Resolve: File, Import, Timeline, choose ${safe}.xml (or ${safe}.fcpxml).`,fcp:`Final Cut Pro: File, Import, XML, choose ${safe}.fcpxml.`,
  edl:`Any editor: import ${safe}.edl, then link each reel (R001, R002...) to the source file named under it. It has one picture track; overlays and music are not in it.`,
  capcut:`CapCut cannot open a timeline from another editor. Add the clips in the order of the cut list below${tl.cues.length?`, and import ${safe}.srt (Text, Local captions)`:''}.`};
 const notes=[...o.to.map(t=>how[t]),...(tl.renderOnly.length?[`Made only in the render, not in the timeline: ${tl.renderOnly.join(', ')}.`]:[]),...tl.notes,
  ...(tl.cues.length?[`Captions are in ${safe}.srt (import it as captions or subtitles).`]:[])];
 const sources=[...new Set([...tl.segments.map(s=>s.file),...tl.items.map(i=>i.file)])];
 await put('README.txt',[`${tl.name}: a ${tl.width}x${tl.height} timeline at ${tl.fps} fps, ${length(tl.segments).toFixed(2)} s, ${tl.segments.length} clip${tl.segments.length>1?'s':''}.`,'',...notes,'','Cut list (where each part comes from, in order):',...cutList(tl),'','Source files (keep them where they are, or relink):',...sources].join('\n')+'\n');
 return {folder:dir,files:written,seconds:+length(tl.segments).toFixed(2),clips:tl.segments.length,layers:tl.items.length,captions:tl.cues.length,renderOnly:tl.renderOnly,notes,sources};
}
