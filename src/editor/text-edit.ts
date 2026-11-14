// Edit by text: footage becomes its transcript, and the edit is made by changing the words. Striking
// a sentence cuts it; fillers, long pauses and lines said more than once (all but the strongest take)
// are found and cut too, each on a list where it can be put back. The ten strongest openings are
// ranked, one can open the video; the frame can follow the speaker into a vertical shape; shots from
// the user's own clips are suggested for what is said. It all compiles to an ordinary edit list
// (edl.ts), so `pnpm tempoloom edit --edl` can run or change it.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT} from '../engine/config.js';
import type {Word} from '../engine/transcribe.js';
import {detectLanguage,type Language} from '../engine/languages.js';
import {mediaInfo,runEdl} from './editor.js';
import {planTighten} from './tighten.js';
import {captionsFromWords} from './caption-builder.js';
import {spokenWords,sentencesOf,findTakes,findHooks,type Spoken,type Sentence,type TakeGroup,type Hook} from './speech.js';
import {followPath,type FollowPoint,type TrackPoint} from './follow.js';
import {suggest,library,type Suggestion} from './broll.js';
import {aspectSizes,type Operation} from './edl.js';
import {ffmpeg,run} from '../renderer/ffmpeg-encoder.js';

export type Kind='sentence'|'words'|'filler'|'pause'|'take'|'start'|'end';
export type Removal={id:string;kind:Kind;start:number;end:number;text:string;why:string;on:boolean;by:'you'|'studio';from?:number;to?:number;sentence?:number;group?:string};
export type Aspect='9:16'|'1:1'|'4:5'|'16:9';
export type Doc={version:1;id:string;title:string;input:string;created:string;updated:string;language:Language;duration:number;width:number;height:number;
 transcript:string;job?:string;words:Spoken[];sentences:Sentence[];removals:Removal[];takes:TakeGroup[];hooks:Hook[];
 hook:{rank:number;start:number;end:number;text:string;move:boolean}|null;
 shape:{aspect:Aspect;follow:FollowPoint[]|null;note:string}|null;captions:boolean;
 broll:(Suggestion&{on:boolean})[];renders:{at:string;output:string;seconds:number}[];render?:{state:'working'|'failed';at:string;error?:string}};

const now=()=>new Date().toISOString();
export const textRoot=()=>path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','edits','text');
const dirOf=(id:string)=>{if(!/^[a-z0-9][a-z0-9-]{0,60}$/.test(id))throw new Error('Not a text edit: '+id);return path.join(textRoot(),id);};
export function readDoc(id:string):Doc{try{return JSON.parse(fs.readFileSync(path.join(dirOf(id),'doc.json'),'utf8')) as Doc;}catch{throw new Error(`No text edit "${id}". Start one: pnpm tempoloom edit text FOOTAGE`);}}
function save(d:Doc){d.updated=now();const f=path.join(dirOf(d.id),'doc.json'),tmp=f+'.tmp';fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(tmp,JSON.stringify(d)+'\n');fs.renameSync(tmp,f);return d;}
export function docs(){let names:string[]=[];try{names=fs.readdirSync(textRoot());}catch{return [];}
 return names.flatMap(n=>{try{return [readDoc(n)];}catch{return [];}}).sort((a,b)=>b.updated.localeCompare(a.updated));}
const clock=(t:number)=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const rid=(...parts:(string|number)[])=>createHash('sha1').update(parts.join('|')).digest('hex').slice(0,8);

/** Where a run of words starts and ends when it is cut: halfway into the silence around it, at most
 *  a quarter of a second, so no breath or syllable of a neighbour is lost. */
function span(d:Pick<Doc,'words'|'duration'>,from:number,to:number){
 const w=d.words,a=w[from]!,b=w[to-1]!;
 const start=from===0?0:Math.max((w[from-1]!.end+a.start)/2,a.start-.25),end=to>=w.length?d.duration:Math.min((b.end+w[to]!.start)/2,b.end+.25);
 return {start:+start.toFixed(3),end:+end.toFixed(3)};
}

/** Reads footage into a text edit: its words (a saved transcript, or ElevenLabs speech-to-text),
 *  sentences, fillers and pauses, repeated takes with the strongest kept, the ten best openings,
 *  and shots from the user's clips for what is said. */
export async function createDoc(file:string,o:{transcript?:string|{words:Word[];language?:Language};language?:Language;job?:string;title?:string}={}){
 const input=path.resolve(file),info=await mediaInfo(input);
 if(!info.hasAudio)throw new Error('This video has no sound: an edit by text follows what is said.');
 let raw:Word[],language:Language;
 if(o.transcript){const t=typeof o.transcript==='string'?JSON.parse(fs.readFileSync(path.resolve(o.transcript),'utf8')) as Word[]|{words:Word[];language?:Language}:o.transcript;
  raw=Array.isArray(t)?t:t.words;language=o.language??(!Array.isArray(t)&&t.language?t.language:detectLanguage(raw.map(w=>w.text).join(' ')));}
 else{const {transcribe}=await import('../engine/transcribe.js');const t=await transcribe(input,{language:o.language??'auto'});raw=t.words;language=t.language;}
 const base=(o.title??path.basename(input,path.extname(input))).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'edit';
 let id=`${base}-${rid(input,now()).slice(0,4)}`;for(let k=2;fs.existsSync(path.join(textRoot(),id));k++)id=`${base}-${rid(input,now(),k).slice(0,4)}`;
 const dir=dirOf(id);fs.mkdirSync(dir,{recursive:true});
 const transcript=path.join(dir,'transcript.json');fs.writeFileSync(transcript,JSON.stringify({language,words:raw})+'\n');
 const words=spokenWords(raw,language),sentences=sentencesOf(words);
 if(!words.length)throw new Error('No words were heard in this video');
 const d:Doc={version:1,id,title:o.title??path.basename(input),input,created:now(),updated:now(),language,duration:info.duration,width:info.width,height:info.height,transcript,...(o.job?{job:o.job}:{}),
  words,sentences,removals:[],takes:[],hooks:[],hook:null,shape:null,captions:true,broll:[],renders:[]};
 // Fillers, long pauses and the silence before and after: found by the same rules as the automatic edit.
 for(const c of planTighten(raw,info.duration,language).cuts)
  d.removals.push({id:'r-'+rid(c.reason,c.start),kind:c.reason,start:c.start,end:c.end,text:c.text??'',on:true,by:'studio',
   why:c.reason==='filler'?`"${c.text}", a filler`:c.reason==='pause'?`a ${(c.end-c.start+.36).toFixed(1)} s pause`:c.reason==='start'?'silence before the first word':'silence after the last word'});
 // Lines said more than once: all but the strongest take are cut, and why.
 d.takes=findTakes(sentences,words);
 for(const g of d.takes)for(const n of g.sentences)if(n!==g.best){const s=sentences[n-1]!;
  d.removals.push({id:'r-'+rid('take',n),kind:'take',...span(d,s.from,s.to),text:s.text,on:true,by:'studio',sentence:n,group:g.id,why:g.why});}
 const cutTakes=new Set(d.removals.filter(r=>r.kind==='take').map(r=>r.sentence!));
 d.hooks=findHooks(sentences,words,{skip:s=>cutTakes.has(s.n)});
 d.broll=suggest(sentences,{skip:cutTakes}).map(s=>({...s,on:false}));
 return save(d);
}

// ---------- changing it ----------
const doc=(id:string,f:(d:Doc)=>unknown)=>{const d=readDoc(id);if(d.render?.state==='working')throw new Error('The edit is being made now; change it when it is finished');const r=f(d);save(d);return r??view(d);};
/** Strikes a sentence (it is cut) or brings it back; a take the studio cut comes back the same way. */
export function cutSentence(id:string,n:number,cut:boolean){return doc(id,d=>{
 const s=d.sentences[n-1];if(!s)throw new Error(`No sentence ${n}`);
 const mine=d.removals.filter(r=>r.sentence===n&&['sentence','take'].includes(r.kind));
 if(cut){if(mine.length)for(const r of mine)r.on=true;else d.removals.push({id:'r-'+rid('sentence',n),kind:'sentence',...span(d,s.from,s.to),text:s.text,on:true,by:'you',sentence:n,from:s.from,to:s.to,why:'you struck it'});}
 else{for(const r of mine)r.on=false;for(const r of d.removals.filter(r=>r.kind==='words'&&r.from!==undefined&&r.from>=s.from&&r.to!<=s.to))r.on=false;}
});}
/** Strikes words (a run of them, by number) wherever they are. */
export function cutWords(id:string,from:number,to:number){return doc(id,d=>{
 if(!(from>=0&&to>from&&to<=d.words.length))throw new Error(`Words are numbered 0 to ${d.words.length-1}`);
 const s=d.sentences.find(x=>from>=x.from&&to<=x.to);
 if(s&&from===s.from&&to===s.to)return cutSentenceIn(d,s.n);
 d.removals.push({id:'r-'+rid('words',from,to),kind:'words',...span(d,from,to),text:d.words.slice(from,to).map(w=>w.text).join(' '),on:true,by:'you',from,to,why:'you struck it'});
});}
function cutSentenceIn(d:Doc,n:number){const s=d.sentences[n-1]!;d.removals.push({id:'r-'+rid('sentence',n),kind:'sentence',...span(d,s.from,s.to),text:s.text,on:true,by:'you',sentence:n,from:s.from,to:s.to,why:'you struck it'});}
/** Puts a cut back (off) or makes it again (on): every cut is on this list, the studio's and yours. */
export function toggle(id:string,removal:string,on:boolean){return doc(id,d=>{const r=d.removals.find(x=>x.id===removal);if(!r)throw new Error('No such cut');r.on=on;});}
/** All cuts of one kind back or on at once (every filler, every pause). */
export function toggleKind(id:string,kind:Kind,on:boolean){return doc(id,d=>{for(const r of d.removals.filter(x=>x.kind===kind))r.on=on;});}
/** Keeps another take of a line said more than once. */
export function pickTake(id:string,group:string,n:number){return doc(id,d=>{
 const g=d.takes.find(x=>x.id===group);if(!g)throw new Error('No such group of takes');if(!g.sentences.includes(n))throw new Error(`Sentence ${n} is not a take of this line`);
 g.best=n;g.why=`You chose take ${g.sentences.indexOf(n)+1} of ${g.sentences.length}`;
 for(const m of g.sentences){let r=d.removals.find(x=>x.kind==='take'&&x.sentence===m);const s=d.sentences[m-1]!;
  if(!r&&m!==n){r={id:'r-'+rid('take',m),kind:'take',...span(d,s.from,s.to),text:s.text,on:true,by:'you',sentence:m,group:g.id,why:g.why};d.removals.push(r);}
  if(r){r.on=m!==n;r.why=g.why;}}
});}
/** Opens the video with one of the ranked hooks (played first, and still in its place unless `move`). */
export function setHook(id:string,rank:number|null,move=false){return doc(id,d=>{
 if(rank===null){d.hook=null;return;}const h=d.hooks.find(x=>x.rank===rank);if(!h)throw new Error(`No hook ${rank}`);
 d.hook={rank,start:+Math.max(0,h.start-.08).toFixed(3),end:+Math.min(d.duration,h.end+.15).toFixed(3),text:h.text,move};
});}
export function setCaptions(id:string,on:boolean){return doc(id,d=>{d.captions=on;});}
export function setBroll(id:string,sentence:number,on:boolean){return doc(id,d=>{const b=d.broll.find(x=>x.sentence===sentence);if(!b)throw new Error('No b-roll suggestion for that sentence');b.on=on;});}
/** Suggests b-roll again (after clips were added or described). Accepted ones stay. */
export function refreshBroll(id:string){return doc(id,d=>{const keep=d.broll.filter(b=>b.on),skip=new Set([...d.removals.filter(r=>r.on&&r.sentence).map(r=>r.sentence!),...keep.map(b=>b.sentence)]);
 d.broll=[...keep,...suggest(d.sentences,{skip}).map(s=>({...s,on:false}))].sort((a,b)=>a.sentence-b.sentence);});}

/** The crop's size as fractions of the frame, for a shape. */
export function cropOf(w:number,h:number,aspect:Aspect){const [aw,ah]=aspect.split(':').map(Number) as [number,number],a=aw/ah;return w/h>a?{w:h*a/w,h:1}:{w:1,h:(w/a)/h};}
/** The shape of the result. Narrower than the footage, the crop follows the speaker's face when the
 *  media tools can see it (or a track is given), else it is centred. */
export async function setShape(id:string,aspect:Aspect|null,o:{track?:TrackPoint[]|string;find?:boolean}={}){
 const d=readDoc(id);if(!aspect){d.shape=null;save(d);return view(d);}
 const crop=cropOf(d.width,d.height,aspect);let follow:FollowPoint[]|null=null,note='';
 if(crop.w>.98&&crop.h>.98)note='The footage already has this shape.';
 else{
  let track:TrackPoint[]|null=typeof o.track==='string'?(JSON.parse(fs.readFileSync(path.resolve(o.track),'utf8')) as {track?:TrackPoint[]}).track??null:o.track??null;
  if(!track&&o.find!==false){try{const {runPythonModule}=await import('../engine/audio-analysis.js');
   const r=await runPythonModule('media_tools.cli',['reframe',d.input,'--aspect',aspect],{label:'Face tracking',env:{FFMPEG_PATH:ffmpeg}}) as {track?:TrackPoint[]};track=r.track??null;}
   catch{note='Centred: following the face needs the media tools (pnpm tempoloom media setup, then the 0.2 MB face model: pnpm tempoloom media download face).';}}
  if(track){follow=followPath(track,{crop,duration:d.duration});note=follow.length?'The frame follows the speaker.':'No face was found, so the frame is centred.';if(!follow.length)follow=null;}
 }
 d.shape={aspect,follow,note};save(d);return view(d);
}

// ---------- the result ----------
type Range={start:number;end:number};
function merged(rs:Range[]){const out:Range[]=[];for(const r of [...rs].sort((a,b)=>a.start-b.start)){const l=out.at(-1);if(l&&r.start<=l.end+.02)l.end=Math.max(l.end,r.end);else out.push({...r});}return out;}
/** The parts of the footage that stay, in the order they play (the chosen opening first). */
export function segments(d:Doc):Range[]{
 const cuts=merged([...d.removals.filter(r=>r.on),...(d.hook?.move?[d.hook]:[])]);
 const kept:Range[]=[];let at=0;for(const c of cuts){if(c.start>at)kept.push({start:at,end:c.start});at=Math.max(at,c.end);}if(at<d.duration)kept.push({start:at,end:d.duration});
 const parts=kept.filter(r=>r.end-r.start>.04).map(r=>({start:+r.start.toFixed(3),end:+r.end.toFixed(3)}));
 return d.hook?[{start:d.hook.start,end:d.hook.end},...parts]:parts;
}
/** Where a moment of the footage lands in the result (the first time it plays), or null if it is cut. */
export function outTime(segs:Range[],t:number){let off=0;for(const s of segs){if(t>=s.start&&t<s.end)return off+t-s.start;off+=s.end-s.start;}return null;}
const removedWord=(d:Doc,w:Spoken)=>{const m=(w.start+w.end)/2;return d.removals.some(r=>r.on&&m>r.start&&m<r.end);};
/** The edit list: the frame (following the speaker), the parts in order, b-roll, captions, loudness. */
export function compile(d:Doc,o:{broll?:Record<string,string>}={}){
 const segs=segments(d),ops:Operation[]=[],notes:string[]=[];
 if(d.shape){ops.push({op:'reframe',aspect:d.shape.aspect,focusX:.5,focusY:.42,...(d.shape.follow?.length?{follow:d.shape.follow}:{})});notes.push(`${d.shape.aspect}: ${d.shape.note}`);}
 const whole=segs.length===1&&segs[0]!.start<=.001&&segs[0]!.end>=d.duration-.001;
 if(!whole)ops.push({op:'arrange',segments:segs});
 const total=segs.reduce((t,s)=>t+s.end-s.start,0);
 const accepted=d.broll.filter(b=>b.on);
 if(accepted.length&&o.broll){const items=accepted.flatMap(b=>{const s=d.sentences[b.sentence-1]!,a=outTime(segs,s.start+.05),f=o.broll![`${b.clip}#${b.shot}`];if(a===null||!f)return [];
  const len=Math.min(b.end-b.start,s.end-s.start+.2,6);return [{file:f,start:+Math.max(0,a-.05).toFixed(3),end:+Math.min(total,a+len).toFixed(3),x:.5,y:.5,width:1}];});
  if(items.length){ops.push({op:'overlays',items});notes.push(`${items.length} b-roll shot${items.length>1?'s':''} from your clips`);}}
 if(d.captions){
  // Captions from the words that stay (not the fillers), each time it plays.
  const ws:Word[]=[];let off=0;
  for(const s of segs){for(const w of d.words)if(!w.filler&&!removedWord(d,w)&&w.start>=s.start-.01&&w.end<=s.end+.05)ws.push({text:w.text,start:+(off+Math.max(0,w.start-s.start)).toFixed(3),end:+(off+Math.min(s.end,w.end)-s.start).toFixed(3),type:'word'});off+=s.end-s.start;}
  const cues=captionsFromWords(ws,{language:d.language}).cues.filter(c=>c.end-c.start>=.2);
  if(cues.length)ops.push({op:'captions',cues,language:d.language,size:.055,color:'#FFFFFF',stroke:'#000000',strokeWidth:.14,background:null,position:'bottom',margin:.16,maxWidth:.86,weight:700,safeArea:true});
 }
 ops.push({op:'loudness',target:-14,truePeak:-1.5,lra:11});
 return {edl:{version:1 as const,input:d.input,operations:ops,export:{preset:'social' as const}},seconds:+total.toFixed(2),notes};
}
/** Makes the edit: the b-roll shots cut to the result's shape first, then the edit list, run. */
export async function render(id:string){
 const d=readDoc(id);if(d.render?.state==='working')throw new Error('The edit is already being made');
 d.render={state:'working',at:now()};save(d);
 try{
  const dir=dirOf(id),[W,H]=d.shape?aspectSizes[d.shape.aspect]:[d.width,d.height],clips=library(),files:Record<string,string>={};
  for(const b of d.broll.filter(x=>x.on)){const c=clips.find(x=>x.id===b.clip);if(!c||!fs.existsSync(c.file))continue;
   const f=path.join(dir,'broll',`${b.clip}-${b.shot}-${W}x${H}.mp4`);
   if(!fs.existsSync(f)){fs.mkdirSync(path.dirname(f),{recursive:true});
    await run(ffmpeg,['-v','error','-y','-ss',String(b.start),'-i',c.file,'-t',String(Math.max(.5,b.end-b.start)),'-an','-vf',`scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`,'-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p',f+'.part.mp4']);
    fs.renameSync(f+'.part.mp4',f);}
   files[`${b.clip}#${b.shot}`]=f;}
  const {edl,notes}=compile(d,{broll:files});fs.writeFileSync(path.join(dir,'edit.json'),JSON.stringify(edl,null,1)+'\n');
  let out=path.join(dir,'edit.mp4');for(let k=2;fs.existsSync(out);k++)out=path.join(dir,`edit-${k}.mp4`);
  const r=await runEdl(edl,dir,{output:out});
  const e=readDoc(id);delete e.render;e.renders.push({at:now(),output:r.output,seconds:+r.info.duration.toFixed(2)});save(e);
  // Learning: every finished edit is recorded in the brain, as edits from an edit list are.
  try{const {recordJob}=await import('../engine/brain/brain.js');recordJob({id:'text-'+id+'-'+e.renders.length,kind:'edit',title:d.title,brief:`Edited by its words: ${notes.join('; ')||'cuts only'}`,
   durationSeconds:+r.info.duration.toFixed(2),transitions:edl.operations.map(o=>o.op),output:r.output,checks:{cuts:d.removals.filter(x=>x.on).length,takes:d.takes.length,hook:!!d.hook,broll:d.broll.filter(b=>b.on).length}});}catch{/* never blocks the edit */}
  return {id,output:r.output,seconds:+r.info.duration.toFixed(2),notes,edl:path.join(dir,'edit.json')};
 }catch(err){const e=readDoc(id);e.render={state:'failed',at:now(),error:(err as Error).message.slice(0,600)};save(e);throw err;}
}

/** What the page and the agent see: the words with what is cut, every cut with why, the takes,
 *  the openings, the shape, the b-roll and the parts that play. */
export function view(d:Doc){
 const segs=segments(d),seconds=segs.reduce((t,s)=>t+s.end-s.start,0),cutBy=(w:Spoken)=>{const m=(w.start+w.end)/2;return d.removals.find(r=>r.on&&m>r.start&&m<r.end)?.kind??null;};
 const clips=library(),shotOf=(c:string,n:number)=>{const k=clips.find(x=>x.id===c);const s=k?.shots.find(x=>x.n===n);return k&&s?{name:k.name,description:s.description}:null;};
 return {id:d.id,title:d.title,input:d.input,language:d.language,duration:d.duration,width:d.width,height:d.height,job:d.job??null,updated:d.updated,
  seconds:+seconds.toFixed(2),segments:segs,
  sentences:d.sentences.map(s=>({n:s.n,start:s.start,end:s.end,words:d.words.slice(s.from,s.to).map(w=>({i:w.i,text:w.text,start:w.start,end:w.end,filler:!!w.filler,cut:cutBy(w)})),
   take:d.takes.find(g=>g.sentences.includes(s.n))?.id??null,struck:d.removals.some(r=>r.on&&r.sentence===s.n)})),
  removals:d.removals.map(r=>({...r,at:clock(r.start),seconds:+(r.end-r.start).toFixed(2)})).sort((a,b)=>a.start-b.start),
  counts:Object.fromEntries((['filler','pause','take','sentence','words','start','end'] as Kind[]).map(k=>[k,{on:d.removals.filter(r=>r.kind===k&&r.on).length,all:d.removals.filter(r=>r.kind===k).length}])),
  takes:d.takes.map(g=>({id:g.id,best:g.best,why:g.why,takes:g.takes.map(t=>({sentence:t.sentence,notes:t.notes,text:d.sentences[t.sentence-1]!.text,at:clock(d.sentences[t.sentence-1]!.start)}))})),
  hooks:d.hooks.map(h=>({...h,at:clock(h.start),seconds:+(h.end-h.start).toFixed(1)})),hook:d.hook,
  shape:d.shape?{aspect:d.shape.aspect,following:!!d.shape.follow?.length,note:d.shape.note}:null,captions:d.captions,
  broll:d.broll.map(b=>({...b,text:d.sentences[b.sentence-1]?.text??'',shotInfo:shotOf(b.clip,b.shot)})),library:clips.length,
  renders:d.renders.map((r,k)=>({...r,k,exists:fs.existsSync(r.output)})),render:d.render??null};
}
export const docView=(id:string)=>view(readDoc(id));
export function outputFile(id:string,k:number){const r=readDoc(id).renders[k];if(!r||!fs.existsSync(r.output))throw new Error('No such file');return r.output;}
/** Removes a text edit. The videos made from it stay (they are yours), and so does the footage. */
export function removeDoc(id:string){const d=readDoc(id),dir=dirOf(id),kept:string[]=[];
 for(const n of fs.readdirSync(dir)){if(/^edit(-\d+)?\.(mp4|edit\.json)$/.test(n)){kept.push(path.join(dir,n));continue;}fs.rmSync(path.join(dir,n),{recursive:true,force:true});}
 if(!kept.length)fs.rmSync(dir,{recursive:true,force:true});
 return {removed:d.title,kept,note:kept.length?`The videos made from it are kept in ${dir}; your footage is where it was.`:'Your footage is where it was.'};}
