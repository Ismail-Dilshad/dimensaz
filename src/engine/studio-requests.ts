// Requests from the Studio page. The user briefs a video there (a motion video from a script, a
// prompt, a topic or only a link; or an edit of their footage, with instructions or none), the
// agent takes it in the terminal (`studio inbox`, `studio take`), and the page shows every step
// for the user to rate. A request is a folder: request.json and the files that came with it.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {z} from 'zod';
import {ROOT} from './config.js';
import {languageSchema} from './languages.js';
import {plan,next,readPlan,studioRoot,jobDir,roleOf,rate,verdict,predictionRecord,RATE_REASONS,type Plan,type Task,type RateInput} from './studio.js';
import {getKnowledge,allKnowledge} from './brain/db.js';
import {confidence} from './brain/brain.js';

const hex=z.string().regex(/^#[0-9a-fA-F]{6}$/,'Colours are written like #FF6B4A');
export const requestInput=z.object({
 mode:z.enum(['motion','edit']),
 /** The script, a prompt, a topic, or (for an edit) what to do; empty means the studio decides. */
 text:z.string().trim().max(12000).default(''),
 /** Whether the text is a finished script to use as written. */
 script:z.boolean().default(false),
 link:z.string().trim().url('The link must start with http').regex(/^https?:\/\//i,'The link must start with http').optional().or(z.literal('').transform(()=>undefined)),
 seconds:z.number().int().min(5).max(600).optional(),
 shape:z.enum(['vertical','horizontal','square']).optional(),
 language:languageSchema.optional(),
 voice:z.boolean().default(false),captions:z.boolean().default(true),visuals:z.boolean().default(true),
 /** The user picks between two looks. */
 pick:z.boolean().default(true),
 colors:z.object({primary:hex.optional(),accent:hex.optional(),background:hex.optional()}).strict().default({}),
 /** A video the user taught, to make this one in its spirit. */
 like:z.string().regex(/^[a-z0-9][a-z0-9-]{0,70}$/).optional(),
 /** The taste profile to follow (the main one when not given). */
 profile:z.string().regex(/^[a-z0-9][a-z0-9-]{0,40}$/).optional(),
 notes:z.string().trim().max(2000).default('')}).strict();
export type RequestInput=z.input<typeof requestInput>;
export const FILE_KINDS=['logo','footage','reference','asset'] as const;export type FileKind=typeof FILE_KINDS[number];
export type RequestFile={kind:FileKind;name:string;file:string;bytes:number};
export type StudioRequest={id:string;status:'draft'|'waiting'|'taken';created:string;updated:string;files:RequestFile[];input:z.output<typeof requestInput>|null;job?:string};

const now=()=>new Date().toISOString();
export const inboxRoot=()=>path.join(studioRoot(),'_inbox');
const dirOf=(id:string)=>{if(!/^r-[a-f0-9]{8}$/.test(id))throw new Error('Not a request id: '+id);return path.join(inboxRoot(),id);};
const save=(r:StudioRequest)=>{r.updated=now();fs.mkdirSync(dirOf(r.id),{recursive:true});fs.writeFileSync(path.join(dirOf(r.id),'request.json'),JSON.stringify(r,null,1)+'\n');return r;};
export function request(id:string):StudioRequest{try{return JSON.parse(fs.readFileSync(path.join(dirOf(id),'request.json'),'utf8')) as StudioRequest;}catch{throw new Error(`No request "${id}". See them with: pnpm tempoloom studio inbox`);}}
export function requests():StudioRequest[]{
 let names:string[]=[];try{names=fs.readdirSync(inboxRoot());}catch{return [];}
 return names.filter(n=>/^r-[a-f0-9]{8}$/.test(n)).map(n=>{try{return request(n);}catch{return null;}}).filter((r):r is StudioRequest=>!!r).sort((a,b)=>a.created.localeCompare(b.created));
}
export function newRequest(){const id='r-'+randomBytes(4).toString('hex'),stamp=now();return save({id,status:'draft',created:stamp,updated:stamp,files:[],input:null});}
const LIMITS:Record<FileKind,{ext:RegExp;max:number;what:string}>={logo:{ext:/^\.(png|svg|jpg|jpeg|webp)$/,max:1,what:'an image (PNG, SVG, JPG, WebP)'},footage:{ext:/^\.(mp4|mov|mkv|webm|avi|m4v|mp3|wav|m4a)$/,max:8,what:'a video or audio file'},
 reference:{ext:/^\.(mp4|mov|mkv|webm|m4v|png|jpg|jpeg|webp)$/,max:3,what:'a video or an image'},asset:{ext:/^\.(png|svg|jpg|jpeg|webp|mp4|mov|webm|mp3|wav|m4a|pdf|txt|md)$/,max:12,what:'an image, video, sound, PDF or text file'}};
/** Where an uploaded file of a request goes (the caller writes it there, then calls `addFile`). */
export function filePath(id:string,kind:FileKind,name:string){
 const r=request(id);if(r.status!=='draft')throw new Error('This request was already sent');
 if(!FILE_KINDS.includes(kind))throw new Error('Unknown kind of file');
 const base=path.basename(name).normalize('NFKC').replace(/[^\p{L}\p{N}._ -]+/gu,'-').slice(0,90)||'file',ext=path.extname(base).toLowerCase();
 if(!LIMITS[kind].ext.test(ext))throw new Error(`The ${kind} must be ${LIMITS[kind].what}`);
 if(r.files.filter(f=>f.kind===kind).length>=LIMITS[kind].max)throw new Error(`At most ${LIMITS[kind].max} ${kind} file${LIMITS[kind].max>1?'s':''}`);
 const dir=path.join(dirOf(id),'files',kind);fs.mkdirSync(dir,{recursive:true});
 let file=path.join(dir,base);for(let n=2;fs.existsSync(file);n++)file=path.join(dir,`${path.basename(base,ext)}-${n}${ext}`);
 return file;
}
export function addFile(id:string,kind:FileKind,file:string){const r=request(id);r.files.push({kind,name:path.basename(file),file,bytes:fs.statSync(file).size});return save(r);}
export async function removeFile(id:string,name:string){const r=request(id);if(r.status!=='draft')throw new Error('This request was already sent');
 const f=r.files.find(x=>x.name===name);if(!f)throw new Error('No such file in this request');await fsp.rm(f.file,{force:true});r.files=r.files.filter(x=>x!==f);return save(r);}
/** Sends a request to the studio: it now waits for the agent. */
export function submit(id:string,input:RequestInput){
 const r=request(id);if(r.status!=='draft')throw new Error('This request was already sent');
 return saveBrief(r,input);
}
export function editBrief(id:string,text:unknown){
 const r=request(id);
 if(r.status!=='waiting'||!r.input)throw new Error('Only queued briefs can be edited');
 return saveBrief(r,{...r.input,text:z.string().parse(text)});
}
function saveBrief(r:StudioRequest,input:RequestInput){
 const i=requestInput.parse(input);
 if(i.mode==='motion'&&!i.text&&!i.link)throw new Error('Give a script, a prompt, a topic or a link');
 if(i.mode==='motion'&&i.script&&i.text.length<20)throw new Error('The script is too short; untick "this is my finished script" to have one written');
 if(i.mode==='edit'&&!r.files.some(f=>f.kind==='footage'))throw new Error('Add the footage to edit');
 r.input=i;r.status='waiting';return save(r);
}
/** Removes a request that no job was planned from, with the copies of its files. */
export async function discard(id:string){const r=request(id);if(r.status==='taken')throw new Error(`This request became the job "${r.job}"; its files are that job's material and are kept`);
 await fsp.rm(dirOf(id),{recursive:true,force:true});return {removed:id};}

const rel=(f:string)=>path.relative(ROOT,f).split(path.sep).join('/');
const SHAPE={vertical:'vertical 9:16',horizontal:'horizontal 16:9',square:'square 1:1'} as const;
/** The request in words, for the plan and for every role's lessons. */
export function brief(r:StudioRequest){
 const i=r.input!,of=(k:FileKind)=>r.files.filter(f=>f.kind===k).map(f=>rel(f.file));
 const lines:string[]=[];
 if(i.mode==='motion'){
  lines.push(`A motion graphics video${i.seconds?`, about ${i.seconds} seconds`:''}${i.shape?`, ${SHAPE[i.shape]}`:''}${i.language?`, language: ${i.language}`:''}, ${i.voice?'with a voice-over':'without a voice-over'}.`);
  if(i.text)lines.push(i.script?`The user's finished script, to use as written:\n${i.text}`:`What the user wants (no script yet: research and write one):\n${i.text}`);
  else lines.push('No script and no prompt: build the video from the link (read it for the product, the facts and the brand).');
 }else{
  lines.push(`An edit of the user's footage${i.seconds?`, to about ${i.seconds} seconds`:''}${i.shape?`, ${SHAPE[i.shape]}`:''}${i.language?`, language: ${i.language}`:''}; captions: ${i.captions?'yes':'no'}; designed visuals over the footage: ${i.visuals?'yes, where they help':'no'}.`);
  lines.push(i.text?`What the user wants:\n${i.text}`:'The user gave no instructions: decide everything (what to keep, the cuts, captions, music, visuals) from the footage itself.');
  lines.push(`Footage: ${of('footage').join(', ')}`);
 }
 if(i.link)lines.push(`Link: ${i.link}`);
 if(of('logo').length)lines.push(`Logo: ${of('logo')[0]}`);
 const c=Object.entries(i.colors).filter(([,v])=>v).map(([k,v])=>`${k} ${v}`);if(c.length)lines.push(`Brand colours for this video: ${c.join(', ')}`);
 if(of('reference').length)lines.push(`Reference to study (never to copy): ${of('reference').join(', ')}`);
 if(i.like)lines.push(`In the spirit of the video the user taught: ${i.like} (pnpm tempoloom teach show ${i.like})`);
 if(i.profile&&i.profile!=='main')lines.push(`Taste profile: ${i.profile} (pnpm tempoloom taste show ${i.profile})`);
 if(of('asset').length)lines.push(`Other material: ${of('asset').join(', ')}`);
 if(i.notes)lines.push(`Notes: ${i.notes}`);
 return lines.join('\n');
}
/** Plans a waiting request into a studio job. */
export function take(id:string,o:{job?:string}={}){
 const r=request(id);if(r.status==='taken')throw new Error(`Already taken: job "${r.job}" (pnpm tempoloom studio next ${r.job})`);
 if(r.status!=='waiting'||!r.input)throw new Error('This request was not sent yet');
 const i=r.input,text=brief(r);
 const options=i.mode==='motion'?[...(i.script?[]:['write']),...(i.voice?['voice']:[]),...(i.pick?['pick']:[])]:[...(i.visuals?['visuals']:[])];
 const name=o.job??((i.text||i.link||'video').toLowerCase().normalize('NFKD').replace(/^https?:\/\/(www\.)?/,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,32).replace(/-+$/,'')||'video')+'-'+id.slice(2,6);
 const p=plan(text,{type:i.mode==='motion'?'script-to-motion':'footage-edit',options,job:name,source:id,...(i.profile?{profile:i.profile}:{})});
 fs.writeFileSync(path.join(jobDir(p.job),'request.md'),`# The request\n\n${text}\n`);
 r.status='taken';r.job=p.job;save(r);
 return {job:p.job,kind:p.title,request:path.join(jobDir(p.job),'request.md'),tasks:p.tasks.length,next:next(p.job),
  note:'Run it as the studio: studio start / done for each task. Add --show FILE to studio done for every picture, video or sound the user should see with that step; they rate each step on the Studio page.'};
}

function plans():Plan[]{
 let names:string[]=[];try{names=fs.readdirSync(studioRoot());}catch{return [];}
 return names.filter(n=>/^[a-z0-9][a-z0-9-]{0,60}$/.test(n)).map(n=>{try{return readPlan(n);}catch{return null;}}).filter((p):p is Plan=>!!p).sort((a,b)=>b.created.localeCompare(a.created));
}
const rated=(p:Plan,t:Task)=>(p.ratings??[]).find(r=>r.task===t.id&&r.round===t.rounds);
/** What the agent should do now: new requests to take, jobs with tasks ready, and what waits for the user. */
export function inbox(){
 const waiting=requests().filter(r=>r.status==='waiting'),jobs=plans().filter(p=>!p.tasks.every(t=>t.status==='done'));
 const work=jobs.map(p=>{const n=next(p.job);return {job:p.job,request:p.request.split('\n')[0]!.slice(0,120),done:`${n.done}/${n.of}`,ready:n.ready.map(x=>({task:x.task,role:x.role,...(x.status==='redo'?{redo:true}:{}),start:x.start})),
  waitingForUser:[...n.waitingForUser.map(g=>g.title),...((n as {userChooses?:{step:string}[]}).userChooses??[]).map(c=>`choose a version of ${c.step}`)],
  feedback:p.feedback.slice(-3).map(f=>f.rule)};});
 return {newRequests:waiting.map(r=>({id:r.id,mode:r.input!.mode,summary:brief(r).split('\n')[0],take:`pnpm tempoloom studio take ${r.id}`})),
  jobs:work.filter(j=>j.ready.length),waitingForTheUser:work.filter(j=>!j.ready.length&&j.waitingForUser.length).map(j=>({job:j.job,for:j.waitingForUser})),
  note:waiting.length||work.some(j=>j.ready.length)?'Take each new request, then run the ready tasks. The user approves and rates on the Studio page; run this again after they do.'
   :'Nothing to do now. The user briefs videos and rates steps on the Studio page: pnpm tempoloom studio open'};
}

/** The user's rating of the finished video: good scores the job as approved; "ok" (not bad)
 *  accepts it and leaves the lessons as they are; bad sends the reason back and reopens the final. */
export async function finalRating(job:string,i:RateInput){
 const p=readPlan(job),last=p.tasks.find(t=>t.id==='final');if(!last||last.status!=='done')throw new Error('The final video is not finished yet');
 if(i.rating==='bad')return rate(job,'final',i);
 if(!(p.ratings??[]).some(r=>r.task==='final'&&r.round===last.rounds))await rate(job,'final',i);
 return verdict(job,'approved',i.rating==='ok'?{score:false}:{});
}

// ---------- the Studio page ----------
const TEXT=/\.(md|txt|json|srt|vtt|csv)$/i,MEDIA:Record<string,'image'|'video'|'audio'>={'.png':'image','.jpg':'image','.jpeg':'image','.webp':'image','.gif':'image','.svg':'image','.mp4':'video','.webm':'video','.mov':'video','.m4v':'video','.mp3':'audio','.wav':'audio','.m4a':'audio'};
const readText=(f:string|undefined)=>{if(!f||!TEXT.test(f))return null;try{const s=fs.readFileSync(f,'utf8');return s.length>12000?s.slice(0,12000)+'\n…':s;}catch{return null;}};
const mediaOf=(f:string)=>MEDIA[path.extname(f).toLowerCase()]??null;
function jobView(p:Plan){
 const n=next(p.job),readyGates=new Set(n.waitingForUser.map(g=>g.gate));
 const tasks=p.tasks.map((t,index)=>{
  if(t.gate)return {id:t.id,gate:true as const,title:t.title,status:t.status==='done'?'approved' as const:readyGates.has(t.id)?'waiting' as const:'later' as const,
   blockedBy:readyGates.has(t.id)?t.needs.map(x=>p.tasks.find(y=>y.id===x)!).filter(x=>x.choices?.length&&!x.picked).map(x=>x.id):[]};
  const r=roleOf(t.role!),mine=(p.ratings??[]).filter(x=>x.task===t.id),current=rated(p,t);
  return {id:t.id,gate:false as const,title:t.title,owner:r.title,stage:t.stage,status:t.status,round:t.rounds+1,index,
   output:t.status==='done'||t.status==='redo'?readText(t.output):null,outputName:t.output?path.basename(t.output):null,note:t.note??null,
   show:(t.show??[]).map((f,k)=>({k,name:path.basename(f),type:mediaOf(f)})).filter(x=>x.type),
   choices:(t.choices??[]).map((c,k)=>({k,label:c.label,name:path.basename(c.file),type:mediaOf(c.file)})),picked:t.picked??null,
   lessons:[...new Set(t.applied)].map(id=>getKnowledge(id)).filter(k=>!!k).map(k=>({id:k!.id,title:k!.title,status:k!.status})),
   selfcheck:t.selfcheck?{verdict:t.selfcheck.verdict,profile:t.selfcheck.profile,attempt:t.selfcheck.attempt,accepted:t.selfcheck.accepted??null,passed:t.selfcheck.passed,near:t.selfcheck.near,off:t.selfcheck.off,checks:t.selfcheck.checks}:null,
   expected:t.predicted&&t.predicted.basis>=6&&t.status==='done'?t.predicted:null,
   rating:current?{rating:current.rating,reasons:current.reasons,note:current.note,parts:current.parts,rule:current.rule??null}:null,
   earlier:mine.filter(x=>x!==current).map(x=>({rating:x.rating,round:x.round+1,rule:x.rule??null})),
   canRate:t.status==='done'&&!current&&!['intake','brief','learn'].includes(t.id)};});
 const finished=p.tasks.every(t=>t.status==='done');
 let briefInput:unknown=null;if(p.source){try{briefInput=request(p.source).input;}catch{/* the request folder is gone */}}
 return {job:p.job,kind:p.title,mode:p.type==='footage-edit'?'edit':'motion',request:p.request,created:p.created,updated:p.updated,verdict:p.verdict??null,finished,archived:!!p.archived,brief:briefInput,
  ratings:(p.ratings??[]).map(r=>({task:r.task,rating:r.rating,round:r.round,at:r.at})),
  done:n.done,of:n.of,waitingFor:finished?'nothing':n.ready.length?'agent':n.waitingForUser.length?'you':'agent',
  agentReady:n.ready.map(x=>x.task),tasks,feedback:p.feedback.map(f=>({said:f.said,rule:f.rule,goesTo:f.roles.map(id=>roleOf(id).title)}))};
}
/** A file the Studio page may show: only one a task of this job listed (its output, --show, --choice). */
export function shownFile(job:string,index:number,slot:string){
 const t=readPlan(job).tasks[index];if(!t)throw new Error('No such step');
 const m=/^(show|choice)-(\d+)$/.exec(slot);if(!m)throw new Error('No such file');
 const f=m[1]==='show'?t.show?.[Number(m[2])]:t.choices?.[Number(m[2])]?.file;if(!f||!mediaOf(f))throw new Error('No such file');return f;
}
export function requestFile(id:string,name:string){const f=request(id).files.find(x=>x.name===name);if(!f)throw new Error('No such file');return f.file;}
/** Everything the Studio page shows. */
export function overview(){
 const jobs=plans().map(jobView),rs=requests().filter(r=>r.status!=='taken');
 const all=plans().flatMap(p=>(p.ratings??[]).map(r=>({...r,step:r.task})));
 const steps=[...new Set(all.map(r=>r.step))].map(step=>{const x=all.filter(r=>r.step===step);return {step,good:x.filter(r=>r.rating==='good').length,ok:x.filter(r=>r.rating==='ok').length,bad:x.filter(r=>r.rating==='bad').length};}).sort((a,b)=>b.good+b.bad-a.good-a.bad);
 const judged=jobs.filter(j=>j.verdict).length;
 // Is it getting better? For each video in order: how many steps were good the first time.
 const trend=plans().slice().reverse().map(p=>{const first=(p.ratings??[]).filter(r=>r.round===0);return {job:p.job,created:p.created,rated:first.length,good:first.filter(r=>r.rating==='good').length};}).filter(x=>x.rated);
 // The lessons ratings and picks have scored, best and worst.
 const scored=allKnowledge().filter(k=>k.evidence.some(e=>e.startsWith('rate:')||e.startsWith('pick:'))).map(k=>({id:k.id,title:k.title,status:k.status,wins:k.wins,losses:k.losses,confidence:Math.round(confidence(k)*100)}));
 return {requests:rs.map(r=>({id:r.id,status:r.status,created:r.created,files:r.files.map(f=>({kind:f.kind,name:f.name,bytes:f.bytes,type:mediaOf(f.file)})),input:r.input,summary:r.input?brief(r).split('\n')[0]:null})),
  jobs,scores:{steps,trend,guesses:predictionRecord(),best:scored.filter(k=>k.wins>k.losses).sort((a,b)=>b.confidence-a.confidence).slice(0,8),worst:scored.filter(k=>k.losses>=k.wins&&k.losses>0).sort((a,b)=>a.confidence-b.confidence).slice(0,8),ratings:all.length,good:all.filter(r=>r.rating==='good').length,bad:all.filter(r=>r.rating==='bad').length,jobs:jobs.length,finished:judged,
   rules:[...new Map(plans().flatMap(p=>p.feedback).map(f=>[f.rule,f])).values()].slice(-12).map(f=>f.rule)},
  reasons:Object.entries(RATE_REASONS).map(([id,r])=>({id,label:r.label})),
  totals:{waitingForAgent:rs.filter(r=>r.status==='waiting').length+jobs.filter(j=>!j.finished&&j.waitingFor==='agent').length,waitingForYou:jobs.filter(j=>j.waitingFor==='you').length,jobs:jobs.length}};
}
