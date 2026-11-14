// Teaching the brain with videos (`pnpm tempoloom teach`). A video is copied to a temporary
// study folder, measured, looked at by the agent with the user's prompt, and deleted; only
// numbers and lessons go to the brain. Learning is kept clean in four ways: a lesson starts on
// trial, repeats merge into what is already known (and make it stronger), a lesson that goes
// against a known one is flagged, and what the good examples have in common becomes a pattern
// only when enough of them agree (outliers are left out).
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {z} from 'zod';
import {ROOT} from '../config.js';
import {db,dbPath,putVideo,getVideo,allVideos,removeVideo,removeKnowledge,allKnowledge,getKnowledge,exportCommitted,type Knowledge,type Domain} from '../brain/db.js';
import {add,setStatus,nudge,confidence} from '../brain/brain.js';
import {change} from '../history.js';
import {topicsOf} from '../feedback.js';
import {GROUPS,groupOfTopic,groupOfTopics,styleTags} from '../categories.js';
import {inspect,studyClip,measure,fingerprint,likeness,frameSheets,thumbnail,type Measured,type Crop} from './measure.js';

export const TEACH_TOPICS=['pacing','transitions','motion','typography','color','design','audio','script','captions','editing'] as const;
export type Topic=typeof TEACH_TOPICS[number];
export const TOPIC_LABEL:Record<Topic,string>={pacing:'Pacing and rhythm',transitions:'Transitions and cuts',motion:'Motion and animation',typography:'Text and typography',color:'Colour',
 design:'Layout and composition',audio:'Music and sound',script:'Hook and script',captions:'Captions',editing:'Editing choices'};

const fraction=z.number().min(0).max(1);
const cropShape=z.object({x:fraction,y:fraction,w:fraction.min(.1),h:fraction.min(.1)}).strict();
export const cropInput=cropShape.refine(c=>c.x+c.w<=1.000001&&c.y+c.h<=1.000001,'Keep the crop inside the video frame');
export const teachInput=z.object({title:z.string().trim().min(1).max(120),verdict:z.enum(['good','bad']),prompt:z.string().trim().max(2000).default(''),
 topics:z.array(z.enum(TEACH_TOPICS)).min(1,'Tick at least one thing to learn'),marks:z.array(z.object({t:z.number().min(0),note:z.string().trim().max(200).default('')}).strict()).max(12).default([]),
 segment:z.object({start:z.number().min(0),end:z.number().positive()}).strict().refine(s=>s.end-s.start>=.5,'The part to study must be at least half a second').nullable().default(null),
 crop:cropShape.nullable().default(null),
 keepPlayback:z.boolean().optional(),sound:z.boolean().default(true),speech:z.boolean().default(false)}).strict();
export type TeachInput=z.input<typeof teachInput>;

export type Status='draft'|'measuring'|'waiting'|'learned'|'failed';
export type Taught={id:string;title:string;source:{kind:'upload'|'file'|'link';name:string;url?:string};verdict:'good'|'bad';prompt:string;topics:Topic[];marks:{t:number;note:string}[];
 keepPlayback?:boolean;segment:{start:number;end:number}|null;crop:Crop|null;sound:boolean;status:Status;step:string|null;error:string|null;media:{seconds:number;width:number;height:number;fps:number;audio:boolean}|null;
 measured:Measured|null;speech:{words:number;wordsPerSecond:number;hookWords:number}|null;fingerprint:number[]|null;lessons:string[];dropped:{text:string;reason:string;at:string}[];
 sheets:{file:string;shows:string;times:number[]}[];created:string;updated:string;learnedAt:string|null};

const now=()=>new Date().toISOString();
export const teachRoot=()=>path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','teach');
export const studyDir=(id:string)=>{if(!/^[a-z0-9][a-z0-9-]{0,70}$/.test(id))throw new Error('Not a taught video id: '+id);return path.join(teachRoot(),id);};
export const thumbFile=(id:string)=>path.join(path.dirname(dbPath()),'teach-thumbs',id+'.jpg');
export function playbackFile(id:string){
 const dir=studyDir(id);
 return video(id).status==='waiting'&&fs.existsSync(path.join(dir,'study.mp4'))?path.join(dir,'study.mp4'):savedClip(id);
}
const savedClip=(id:string)=>path.join(path.dirname(dbPath()),'teach-playback',id+'.mp4');
export function renameVideo(id:string,title:unknown){
 const v=video(id);
 if(v.status!=='learned')throw new Error('Finish learning before renaming the video');
 v.title=z.string().trim().min(1).max(120).parse(title);
 save(v);exportCommitted();return {title:v.title};
}
const rel=(f:string)=>path.relative(ROOT,f).split(path.sep).join('/');
const save=(v:Taught)=>{v.updated=now();putVideo(v as unknown as Parameters<typeof putVideo>[0]);return v;};
export function video(id:string):Taught{const v=getVideo(id) as Taught|null;if(!v)throw new Error(`No taught video "${id}". See them with: pnpm tempoloom teach list`);return v;}
export const videos=()=>allVideos() as unknown as Taught[];

// ---------- 1. a video arrives ----------
export function newId(name:string){
 const base=name.toLowerCase().normalize('NFKD').replace(/\.[a-z0-9]{2,4}$/,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'video';
 return `${base}-${randomBytes(3).toString('hex')}`;
}
/** Registers a video whose file is already in its study folder as `source.*`, and makes the preview the page plays. */
export async function draft(id:string,source:Taught['source']){
 const dir=studyDir(id),file=sourceFile(id);
 if(!file)throw new Error('The video did not arrive');
 let media;try{media=await inspect(file);}catch(e){await fsp.rm(dir,{recursive:true,force:true});throw e;}
 // A small H.264 copy every browser can play (phones record formats browsers cannot).
 await studyClip(file,path.join(dir,'preview.mp4'),{}).catch(async e=>{await fsp.rm(dir,{recursive:true,force:true});throw e;});
 const stamp=now();
 return save({id,title:source.name.replace(/\.[a-z0-9]{2,4}$/i,'').replace(/[-_]+/g,' ').trim().slice(0,120)||'Video',source,verdict:'good',prompt:'',topics:[],marks:[],segment:null,crop:null,sound:true,
  status:'draft',step:null,error:null,media,measured:null,speech:null,fingerprint:null,lessons:[],dropped:[],sheets:[],created:stamp,updated:stamp,learnedAt:null});
}
export function sourceFile(id:string){const dir=studyDir(id);try{const f=fs.readdirSync(dir).find(n=>n.startsWith('source.'));return f?path.join(dir,f):null;}catch{return null;}}
/** Copies a file from the computer into a study folder (the original is never touched). */
export async function draftFromFile(file:string){
 const abs=path.resolve(file);await fsp.access(abs).catch(()=>{throw new Error('No such file: '+file);});
 const id=newId(path.basename(abs)),dir=studyDir(id);await fsp.mkdir(dir,{recursive:true});
 await fsp.copyFile(abs,path.join(dir,'source'+(path.extname(abs).toLowerCase().replace(/[^.a-z0-9]/g,'')||'.mp4')));
 return draft(id,{kind:'file',name:path.basename(abs)});
}
/** A link: reports the title, length and size first; downloads (for study only) with confirm. */
export async function draftFromLink(url:string,confirm:boolean,selection?:{item:number;id:string}){
 const {referenceInfo,downloadReference}=await import('../sourcing/reference-video.js');
 const info=await referenceInfo(url,selection?{item:selection.item,expectedId:selection.id}:{});
 if(!confirm)return {status:'needs-confirmation' as const,info:{...info,seconds:info.duration}};
 const id=newId(info.title||'video'),dir=studyDir(id);await fsp.mkdir(dir,{recursive:true});
 try{const d=await downloadReference(url,{maxHeight:720,root:path.join(dir,'_download'),item:info.item,expectedId:info.id}) as {video:string};
  await fsp.rename(d.video,path.join(dir,'source'+(path.extname(d.video)||'.mp4')));await fsp.rm(path.join(dir,'_download'),{recursive:true,force:true});
 }catch(e){await fsp.rm(dir,{recursive:true,force:true});throw e;}
 return {status:'ready' as const,video:await draft(id,{kind:'link',name:info.title||url,url:info.page})};
}

/** Encode a cropped preview while keeping the full original available for adjustments. */
export async function previewCrop(id:string,input:unknown){
 const v=video(id);if(v.status!=='draft')throw new Error('Only an uploaded draft can be cropped');
 const crop=cropInput.parse(input),dir=studyDir(id);
 const name='crop-'+createHash('sha256').update(JSON.stringify(crop)).digest('hex').slice(0,16)+'.mp4';
 const output=path.join(dir,name),temporary=path.join(dir,name+'.partial.mp4');
 if(!fs.existsSync(output)){
  try{
   await studyClip(path.join(dir,'preview.mp4'),temporary,{crop});
   await fsp.rename(temporary,output);
  }catch(error){await fsp.rm(temporary,{force:true});throw error;}
 }
 return {name,crop,media:await inspect(output)};
}

// ---------- 2. measuring ----------
/** Cuts the part to study, measures it and prepares the frame sheets; then it waits for the agent. */
export async function teach(id:string,input:TeachInput,o:{fetcher?:typeof fetch}={}){
 const v=video(id);if(!['draft','failed'].includes(v.status))throw new Error(`"${v.title}" was already sent for learning`);
 const i=teachInput.parse(input),dir=studyDir(id),src=sourceFile(id);if(!src)throw new Error('The uploaded video is gone; upload it again');
 Object.assign(v,{title:i.title,keepPlayback:i.keepPlayback===true,verdict:i.verdict,prompt:i.prompt,topics:i.topics,marks:[...i.marks].sort((a,b)=>a.t-b.t),segment:i.segment,crop:i.crop,sound:i.sound,status:'measuring',step:'Cutting the part to study',error:null});save(v);
 const step=(s:string)=>{v.step=s;save(v);};
 try{
  const study=path.join(dir,'study.mp4');
  const seg=await studyClip(src,study,{...(i.segment?{start:i.segment.start,end:i.segment.end}:{}),crop:i.crop,sound:i.sound});
  // Marks are kept relative to the studied part.
  v.marks=v.marks.map(m=>({t:Math.round((m.t-seg.start)*100)/100,note:m.note})).filter(m=>m.t>=0&&m.t<=seg.end-seg.start);
  step('Measuring cuts, motion, colour and sound');
  v.measured=await measure(study,{sound:i.sound});v.fingerprint=fingerprint(v.measured);
  if(i.speech&&v.measured.media.audio&&i.sound){
   step('Reading the speech');
   try{const {transcribe}=await import('../transcribe.js');const t=await transcribe(study,{cacheDir:path.join(dir,'_speech'),...(o.fetcher?{fetcher:o.fetcher}:{})});
    const w=t.words.filter(x=>x.type==='word');
    v.speech={words:w.length,wordsPerSecond:Math.round(w.length/v.measured.media.seconds*100)/100,hookWords:w.filter(x=>x.start<3).length};
    await fsp.writeFile(path.join(dir,'speech.txt'),t.text+'\n');
   }catch(e){v.measured.notes.push('The speech could not be read: '+(e as Error).message.slice(0,160));}
  }
  step('Preparing the frames to look at');
  const sheets=await frameSheets(study,path.join(dir,'sheets'),v.measured,v.marks);
  v.sheets=sheets.map(s=>({...s,file:rel(s.file)}));
  await thumbnail(study,thumbFile(id),v.measured.media.seconds/3).catch(()=>undefined);
  // The upload and its preview are no longer needed: only the studied part stays until the agent has looked.
  await fsp.rm(src,{force:true});await fsp.rm(path.join(dir,'preview.mp4'),{force:true});
  v.status='waiting';v.step=null;return save(v);
 }catch(e){v.status='failed';v.step=null;v.error=(e as Error).message.slice(0,400);save(v);throw e;}
}

/** A video left "measuring" by a process that stopped is marked failed, so it can be removed or sent again. */
export function recover(){for(const v of videos().filter(v=>v.status==='measuring'))save(Object.assign(v,{status:'failed' as Status,step:null,error:'Measuring was interrupted. Remove it and upload the video again.'}));}

// ---------- 3. the agent looks and writes lessons ----------
const strip=(m:Measured)=>({...m,pacing:{...m.pacing,cutTimes:m.pacing.cutTimes.slice(0,40)},layout:{detail:m.layout.detail,top:m.layout.top,middle:m.layout.middle,bottom:m.layout.bottom}});
/** The next video waiting to be looked at, with everything the agent needs. */
export function next(id?:string){
 const waiting=videos().filter(v=>v.status==='waiting').sort((a,b)=>a.created.localeCompare(b.created));
 const v=id?video(id):waiting[0];
 if(!v)return {waiting:0,note:'No video is waiting. The user teaches videos on the Teach page: pnpm tempoloom teach open'};
 if(v.status!=='waiting')throw new Error(`"${v.title}" is ${v.status}, not waiting to be studied`);
 const dir=studyDir(v.id),speech=path.join(dir,'speech.txt');
 return {waiting:waiting.length,video:{id:v.id,title:v.title,example:v.verdict==='good'?'a GOOD example: learn what to do':'a BAD example: learn what to avoid',prompt:v.prompt||'(no prompt: learn what stands out in the ticked topics)',
   learnOnly:v.topics,marks:v.marks,studiedPart:v.segment,cropped:!!v.crop},
  measured:v.measured?strip(v.measured):null,speech:v.speech?{...v.speech,text:fs.existsSync(speech)?rel(speech):null}:null,
  look:v.sheets,
  similar:similar(v.id,3).map(s=>({title:s.title,example:s.verdict,alike:s.likeness.overall,mostAlikeIn:s.mostAlikeIn,lessons:s.lessons.map(l=>l.title)})),
  patterns:patterns().found.map(p=>p.title),
  how:[
   'Open every image in "look" (they are frame sheets; "times" are the seconds of each frame, left to right, top to bottom).',
   'Follow the prompt. Learn only the topics in "learnOnly"; a lesson on anything else is dropped.',
   `Write 2 to 6 lessons. Each is one thing to ${v.verdict==='good'?'do again':'avoid'} in future videos, with numbers from "measured" where they fit (seconds, counts, percentages).`,
   'A lesson is a way of working, not a description of this video: never its words, logo, people or story, and nothing that would copy it.',
   `Save each: pnpm tempoloom teach learn ${v.id} --topic TOPIC "THE LESSON"   (add --at SECONDS when it is about one moment)`,
   `Then: pnpm tempoloom teach finish ${v.id}   (${v.keepPlayback?'keeps a playable study clip in your library':'deletes the video and its frames'})`]};
}

const STOP=new Set('the and for with that this are was you your from into about make have has not but its their then than when each every over under more most very use uses using used video videos should always never keep avoid dont'.split(' '));
const stem=(w:string)=>w.replace(/(ing|ed|es|s)$/,'');
const tokens=(s:string)=>new Set(s.toLowerCase().normalize('NFKC').split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>2&&!STOP.has(w)).map(stem));
const negative=(k:{kind:string;title:string;body:string})=>k.kind==='avoid'||/^(avoid|never|do not|don't|no )\b/i.test(k.title)||/^(avoid|never|do not|don't)\b/i.test(k.body);
/** How alike two lessons are (shared rare words count more), 0..1. */
export function alike(a:Set<string>,b:Set<string>,idf:(w:string)=>number){
 let shared=0,na=0,nb=0;for(const w of a){const x=idf(w);na+=x*x;if(b.has(w))shared+=x*x;}for(const w of b)nb+=idf(w)**2;
 return na&&nb?shared/Math.sqrt(na*nb):0;
}
function corpus(){
 const ks=allKnowledge().filter(k=>k.kind!=='tool'&&!k.id.startsWith('teach-pattern-')),df=new Map<string,number>(),sets=new Map<string,Set<string>>();
 for(const k of ks){const t=tokens(k.title+' '+k.body);sets.set(k.id,t);for(const w of t)df.set(w,(df.get(w)??0)+1);}
 const idf=(w:string)=>Math.log(1+(ks.length+1)/(1+(df.get(w)??0)));
 return {ks,sets,idf};
}
const VAGUE=/^(the|this|it)\s+(video|clip|one)?\s*(is|looks|feels|was)\s+(very\s+|really\s+)?(good|nice|great|bad|cool|clean|professional|boring)\b/i;
export type LearnResult={action:'added'|'merged'|'conflict'|'dropped';id?:string;title?:string;reason?:string;with?:{id:string;title:string};status?:string};
/** Saves one lesson from a taught video, after the noise checks. */
export function learn(id:string,o:{text:string;topics?:string[];title?:string;at?:number}):LearnResult{
 return change({kind:'lessons',title:`Learned from "${video(id).title.slice(0,50)}": ${o.text.replace(/\s+/g,' ').trim().slice(0,90)}`},()=>learnNow(id,o));
}
function learnNow(id:string,o:{text:string;topics?:string[];title?:string;at?:number}):LearnResult{
 const v=video(id);if(v.status!=='waiting')throw new Error(`"${v.title}" is ${v.status}; lessons are added while it waits to be studied`);
 const text=o.text.replace(/\s+/g,' ').trim();
 const drop=(reason:string):LearnResult=>{v.dropped.push({text:text.slice(0,300),reason,at:now()});save(v);return {action:'dropped',reason};};
 if(text.length<25||text.split(' ').length<5||VAGUE.test(text))return drop('Too vague to use again: say what to do, when, and how much.');
 const given=(o.topics??[]).map(t=>t.trim().toLowerCase()).filter(Boolean);
 const bad=given.filter(t=>!(TEACH_TOPICS as readonly string[]).includes(t));if(bad.length)throw new Error(`Unknown topic: ${bad.join(', ')}. Topics: ${TEACH_TOPICS.join(', ')}`);
 const topics=(given.length?given:topicsOf(text).filter(t=>(TEACH_TOPICS as readonly string[]).includes(t))) as Topic[];
 if(!topics.length)throw new Error(`Say what the lesson is about: --topic ${v.topics.join('|')}`);
 const allowed=topics.filter(t=>v.topics.includes(t));
 if(!allowed.length)return drop(`Not asked for: this video is taught for ${v.topics.join(', ')} only.`);
 const kind=v.verdict==='bad'?'avoid':'technique',title=(o.title??text.split(/(?<=[.!?])\s/)[0]!).slice(0,100),mine={kind,title,body:text};
 // Against everything known: a repeat merges, a removed lesson stays removed, an opposite is flagged.
 const {ks,sets,idf}=corpus(),t=tokens(title+' '+text);
 const ranked=ks.map(k=>({k,s:alike(t,sets.get(k.id)!,idf)})).sort((a,b)=>b.s-a.s),best=ranked[0];
 const evidence=`teach:${id}`;
 if(best&&best.s>=.58){
  const k=best.k;
  if(['rejected','retired'].includes(k.status))return drop(`You removed this lesson before ("${k.title}").`);
  if(negative(k)===negative(mine)){
   const again=k.evidence.includes(evidence);
   if(!again){
    nudge([k.id],true,evidence);
    const taughtIn=new Set([...(getKnowledge(k.id)?.evidence??[])].filter(e=>e.startsWith('teach:'))).size;
    if(k.status==='trial'&&taughtIn>=3)setStatus(k.id,'approved',`seen in ${taughtIn} taught videos`);
   }
   if(!v.lessons.includes(k.id))v.lessons.push(k.id);save(v);
   const cur=getKnowledge(k.id)!;
   return {action:'merged',id:k.id,title:k.title,status:cur.status,reason:again?'Already saved from this video; say it once.':`Already known; this video is one more piece of evidence (confidence ${Math.round(confidence(cur)*100)}%).`};
  }
 }
 const opposite=ranked.find(x=>x.s>=.45&&negative(x.k)!==negative(mine)&&!['rejected','retired'].includes(x.k.status));
 if(opposite&&['rule','preference'].includes(opposite.k.kind))return drop(`It goes against your own rule "${opposite.k.title}", and your rules win.`);
 const motion=allowed.some(x=>['motion','typography','color','design'].includes(x)),editing=allowed.some(x=>['editing','captions'].includes(x));
 const domain:Domain=motion&&!editing?'motion':editing&&!motion?'editing':'both';
 const a=add({title,body:text+(o.at!==undefined?` (Seen at ${o.at} s in a taught video.)`:''),domain,kind,tags:[...allowed,'taught',...(opposite?['conflict']:[])],source:evidence,status:'trial',
  evidence:opposite?['conflict:'+opposite.k.id]:[]});
 if(!v.lessons.includes(a.knowledge.id))v.lessons.push(a.knowledge.id);save(v);
 return opposite?{action:'conflict',id:a.knowledge.id,title,with:{id:opposite.k.id,title:opposite.k.title},status:'trial',reason:'It says the opposite of something already known. Both are kept on trial until the user chooses on the Teach page.'}
  :{action:'added',id:a.knowledge.id,title,status:'trial'};
}

/** Keep the requested playback copy before releasing temporary study files. */
export function finish(id:string){return change({kind:'lessons',title:`Finished studying "${video(id).title.slice(0,70)}"`},()=>finishNow(id));}
async function finishNow(id:string){
 const v=video(id);if(v.status!=='waiting')throw new Error(`"${v.title}" is ${v.status}; only a video waiting to be studied can be finished`);
 if(v.keepPlayback){
  const src=path.join(studyDir(id),'study.mp4'),dest=savedClip(id);
  if(fs.existsSync(src)){
   await fsp.mkdir(path.dirname(dest),{recursive:true});
   await fsp.copyFile(src,dest+'.partial');
   await fsp.rename(dest+'.partial',dest);
  }else if(!fs.existsSync(dest))throw new Error('The study clip is missing');
 }
 await fsp.rm(studyDir(id),{recursive:true,force:true});
 v.status='learned';v.sheets=[];v.learnedAt=now();save(v);
 const p=updatePatterns();exportCommitted();
 return {id,title:v.title,deleted:v.keepPlayback?'temporary study files':'the video and its frames',kept:{lessons:v.lessons.length,dropped:v.dropped.length,measurements:true},patterns:p.found.map(x=>x.title),
  next:videos().some(x=>x.status==='waiting')?'Another video is waiting: pnpm tempoloom teach next':'Nothing else is waiting.'};
}
/** Removes an upload that was never taught, or stops a video that failed. */
export async function discard(id:string){const v=video(id);if(v.status==='learned')throw new Error('This video was learned; to remove what it taught use: teach forget '+id);
 if(v.status==='measuring')throw new Error('It is being measured; wait a moment');
 return forget(id);}
/** Forgets a taught video: its record, and the lessons that came only from it and were never used. */
export function forget(id:string){const v=video(id);return v.status==='learned'?change({kind:'lessons',title:`Forgot the taught video "${v.title.slice(0,70)}" (Undo brings back its lessons; the video file itself is gone)`},()=>forgetNow(id)):forgetNow(id);}
async function forgetNow(id:string){
 const v=video(id),removed:string[]=[],kept:string[]=[];
 await fsp.rm(studyDir(id),{recursive:true,force:true});await fsp.rm(thumbFile(id),{force:true});await fsp.rm(savedClip(id),{force:true});await fsp.rm(savedClip(id)+'.partial',{force:true});
 for(const lid of v.lessons){const k=getKnowledge(lid);if(!k)continue;
  if(k.source===`teach:${id}`&&k.uses===0&&!k.evidence.some(e=>e.startsWith('teach:')&&e!==`teach:${id}`)){removeKnowledge(lid);removed.push(lid);}else kept.push(lid);}
 removeVideo(id);updatePatterns();exportCommitted();
 return {forgot:v.title,lessonsRemoved:removed,lessonsKept:kept,note:kept.length?'Kept lessons were also seen elsewhere or already used in a job.':undefined};
}

// ---------- 4. what the good examples have in common ----------
type Metric={id:string;topic:Topic;unit:string;get:(m:Measured)=>number|null;tolerance:number;title:(range:string)=>string;about:string};
const METRICS:Metric[]=[
 {id:'shot-length',topic:'pacing',unit:' s',tolerance:.4,get:m=>m.pacing.cuts>=2?m.pacing.shotMedian:null,title:r=>`Shots last ${r} seconds`,about:'the typical time between two cuts'},
 {id:'first-cut',topic:'pacing',unit:' s',tolerance:.5,get:m=>m.pacing.firstCut,title:r=>`The first cut comes after ${r} seconds`,about:'how long the opening shot holds'},
 {id:'motion-energy',topic:'motion',unit:'',tolerance:.8,get:m=>m.motion.energy,title:r=>`Motion energy inside shots is ${r}`,about:'how much of the picture changes from frame to frame (under 1 is calm, 2 to 4 lively, over 5 very busy)'},
 {id:'still-time',topic:'motion',unit:'%',tolerance:12,get:m=>Math.round(m.motion.stillShare*100),title:r=>`The picture rests ${r}% of the time`,about:'the share of time almost nothing moves'},
 {id:'brightness',topic:'color',unit:'%',tolerance:10,get:m=>Math.round(m.color.brightness*100),title:r=>`Frames are ${r}% bright`,about:'average brightness (under 30 is a dark look, over 70 a light one)'},
 {id:'saturation',topic:'color',unit:'%',tolerance:10,get:m=>Math.round(m.color.saturation*100),title:r=>`Colour strength is ${r}%`,about:'average saturation (under 20 is muted, over 50 vivid)'},
 {id:'cuts-on-beat',topic:'audio',unit:'%',tolerance:15,get:m=>m.sound?.cutsOnBeat!=null?Math.round(m.sound.cutsOnBeat*100):null,title:r=>`Cuts land on the beat ${r}% of the time`,about:'cuts within 85 ms of a beat of the music'},
 {id:'tempo',topic:'audio',unit:' BPM',tolerance:12,get:m=>m.sound&&m.sound.tempoConfidence>=.25?m.sound.bpm:null,title:r=>`The music runs at ${r} BPM`,about:'the tempo of the music'},
 {id:'loudness',topic:'audio',unit:' LUFS',tolerance:2.5,get:m=>m.sound?.lufs??null,title:r=>`Loudness is ${r} LUFS`,about:'overall loudness of the sound'},
 {id:'detail',topic:'design',unit:'',tolerance:8,get:m=>Math.round(m.layout.detail*1000),title:r=>`Frame detail is ${r}`,about:'how much fine detail a frame holds (under 15 is clean and open, over 40 dense)'},
];
const METRIC_SHOW:Record<string,{label:string;scale:[number,number]}>={'shot-length':{label:'Shot length',scale:[0,6]},'first-cut':{label:'First cut',scale:[0,8]},'motion-energy':{label:'Motion energy',scale:[0,8]},'still-time':{label:'Still time',scale:[0,100]},
 brightness:{label:'Brightness',scale:[0,100]},saturation:{label:'Colour strength',scale:[0,100]},'cuts-on-beat':{label:'Cuts on the beat',scale:[0,100]},tempo:{label:'Music tempo',scale:[60,180]},loudness:{label:'Loudness',scale:[-40,-5]},detail:{label:'Frame detail',scale:[0,80]}};
const q=(s:number[],p:number)=>{const i=(s.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return s[lo]!+(s[hi]!-s[lo]!)*(i-lo);};
const fmt=(n:number)=>String(Math.round(n*10)/10);
export type Pattern={id:string;metric:string;topic:Topic;title:string;body:string;videos:string[];leftOut:number;lo:number;hi:number;mid:number;unit:string;tolerance:number;group:string;label:string;about:string;scale:[number,number];bad:number|null;values:number[]};
/** For each measurement: when at least three good examples agree, their shared range is a pattern.
 *  Values far from the rest are left out, and a measurement the examples disagree on gives none. */
export function patterns(only?:string[]){
 const learned=videos().filter(v=>v.status==='learned'&&v.measured&&(!only||only.includes(v.id))),found:Pattern[]=[],unclear:{metric:string;why:string}[]=[];
 for(const m of METRICS){
  const of=(verdict:'good'|'bad')=>learned.filter(v=>v.verdict===verdict&&v.topics.includes(m.topic)).map(v=>({id:v.id,x:m.get(v.measured!)})).filter((r):r is {id:string;x:number}=>r.x!==null&&Number.isFinite(r.x));
  const good=of('good'),bad=of('bad');if(good.length<3)continue;
  const sorted=good.map(r=>r.x).sort((a,b)=>a-b),q1=q(sorted,.25),q3=q(sorted,.75),iqr=q3-q1,fence=Math.max(iqr*1.5,m.tolerance);
  const kept=good.filter(r=>r.x>=q1-fence&&r.x<=q3+fence),ks=kept.map(r=>r.x).sort((a,b)=>a-b);
  if(ks.length<3)continue;
  const lo=q(ks,.25),hi=q(ks,.75),mid=q(ks,.5);
  if(hi-lo>Math.max(m.tolerance,Math.abs(mid)*.35)){unclear.push({metric:m.id,why:`Your good examples differ too much here (${fmt(ks[0]!)} to ${fmt(ks[ks.length-1]!)}${m.unit}), so nothing is learned from it.`});continue;}
  const range=fmt(lo)===fmt(hi)?'about '+fmt(lo):`${fmt(lo)} to ${fmt(hi)}`,title=m.title(range)+' in your good examples';
  let body=`${m.title(range)} (typically ${fmt(mid)}${m.unit.trim()?m.unit:''}) in ${ks.length} videos you taught as good examples. This is ${m.about}. Aim inside this range unless the brief asks otherwise.`;
  if(kept.length<good.length)body+=` ${good.length-kept.length} video${good.length-kept.length>1?'s were':' was'} far from the rest and left out.`;
  const bs=bad.map(r=>r.x).sort((a,b)=>a-b);const badMid=bs.length>=2?Math.round(q(bs,.5)*10)/10:null;
  if(bs.length>=2){const bm=q(bs,.5);if(bm<lo-m.tolerance/2||bm>hi+m.tolerance/2)body+=` Your bad examples sit at ${fmt(bm)}${m.unit}: stay away from that.`;}
  found.push({id:'teach-pattern-'+m.id,metric:m.id,topic:m.topic,title,body,videos:kept.map(r=>r.id),leftOut:good.length-kept.length,lo:Math.round(lo*10)/10,hi:Math.round(hi*10)/10,mid:Math.round(mid*10)/10,unit:m.unit,tolerance:m.tolerance,group:groupOfTopic(m.topic),label:METRIC_SHOW[m.id]!.label,about:m.about,scale:METRIC_SHOW[m.id]!.scale,bad:badMid,values:ks.map(x=>Math.round(x*10)/10)});
 }
 return {found,unclear,from:{good:learned.filter(v=>v.verdict==='good').length,bad:learned.filter(v=>v.verdict==='bad').length}};
}
/** The measurements a video can be checked on: what each is, its unit, and how to read it from a measured video. */
export const METRIC_INFO=METRICS.map(m=>({id:m.id,topic:m.topic,unit:m.unit,about:m.about,tolerance:m.tolerance,name:m.title('X').replace(/ ?X ?/,' ').replace(/\s+/g,' ').trim()}));
export const metricValue=(id:string,m:Measured)=>METRICS.find(x=>x.id===id)?.get(m)??null;
/** Writes the patterns to the brain; one that is no longer supported leaves it. */
export function updatePatterns(){
 const p=patterns(),ids=new Set(p.found.map(x=>x.id));
 for(const x of p.found){const cur=getKnowledge(x.id);if(cur?.status==='rejected')continue;
  if(cur&&cur.title===x.title&&cur.body===x.body)continue;
  add({id:x.id,title:x.title,body:x.body,domain:['motion','color','design'].includes(x.topic)?'motion':'both',kind:'principle',tags:[x.topic,'taught','pattern'],source:'teach:pattern',status:'approved'});}
 for(const k of allKnowledge().filter(k=>k.id.startsWith('teach-pattern-')&&!ids.has(k.id)&&k.status!=='rejected'))k.uses?setStatus(k.id,'retired','no longer supported by the taught videos'):removeKnowledge(k.id);
 return p;
}

// ---------- 5. videos like this one ----------
/** The taught videos most like one (by pacing, motion, colour, sound and layout), with what they taught. */
export function similar(idOrPrint:string|number[],limit=5){
 const print=typeof idOrPrint==='string'?video(idOrPrint).fingerprint:idOrPrint,self=typeof idOrPrint==='string'?idOrPrint:null;
 if(!print)return [];
 return videos().filter(v=>v.id!==self&&v.fingerprint&&['waiting','learned'].includes(v.status)).map(v=>{const l=likeness(print,v.fingerprint!);
  const parts=(['pacing','motion','color','sound','layout'] as const).map(k=>({k,s:l[k]})).sort((a,b)=>b.s-a.s);
  return {id:v.id,title:v.title,verdict:v.verdict,likeness:l,mostAlikeIn:parts.slice(0,2).map(x=>x.k),lessons:lessonsOf(v)};})
  .sort((a,b)=>b.likeness.overall-a.likeness.overall).slice(0,limit);
}
/** Measures a file only to compare it (nothing is saved, the copy is deleted). */
export async function similarToFile(file:string,limit=5){
 const abs=path.resolve(file);await fsp.access(abs).catch(()=>{throw new Error('No such file: '+file);});
 const tmp=await fsp.mkdtemp(path.join(await fsp.mkdir(teachRoot(),{recursive:true}).then(()=>teachRoot()),'compare-'));
 try{const clip=path.join(tmp,'study.mp4');await studyClip(abs,clip,{});const m=await measure(clip);return {measured:strip(m),similar:similar(fingerprint(m),limit)};}
 finally{await fsp.rm(tmp,{recursive:true,force:true});}
}

// ---------- the Teach page and reports ----------
const lessonView=(k:Knowledge)=>({id:k.id,title:k.title,body:k.body,kind:k.kind,status:k.status,topics:k.tags.filter(t=>(TEACH_TOPICS as readonly string[]).includes(t)),confidence:Math.round(confidence(k)*100),
 group:groupOfTopics(k.tags.filter(t=>(TEACH_TOPICS as readonly string[]).includes(t))),
 wins:k.wins,losses:k.losses,uses:k.uses,mine:k.tags.includes('mine'),created:k.created,from:[...new Set(k.evidence.filter(e=>e.startsWith('teach:')&&e!=='teach:pattern').map(e=>e.slice(6)))],
 videos:new Set(k.evidence.filter(e=>e.startsWith('teach:'))).size||1,conflictWith:k.tags.includes('conflict')?k.evidence.find(e=>e.startsWith('conflict:'))?.slice(9)??null:null});
export type LessonView=ReturnType<typeof lessonView>;
function lessonsOf(v:Taught){return v.lessons.map(id=>getKnowledge(id)).filter((k):k is Knowledge=>!!k).map(lessonView);}
export function show(id:string){const v=video(id);return {...v,measured:v.measured?strip(v.measured):null,fingerprint:undefined,lessons:lessonsOf(v),similar:v.fingerprint?similar(id,3).map(s=>({id:s.id,title:s.title,alike:s.likeness.overall,mostAlikeIn:s.mostAlikeIn})):[]};}
export function overview(){
 db();
 const vs=videos().sort((a,b)=>b.created.localeCompare(a.created)),p=patterns();
 // Every taught lesson: from videos, and the ones the user wrote themselves.
 const all=[...vs.flatMap(v=>lessonsOf(v)),...allKnowledge().filter(k=>k.tags.includes('mine')).map(lessonView)],uniq=[...new Map(all.map(l=>[l.id,l])).values()].sort((a,b)=>b.created.localeCompare(a.created));
 return {videos:vs.map(v=>({id:v.id,title:v.title,source:v.source.kind,verdict:v.verdict,status:v.status,step:v.step,error:v.error,prompt:v.prompt,topics:v.topics,group:groupOfTopics(v.topics),style:styleTags(v.measured),marks:v.marks,media:v.media,created:v.created,learnedAt:v.learnedAt,
   measured:v.measured?strip(v.measured):null,speech:v.speech,lessons:lessonsOf(v),dropped:v.dropped,hasPlayback:(v.status==='waiting'&&fs.existsSync(path.join(studyDir(v.id),'study.mp4')))||fs.existsSync(savedClip(v.id)),hasThumb:fs.existsSync(thumbFile(v.id)),
   similar:v.fingerprint&&['waiting','learned'].includes(v.status)?similar(v.id,3).map(s=>({id:s.id,title:s.title,alike:Math.round(s.likeness.overall*100),mostAlikeIn:s.mostAlikeIn})):[]})),
  patterns:p,lessons:uniq,groups:GROUPS.map(g=>({id:g.id,label:g.label,about:g.about,topics:g.topics})),
  conflicts:uniq.filter(l=>l.conflictWith&&l.status==='trial').map(l=>{const o=getKnowledge(l.conflictWith!);return o&&!['rejected','retired'].includes(o.status)?{lesson:l,against:lessonView(o)}:null;}).filter(Boolean),
  totals:{videos:vs.filter(v=>v.status==='learned').length,waiting:vs.filter(v=>v.status==='waiting').length,lessons:uniq.filter(l=>!['rejected','retired'].includes(l.status)).length,
   onTrial:uniq.filter(l=>l.status==='trial').length,kept:uniq.filter(l=>['approved','proven'].includes(l.status)).length,removed:uniq.filter(l=>['rejected','retired'].includes(l.status)).length,patterns:p.found.length},
  topics:TEACH_TOPICS.map(id=>({id,label:TOPIC_LABEL[id]}))};
}
/** A lesson the user writes themselves: kept at once, like their feedback. */
export function addLesson(o:{text:string;topics:string[];avoid?:boolean}){
 const text=o.text.replace(/\s+/g,' ').trim();if(text.length<15)throw new Error('Write the lesson as a full sentence: what to do, when, and how much');
 const topics=[...new Set(o.topics)].filter((t):t is Topic=>(TEACH_TOPICS as readonly string[]).includes(t));if(!topics.length)throw new Error('Choose at least one topic for the lesson');
 const motion=topics.some(x=>['motion','typography','color','design'].includes(x)),editing=topics.some(x=>['editing','captions'].includes(x));
 const a=add({title:text.split(/(?<=[.!?])\s/)[0]!.slice(0,100),body:text,domain:motion&&!editing?'motion':editing&&!motion?'editing':'both',kind:o.avoid?'avoid':'technique',tags:[...topics,'taught','mine'],source:'user',status:'approved'});
 return lessonView(a.knowledge);
}
/** The user's decision on a lesson: keep it (approved), remove it, or reword it. */
export function review(lessonId:string,action:'keep'|'remove'|'edit'|'both',edit:{title?:string;body?:string}={}){
 const k=getKnowledge(lessonId);if(!k)throw new Error('No lesson '+lessonId);
 return change({kind:'lessons',title:`Lesson ${({keep:'kept',both:'kept',remove:'removed',edit:'reworded'} as const)[action]}: ${k.title.slice(0,110)}`},()=>reviewNow(k,lessonId,action,edit));
}
function reviewNow(k:Knowledge,lessonId:string,action:'keep'|'remove'|'edit'|'both',edit:{title?:string;body?:string}){
 const clear=(x:Knowledge)=>add({id:x.id,title:x.title,body:x.body,domain:x.domain,kind:x.kind,tags:x.tags.filter(t=>t!=='conflict'),source:x.source,status:x.status});
 if(action==='remove'){setStatus(lessonId,'rejected','removed by the user on the Teach page');return {id:lessonId,status:'rejected'};}
 if(action==='edit'){const title=edit.title?.trim()||k.title,body=edit.body?.trim()||k.body;if(body.length<10)throw new Error('The lesson is too short');
  add({id:k.id,title:title.slice(0,100),body,domain:k.domain,kind:k.kind,tags:k.tags.filter(t=>t!=='conflict'),source:k.source,status:'approved'});return {id:lessonId,status:'approved',edited:true};}
 // Keeping one side of a conflict removes the other; "both" keeps the two.
 const other=k.tags.includes('conflict')?k.evidence.find(e=>e.startsWith('conflict:'))?.slice(9):undefined;
 clear(k);setStatus(lessonId,k.status==='proven'?'proven':'approved','kept by the user on the Teach page');
 if(action==='keep'&&other&&getKnowledge(other))setStatus(other,'rejected',`the user chose "${k.title}" instead`);
 return {id:lessonId,status:'approved',...(action==='keep'&&other?{removed:other}:{})};
}
