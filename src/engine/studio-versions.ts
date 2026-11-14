// Every version of every step is kept: when a step finishes, its output and the files it showed
// the user (pictures, the preview, the final video, the looks to pick from) are copied into
// workspace/studio/JOB/versions/TASK/vN, so a redo never loses the one before. The page compares
// any two side by side and brings an earlier one back. A comment on a moment of a video shown with
// a step reopens only the scene at that moment: the step is redone for those scenes alone.
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {ROOT} from './config.js';
import {readPlan,jobDir,savePlan,reopenAfter,feedback,type Plan,type Task} from './studio.js';
import {ffmpeg,probe,run} from '../renderer/ffmpeg-encoder.js';
import {emit} from './studio-events.js';
import {change} from './history.js';

export type Version={n:number;round:number;at:string;output?:string;outputName?:string;show:string[];names:string[];
 choices?:{label:string;file:string;applied:string[]}[];picked?:string;applied:string[];note?:string;from?:number;
 /** Copied into the job's versions folder (false: the files are only referenced, from before versions were kept). */
 kept:boolean};
const now=()=>new Date().toISOString();
const MEDIA:Record<string,'image'|'video'|'audio'>={'.png':'image','.jpg':'image','.jpeg':'image','.webp':'image','.gif':'image','.svg':'image','.mp4':'video','.webm':'video','.mov':'video','.m4v':'video','.mp3':'audio','.wav':'audio','.m4a':'audio'};
const mediaOf=(f:string)=>MEDIA[path.extname(f).toLowerCase()]??null;
const TEXT=/\.(md|txt|json|srt|vtt|csv)$/i;
const file=(job:string)=>path.join(jobDir(job),'versions.json');
function readAll(job:string):Record<string,Version[]>{try{return JSON.parse(fs.readFileSync(file(job),'utf8')) as Record<string,Version[]>;}catch{return {};}}
function writeAll(job:string,v:Record<string,Version[]>){const tmp=file(job)+'.tmp';fs.writeFileSync(tmp,JSON.stringify(v,null,1)+'\n');fs.renameSync(tmp,file(job));}
const dirOf=(job:string,task:string,n:number)=>path.join(jobDir(job),'versions',task,'v'+n);
const safeName=(f:string)=>path.basename(f).normalize('NFKC').replace(/[^\p{L}\p{N}._ -]+/gu,'-').slice(0,90)||'file';
// A copy that shares the disk blocks where the file system allows it (copy-on-write), else a plain copy.
const copy=(from:string,to:string)=>{fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to,fs.constants.COPYFILE_FICLONE);return to;};

/** Keeps the version a step just finished as (called by studio done). A step finished twice in the
 *  same round replaces that round's copy. */
export function keepVersion(p:Plan,t:Task):Version{
 const all=readAll(p.job),list=all[t.id]??[],n=t.rounds+1;
 const old=list.find(v=>v.n===n);if(old?.kept&&!old.from)fs.rmSync(dirOf(p.job,t.id,n),{recursive:true,force:true});
 const dir=dirOf(p.job,t.id,n),here=(f:string)=>fs.existsSync(f)&&fs.statSync(f).isFile();
 const output=t.output&&here(t.output)?copy(t.output,path.join(dir,'output-'+safeName(t.output))):undefined;
 const show=(t.show??[]).filter(here).map((f,k)=>copy(f,path.join(dir,`${k}-${safeName(f)}`)));
 const choices=t.choices?.map((c,k)=>({label:c.label,file:here(c.file)?copy(c.file,path.join(dir,`choice-${k}-${safeName(c.file)}`)):c.file,applied:c.applied}));
 const v:Version={n,round:t.rounds,at:t.finished??now(),...(output?{output,outputName:path.basename(t.output!)}:{}),show,names:(t.show??[]).filter(here).map(f=>path.basename(f)),
  ...(choices?.length?{choices}:{}),...(t.picked?{picked:t.picked}:{}),applied:[...t.applied],...(t.note?{note:t.note}:{}),kept:true};
 all[t.id]=[...list.filter(x=>x.n!==n),v].sort((a,b)=>a.n-b.n);writeAll(p.job,all);
 return v;
}
/** How many kept versions each step of a job has. */
export function versionCounts(job:string):Record<string,number>{return Object.fromEntries(Object.entries(readAll(job)).map(([k,v])=>[k,v.length]));}
/** The versions of one step, oldest first. A step finished before versions were kept shows its
 *  current files as its only version. */
export function versionsOf(job:string,task:string):Version[]{
 const p=readPlan(job),t=p.tasks.find(x=>x.id===task);if(!t)throw new Error(`No task "${task}" in ${job}`);
 const list=readAll(job)[task]??[];
 if(!list.length&&(t.status==='done'||t.status==='redo')&&(t.output||t.show?.length))
  return [{n:t.rounds+1,round:t.rounds,at:t.finished??p.updated,...(t.output?{output:t.output,outputName:path.basename(t.output)}:{}),show:t.show??[],names:(t.show??[]).map(f=>path.basename(f)),
   ...(t.choices?.length?{choices:t.choices}:{}),...(t.picked?{picked:t.picked}:{}),applied:t.applied,...(t.note?{note:t.note}:{}),kept:false}];
 return list;
}
const readText=(f:string|undefined)=>{if(!f||!TEXT.test(f))return null;try{const s=fs.readFileSync(f,'utf8');return s.length>20000?s.slice(0,20000)+'\n…':s;}catch{return null;}};
/** What the page shows of every version: its files, text, rating and where it came from. */
export function versionsView(job:string,task:string){
 const p=readPlan(job),t=p.tasks.find(x=>x.id===task)!,list=versionsOf(job,task),current=t.status==='done'?t.rounds+1:null;
 return {job,task,title:t.title,status:t.status,current,canBringBack:t.status!=='doing'&&!t.gate,
  versions:list.map(v=>{const r=(p.ratings??[]).filter(x=>x.task===task&&x.round===v.round).at(-1);
   return {n:v.n,at:v.at,current:v.n===current,from:v.from??null,kept:v.kept,note:v.note??null,outputName:v.outputName??null,text:readText(v.output),
    show:v.show.map((f,k)=>({k,name:v.names[k]??path.basename(f),type:mediaOf(f)})).filter(x=>x.type),
    choices:(v.choices??[]).map((c,k)=>({k,label:c.label,type:mediaOf(c.file)})),picked:v.picked??null,
    rating:r?{rating:r.rating,note:r.note,reasons:r.reasons}:null,comments:(p.comments??[]).filter(c=>c.task===task&&c.round===v.round).length,lessons:v.applied.length};}).reverse()};
}
/** A file of one version, for the page (only files that version listed). */
export function versionFile(job:string,task:string,n:number,slot:string){
 const v=versionsOf(job,task).find(x=>x.n===n);if(!v)throw new Error('No such version');
 const m=/^(show|choice)-(\d+)$|^(output)$/.exec(slot);if(!m)throw new Error('No such file');
 const f=m[3]?v.output:m[1]==='show'?v.show[Number(m[2])]:v.choices?.[Number(m[2])]?.file;
 if(!f||!fs.existsSync(f))throw new Error('No such file');return f;
}

/** Brings an earlier version of a step back: it becomes the step's current version (a new round,
 *  to rate like any other), and every step built on it is reopened, as after feedback. */
export function bringBack(job:string,task:string,n:number){
 const p=readPlan(job),t=p.tasks.find(x=>x.id===task);if(!t)throw new Error(`No task "${task}" in ${job}`);
 if(t.gate)throw new Error('An approval has no versions');
 if(t.status==='doing')throw new Error('This step is being worked on now; bring a version back when it is finished');
 const v=versionsOf(job,task).find(x=>x.n===n);if(!v)throw new Error(`No version ${n} of "${task}". Versions: ${versionsOf(job,task).map(x=>x.n).join(', ')||'none'}`);
 if(t.status==='done'&&v.n===t.rounds+1)throw new Error(`Version ${n} is already the current one`);
 if(!v.kept)throw new Error('This version was made before versions were kept, so it cannot be brought back');
 const missing=[v.output,...v.show,...(v.choices??[]).map(c=>c.file)].filter((f):f is string=>!!f&&!fs.existsSync(f));
 if(missing.length)throw new Error(`Its files are gone: ${missing.map(f=>path.basename(f)).join(', ')}`);
 // The step's own output file in the job folder gets the old text back (the newer one is kept as its own version).
 const inJob=t.output&&path.dirname(path.resolve(t.output))===jobDir(job);
 if(v.output){if(inJob)fs.copyFileSync(v.output,t.output!);t.output=inJob?t.output:v.output;}
 Object.assign(t,{status:'done' as const,rounds:t.rounds+1,finished:now(),show:[...v.show],applied:[...v.applied],
  note:`The user brought back version ${n}.${v.note?' '+v.note:''}`});
 if(v.choices?.length){t.choices=v.choices.map(c=>({...c}));if(v.picked)t.picked=v.picked;else delete t.picked;}else{delete t.choices;delete t.picked;}
 delete t.selfcheck;delete t.predicted;delete t.held;delete t.scope;
 const reopened=reopenAfter(p,[t.id]);savePlan(p);
 const all=readAll(job),me:Version={...v,n:t.rounds+1,round:t.rounds,at:now(),from:n};all[task]=[...(all[task]??[]).filter(x=>x.n!==me.n),me];writeAll(job,all);
 emit(job,{type:'step.done',task,role:'you',face:'excited',text:`You brought back version ${n} of ${t.title}`,data:{version:n,reopened}});
 return {job,task,current:me.n,from:n,reopened};
}

// ---------- the scenes of a video, and comments on its moments ----------
export type Scene={n:number;start:number;end:number;id?:string;label:string};
export type Timeline={source:'scenes'|'cuts';duration:number;scenes:Scene[]};
const projectFile=(id:string)=>/^[a-z0-9][a-z0-9_-]{0,150}$/i.test(id)?path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','projects',id,'project.json'):null;
type ProjectScene={id:string;text:string;start:number;duration:number};
/** The scenes of the motion project a job made (studio done --link), read without loading the project. */
export function projectScenes(id:string|undefined):ProjectScene[]|null{
 const f=id?projectFile(id):null;if(!f)return null;
 try{const s=(JSON.parse(fs.readFileSync(f,'utf8')) as {scenes?:ProjectScene[]}).scenes;return Array.isArray(s)&&s.length?s:null;}catch{return null;}
}
/** A scene's fingerprint without its start (an earlier scene growing moves it, which is fine). */
export const sceneHash=(s:ProjectScene)=>{const {start:_,...rest}=s as ProjectScene&Record<string,unknown>;return createHash('sha1').update(JSON.stringify(rest)).digest('hex').slice(0,12);};
const clock=(t:number)=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
/** Where a video's scenes start and end: the project's own scenes when the video is that project's
 *  render, otherwise the cuts found in the picture. Worked out once and kept next to the file. */
export async function timeline(job:string,taskIndex:number,slot:string):Promise<Timeline>{
 const p=readPlan(job),t=p.tasks[taskIndex];if(!t)throw new Error('No such step');
 const m=/^show-(\d+)$/.exec(slot),f=m?t.show?.[Number(m[1])]:undefined;if(!f||mediaOf(f)!=='video')throw new Error('Not a video of this step');
 const st=fs.statSync(f),cache=path.join(jobDir(job),'versions','timelines',createHash('sha1').update(`${f}|${st.size}|${st.mtimeMs}|${p.videoJob??''}`).digest('hex').slice(0,16)+'.json');
 try{return JSON.parse(fs.readFileSync(cache,'utf8')) as Timeline;}catch{/* worked out below */}
 const info=await probe(f),duration=Number(info.format?.duration)||0;
 let out:Timeline|null=null;
 const ps=projectScenes(p.videoJob);
 if(ps){const total=ps.reduce((a,s)=>Math.max(a,s.start+s.duration),0);
  if(Math.abs(total-duration)<=Math.max(.5,duration*.03))out={source:'scenes',duration,scenes:ps.map((s,i)=>({n:i+1,start:+s.start.toFixed(3),end:+Math.min(duration,s.start+s.duration).toFixed(3),id:s.id,label:s.text.replace(/\s+/g,' ').slice(0,70)}))};}
 if(!out){
  const txt=await run(ffmpeg,['-v','error','-i',f,'-an','-vf',"select='gt(scene,0.3)',metadata=mode=print:file=-",'-f','null','-']).catch(()=>'');
  const cuts=[...txt.matchAll(/pts_time:([\d.]+)/g)].map(x=>Number(x[1])).filter(x=>x>.3&&x<duration-.3);
  const marks=[0,...cuts.filter((c,i)=>c>=.5&&(i===0||c-cuts[i-1]!>=.5)),duration];
  out={source:'cuts',duration,scenes:marks.slice(0,-1).map((s,i)=>({n:i+1,start:+s.toFixed(2),end:+marks[i+1]!.toFixed(2),label:`shot ${i+1}`}))};
 }
 fs.mkdirSync(path.dirname(cache),{recursive:true});fs.writeFileSync(cache,JSON.stringify(out));
 return out;
}
export type Comment={id:string;at:string;task:string;round:number;slot:string;time:number;scene:Scene;text:string;answered?:number};
export type CommentInput={slot:string;time:number;text:string};
/** Comments on moments of a step's video. Each lands on the scene playing at that moment; the step
 *  is redone for those scenes only (the rest must stay as it is), and the comments are kept on the
 *  job like any feedback (a rule for the step's role). */
export function comment(job:string,task:string,list:CommentInput[]){
 const p0=readPlan(job),t0=p0.tasks.find(x=>x.id===task);if(!t0)throw new Error(`No task "${task}" in ${job}`);
 return change({kind:'ratings',job,title:`You commented on ${list.length} moment${list.length===1?'':'s'} of ${t0.title}`},()=>commentNow(job,task,list));
}
async function commentNow(job:string,task:string,list:CommentInput[]){
 const p=readPlan(job),index=p.tasks.findIndex(x=>x.id===task),t=p.tasks[index];
 if(!t||t.gate)throw new Error(`No step "${task}" in ${job}`);
 if(t.status!=='done')throw new Error(`"${t.title}" is ${t.status==='doing'?'being worked on':t.status==='redo'?'already being redone':'not finished'}; comment on it when its video is shown`);
 const items=list.map(c=>({slot:String(c.slot),time:Number(c.time),text:String(c.text??'').replace(/\s+/g,' ').trim().slice(0,400)})).filter(c=>c.text);
 if(!items.length)throw new Error('Write what should change at that moment');
 if(items.length>20)throw new Error('At most 20 comments at once');
 const made:Comment[]=[];
 for(const c of items){
  if(c.text.length<3)throw new Error('Say what should change at that moment');
  const tl=await timeline(job,index,c.slot);if(!Number.isFinite(c.time)||c.time<0||c.time>tl.duration+.05)throw new Error(`${clock(c.time)} is not inside the video`);
  const scene=tl.scenes.find(s=>c.time>=s.start&&c.time<s.end)??tl.scenes.at(-1)!;
  made.push({id:'c-'+randomBytes(4).toString('hex'),at:now(),task,round:t.rounds,slot:c.slot,time:+c.time.toFixed(2),scene,text:c.text});
 }
 // Grouped by scene, in the order they play.
 const scenes=[...new Map(made.map(c=>[c.scene.n,c.scene])).values()].sort((a,b)=>a.n-b.n);
 const said=`${t.title}: `+made.map(c=>`at ${clock(c.time)} (${c.scene.id?`scene ${c.scene.n}`:c.scene.label}): ${c.text}`).join('; ');
 const fb=await feedback(job,said,{verdict:'revise',task});
 // After the feedback reopened the step: the comments, and the scenes the redo may change.
 const q=readPlan(job),tq=q.tasks.find(x=>x.id===task)!,ps=projectScenes(q.videoJob);
 q.comments=[...(q.comments??[]),...made];
 tq.scope={round:t.rounds,scenes:scenes.map(s=>({...s,comments:made.filter(c=>c.scene.n===s.n).map(c=>`${clock(c.time)}: ${c.text}`)})),
  ...(ps?{keep:Object.fromEntries(ps.filter(s=>!scenes.some(x=>x.id===s.id)).map(s=>[s.id,sceneHash(s)]))}:{})};
 savePlan(q);
 emit(job,{type:'feedback',role:'you',task,text:`You commented on ${scenes.length===1?'one scene':`${scenes.length} scenes`} of ${t.title}`,data:{comments:made.length,scenes:scenes.map(s=>s.n)}});
 return {job,task,comments:made.map(c=>({at:clock(c.time),scene:c.scene.n,label:c.scene.label,text:c.text})),scenes:scenes.map(s=>s.n),rule:fb.rule,reopened:fb.reopened,
  note:`Only ${scenes.length===1?`scene ${scenes[0]!.n}`:`scenes ${scenes.map(s=>s.n).join(', ')}`} of this step will change; the rest stays as it is.`};
}
/** The scenes a redo changed that the user did not comment on (empty when it kept to its scenes). */
export function outsideScope(p:Plan,t:Task):string[]{
 if(!t.scope?.keep)return [];const ps=projectScenes(p.videoJob);if(!ps)return [];
 return Object.entries(t.scope.keep).filter(([id,h])=>{const s=ps.find(x=>x.id===id);return !s||sceneHash(s)!==h;}).map(([id])=>{const i=ps.findIndex(x=>x.id===id);return i<0?`${id} (removed)`:`scene ${i+1}`;});
}
