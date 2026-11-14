// The studio: the organisation that runs every job (agent/studio.yaml). The Director plans a
// request into tasks, each owned by the role that is best at it; a task starts with that role's
// playbook, its inputs and what the brain has learned for that role, and ends with its output and
// the lessons it used. The user's feedback is routed to the roles responsible and reopens their
// tasks; a verdict scores every lesson the job used. Nothing is built without a plan.
import fs from 'node:fs';
import path from 'node:path';
import {parse} from 'yaml';
import {z} from 'zod';
import {ROOT} from './config.js';
import {recall,add,apply,verdict as brainVerdict,sync,getKnowledge,score,recordJob,type Recalled} from './brain/brain.js';
import {addFeedback,topicsOf,type Verdict} from './feedback.js';
import {forTopics,build as buildTaste} from './taste.js';
import {selfCheck,type SelfCheck} from './selfcheck.js';
import {confidence} from './brain/brain.js';
import {emit,events,WORKING_FACE} from './studio-events.js';
import {doctorScript} from './script-doctor.js';
import {change,touch,adapter,merge3,revertSet} from './history.js';
import {keepVersion,outsideScope,type Comment,type Scene} from './studio-versions.js';

const TOPICS=['motion','pacing','design','typography','color','captions','transitions','audio','voice','brand','cta','assets','kurdish','length','format','script','editing'] as const;
const roleSchema=z.object({id:z.string().regex(/^[a-z][a-z-]{1,30}$/),department:z.string(),title:z.string(),agent:z.string().optional(),independent:z.boolean().optional(),mission:z.string(),
 topics:z.array(z.enum(TOPICS)).min(1),domain:z.enum(['motion','editing','both']),guides:z.array(z.string()).min(1),commands:z.array(z.string()).min(1),steps:z.array(z.string()).min(2),checks:z.array(z.string()).min(1)}).strict();
const taskSchema=z.object({id:z.string().regex(/^[a-z][a-z-]{1,30}$/),stage:z.number().int().min(1).max(8),role:z.string().optional(),gate:z.boolean().optional(),title:z.string(),
 needs:z.array(z.string()).default([]),produces:z.string().optional(),when:z.enum(['write','voice','visuals','pick','second']).optional()}).strict();
const studioSchema=z.object({version:z.literal(1),
 director:z.object({id:z.literal('director'),title:z.string(),mission:z.string(),rules:z.array(z.string()).min(3)}).strict(),
 departments:z.array(z.object({id:z.string(),title:z.string(),lead:z.string().optional(),mission:z.string()}).strict()).min(2),
 roles:z.array(roleSchema).min(4),plans:z.record(z.string(),z.object({title:z.string(),tasks:z.array(taskSchema).min(4)}).strict())}).strict();
export type Studio=z.infer<typeof studioSchema>;export type Role=z.infer<typeof roleSchema>;
export const studioFile=()=>path.join(ROOT,'agent','studio.yaml');

let cached:Studio|undefined;
/** The organisation, checked: every task has a known role, every need a known task, every lead a role. */
export function loadStudio():Studio{
 if(cached)return cached;
 const s=studioSchema.parse(parse(fs.readFileSync(studioFile(),'utf8')));const roles=new Set(s.roles.map(r=>r.id));
 for(const r of s.roles)if(!s.departments.some(d=>d.id===r.department))throw new Error(`studio.yaml: role ${r.id} is in an unknown department ${r.department}`);
 for(const d of s.departments)if(d.lead&&!roles.has(d.lead))throw new Error(`studio.yaml: department ${d.id} has an unknown lead ${d.lead}`);
 for(const [name,p] of Object.entries(s.plans)){const ids=new Set(p.tasks.map(t=>t.id));
  for(const t of p.tasks){if(!t.gate&&t.role!=='director'&&!roles.has(t.role??''))throw new Error(`studio.yaml: plan ${name}, task ${t.id} has an unknown role ${t.role}`);
   if(t.gate&&t.role)throw new Error(`studio.yaml: plan ${name}, gate ${t.id} must not have a role`);
   for(const n of t.needs)if(!ids.has(n))throw new Error(`studio.yaml: plan ${name}, task ${t.id} needs an unknown task ${n}`);}}
 return cached=s;
}
export function roleOf(id:string):Role|{id:'director';title:string;mission:string;department:'direction';topics:string[];domain:'both';guides:string[];commands:string[];steps:string[];checks:string[];agent?:undefined;independent?:undefined}{
 const s=loadStudio();if(id==='director')return {id:'director',title:s.director.title,mission:s.director.mission,department:'direction',topics:[...TOPICS],domain:'both',
  guides:['agent/workflow.md','agent/policies.md','docs/guides/studio.md'],commands:['pnpm tempoloom studio status JOB','pnpm tempoloom studio next JOB'],steps:s.director.rules,checks:['The plan is up to date; every gate has the user\'s own yes.']};
 const r=s.roles.find(x=>x.id===id);if(!r)throw new Error('No role '+id);return r;
}

// ---------- jobs ----------
type Status='todo'|'doing'|'done'|'redo';
export type Task={id:string;stage:number;role?:string;gate?:boolean;title:string;needs:string[];produces?:string;status:Status;output?:string;note?:string;
 applied:string[];learned:string[];started?:string;finished?:string;rounds:number;
 /** Files to show the user with this step (frames, a preview video, a sound sample). */
 show?:string[];
 /** Two or more versions to choose between, each with the lessons only it used. */
 choices?:{label:string;file:string;applied:string[]}[];picked?:string;
 /** The agent's own check of the video this step made, before the user sees it. */
 selfcheck?:SelfCheck;
 /** What the studio expects the user to say about this step, from their earlier ratings. */
 predicted?:{good:number;reasons:string[];basis:number};held?:number;
 /** After comments on moments of its video: the scenes this redo may change, and how the others looked. */
 scope?:{round:number;scenes:(Scene&{comments:string[]})[];keep?:Record<string,string>}};
export type Rating={at:string;task:string;round:number;rating:'good'|'ok'|'bad';predicted?:number;reasons:string[];note:string;parts:{part:string;rating:'good'|'bad';note:string}[];scored:string[];rule?:string;reopened:string[]};
export type Plan={version:1;job:string;type:string;title:string;request:string;options:string[];created:string;updated:string;videoJob?:string;verdict?:string;
 tasks:Task[];feedback:{at:string;said:string;rule:string;verdict:Verdict;lesson:string;topics:string[];roles:string[];reopened:string[]}[];
 /** The user's rating of each step (the Studio page, or `studio rate`). */
 ratings?:Rating[];
 /** The request from the Studio page this job was planned from. */
 source?:string;
 /** Hidden from the Studio page's list (nothing is deleted). */
 archived?:boolean;
 /** The taste profile this job follows (main when not set). */
 profile?:string;
 /** The second reviewer's taste: another profile, or a general viewer when not set. */
 secondProfile?:string;
 /** The user's comments on moments of the videos steps showed. */
 comments?:Comment[]};
const now=()=>new Date().toISOString();
const slug=(s:string)=>s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);
export const studioRoot=()=>path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','studio');
/** A second opinion, read: the points it disagrees on, or that it agrees with everything. */
export function opinionOf(md:string){
 const s=md.replace(/\r\n/g,'\n'),i=s.search(/^##\s*Disagree/im);let points:string[]=[];
 if(i>=0){const rest=s.slice(i).split('\n').slice(1),end=rest.findIndex(l=>/^##\s/.test(l));points=(end<0?rest:rest.slice(0,end)).map(l=>l.trim()).filter(l=>/^[-*\d]/.test(l)).map(l=>l.replace(/^([-*]|\d+[.)])\s*/,'')).filter(l=>l.length>3);}
 const none=/no disagreement:\s*\S/i.test(s);
 return {points,none:none&&!points.length,agree:(()=>{const j=s.search(/^##\s*Agree/im);if(j<0)return [] as string[];const rest=s.slice(j).split('\n').slice(1),end=rest.findIndex(l=>/^##\s/.test(l));return (end<0?rest:rest.slice(0,end)).map(l=>l.trim()).filter(l=>/^[-*\d]/.test(l)).map(l=>l.replace(/^([-*]|\d+[.)])\s*/,''));})()};
}
/** The job's script: the user's own (written when the request is taken) or the scriptwriter's. */
export const scriptOf=(job:string)=>path.join(jobDir(job),'script.txt');
export const jobDir=(job:string)=>{if(!/^[a-z0-9][a-z0-9-]{0,60}$/.test(job))throw new Error('Not a studio job name: '+job);return path.join(studioRoot(),job);};
export function readPlan(job:string):Plan{try{return JSON.parse(fs.readFileSync(path.join(jobDir(job),'plan.json'),'utf8')) as Plan;}catch{throw new Error(`No studio job "${job}". Start one: pnpm tempoloom studio plan "REQUEST" --type TYPE`);}}
const deletedPlan=(job:string)=>path.join(jobDir(job),'deleted-plan.json');
export function deleteJob(job:string){
 readPlan(job);
 fs.renameSync(path.join(jobDir(job),'plan.json'),deletedPlan(job));
 return {deleted:job};
}
/** What the change history keeps of a job: the user's ratings, words and choices, and each step's state. */
const planState=(p:Plan)=>({ratings:p.ratings??[],feedback:p.feedback,comments:p.comments??[],verdict:p.verdict??null,
 tasks:Object.fromEntries(p.tasks.map(t=>[t.id,{status:t.status,picked:t.picked??null,applied:t.applied,note:t.note??null,scope:t.scope??null}]))});
type PlanState=ReturnType<typeof planState>;
function save(p:Plan){
 if(fs.existsSync(deletedPlan(p.job)))throw new Error('This job was deleted');
 touch('plan',p.job,()=>{try{return planState(readPlan(p.job));}catch{return null;}},`The video ${p.job}`);
 p.updated=now();const dir=jobDir(p.job);fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'plan.json'),JSON.stringify(p,null,1)+'\n');fs.writeFileSync(path.join(dir,'plan.md'),planMarkdown(p));return p;}
export const savePlan=(p:Plan)=>save(p);
/** Reopens everything built on the given steps (and asks their approvals again); returns what it reopened. */
export function reopenAfter(p:Plan,ids:string[]){
 const reopened:string[]=[],from=new Set(ids);
 for(let changed=true;changed;){changed=false;for(const t of p.tasks)if(t.status==='done'&&t.needs.some(n=>from.has(n))){t.status=t.gate?'todo':'redo';reopened.push(t.id);from.add(t.id);changed=true;}}
 return reopened;
}
const taskOf=(p:Plan,id:string)=>{const t=p.tasks.find(x=>x.id===id);if(!t)throw new Error(`No task "${id}" in ${p.job}. Tasks: ${p.tasks.map(x=>x.id).join(', ')}`);return t;};
const ready=(p:Plan,t:Task)=>t.status!=='done'&&t.needs.every(n=>taskOf(p,n).status==='done');
const blockers=(p:Plan,t:Task)=>t.needs.filter(n=>taskOf(p,n).status!=='done');

/** Plans a request: the task tree of its kind, with the options it was given (write, voice, visuals). */
export function plan(request:string,o:{type:string;job?:string;options?:string[];source?:string;profile?:string;secondProfile?:string}):Plan{
 const s=loadStudio(),tpl=s.plans[o.type];if(!tpl)throw new Error(`Unknown kind of request "${o.type}". Kinds: ${Object.keys(s.plans).join(', ')}`);
 if(!request.trim())throw new Error('Give the request in the user\'s words');
 const options=[...new Set(o.options??[])];for(const x of options)if(!['write','voice','visuals','pick','second'].includes(x))throw new Error('Options are: write, voice, visuals, pick, second');
 let job=o.job??(slug(request)||'job');if(!o.job){const base=job;for(let i=2;fs.existsSync(path.join(studioRoot(),job));i++)job=`${base.slice(0,36)}-${i}`;}
 else if(fs.existsSync(path.join(jobDir(job),'plan.json')))throw new Error(`Studio job "${job}" already exists: pnpm tempoloom studio status ${job}`);
 const kept=tpl.tasks.filter(t=>!t.when||options.includes(t.when)),ids=new Set(kept.map(t=>t.id));
 const tasks:Task[]=kept.map(t=>({id:t.id,stage:t.stage,...(t.role?{role:t.role}:{}),...(t.gate?{gate:true}:{}),title:t.title,needs:t.needs.filter(n=>ids.has(n)),...(t.produces?{produces:t.produces}:{}),status:'todo',applied:[],learned:[],rounds:0}));
 const made=save({version:1,job,type:o.type,title:tpl.title,request:request.trim(),options,created:now(),updated:now(),tasks,feedback:[],ratings:[],...(o.source?{source:o.source}:{}),...(o.profile?{profile:o.profile}:{}),...(o.secondProfile?{secondProfile:o.secondProfile}:{})});
 emit(job,{type:'job.planned',role:'director',face:'planning',text:`Planned ${tasks.length} steps: ${tpl.title}`,data:{type:o.type,options}});
 return made;
}

/** What can be done now: tasks whose needs are done, and gates waiting for the user. */
export function next(job:string){
 const p=readPlan(job),open=p.tasks.filter(t=>ready(p,t));
 const toPick=open.filter(t=>t.gate).flatMap(g=>g.needs.map(n=>taskOf(p,n))).filter(x=>x.choices?.length&&!x.picked);
 return {job,done:p.tasks.filter(t=>t.status==='done').length,of:p.tasks.length,
  ...(toPick.length?{userChooses:toPick.map(x=>({step:x.id,versions:x.choices!.map(c=>c.label),pick:`pnpm tempoloom studio pick ${job} ${x.id} "LABEL"`}))}:{}),
  ready:open.filter(t=>!t.gate).map(t=>({task:t.id,role:t.role,title:t.title,status:t.status,department:roleOf(t.role!).department,start:`pnpm tempoloom studio start ${job} ${t.id}`})),
  waitingForUser:open.filter(t=>t.gate).map(t=>({gate:t.id,title:t.title,approve:`pnpm tempoloom studio approve ${job} ${t.id}`})),
  ...(p.tasks.every(t=>t.status==='done')?{finished:true,then:`pnpm tempoloom studio retro ${job}`}:{})};
}

// ---------- what a role knows ----------
export type Lesson={id:string;title:string;use:string;kind:string;status:string;always:boolean;yours:boolean};
/** The brain's knowledge for one role: rules and preferences on its topics (general ones go to
 *  everyone), lessons it learned itself, and the best-matching techniques of its craft. */
export function lessonsFor(roleId:string,request:string,limit=8):Lesson[]{
 const r=roleOf(roleId),mine='role:'+r.id,all=new Set<string>(TOPICS);
 const got=recall(`${request} ${r.title} ${r.topics.join(' ')}`,{...(r.domain!=='both'?{domain:r.domain}:{}),limit:60}).items;
 // An item's topics: its tags, and what its title says (starting knowledge is not tagged by topic).
 const fit=(k:Recalled)=>{const topics=new Set([...k.tags.filter(t=>all.has(t)),...topicsOf(k.title,k.tags.join(' '))]);
  const own=k.tags.includes(mine),other=!own&&k.tags.some(t=>t.startsWith('role:')),topical=(r.topics as string[]).some(t=>topics.has(t)),general=!topics.size;
  if(other)return 0;if(own)return 3;if(topical)return 2;return k.always&&general?1:0;};
 const out=got.filter(k=>k.kind!=='tool').map(k=>({k,f:fit(k)})).filter(x=>x.f>0);
 // Variety: the role's own lessons first, and at most three reference studies.
 let refs=0;const always=out.filter(x=>x.k.always),rest=out.filter(x=>!x.k.always).sort((a,b)=>b.f-a.f).filter(x=>!x.k.id.startsWith('ref-')||++refs<=3).slice(0,limit);
 return [...always,...rest].map(({k,f})=>({id:k.id,title:k.title,use:k.use,kind:k.kind,status:k.status,always:k.always,yours:f===3}));
}

/** Starts a task: the role's playbook, the task's inputs, what the brain has for this role and the
 *  user's feedback on this job that concerns it. */
export function start(job:string,taskId:string){
 const p=readPlan(job),t=taskOf(p,taskId);
 if(t.gate)throw new Error(`"${taskId}" is the user's approval, not a task: show them the work, then pnpm tempoloom studio approve ${job} ${taskId}`);
 const block=blockers(p,t);if(block.length)throw new Error(`"${taskId}" cannot start yet. First: ${block.map(b=>{const x=taskOf(p,b);return x.gate?`${b} (the user's approval)`:`${b} (${x.role})`;}).join(', ')}`);
 const r=roleOf(t.role!),dir=jobDir(job),lessons=lessonsFor(r.id,p.request);
 if(t.status!=='doing'){t.rounds+=t.status==='redo'||t.status==='done'?1:0;t.status='doing';t.started=now();delete t.selfcheck;delete t.predicted;save(p);
  emit(job,{type:'step.started',task:t.id,role:r.id,face:WORKING_FACE[r.id]??'thinking',text:`Started: ${t.title}${t.rounds?` (round ${t.rounds+1})`:''}`});}
 // The second reviewer watches with a different taste: another of the user's profiles, or a general
 // viewer who knows none of the user's own lines (only the brain's general principles).
 const second=r.id==='critic',other=second&&p.secondProfile&&p.secondProfile!==(p.profile??'main')?p.secondProfile:null,
  taste=second?(other?forTopics(other,r.topics as string[])??{profile:other,lines:[] as string[],targets:[] as string[],full:`pnpm tempoloom taste show ${other}`}:null):forTopics(p.profile??'main',r.topics as string[]);
 const fb=p.feedback.filter(f=>f.roles.includes(r.id)||r.id==='director');
 return {job,task:t.id,title:t.title,request:p.request,...(t.rounds?{round:t.rounds+1}:{}),
  role:{id:r.id,title:r.title,department:r.department,mission:r.mission,steps:r.steps,guides:r.guides,commands:r.commands,checks:r.checks},
  inputs:[...t.needs.map(n=>taskOf(p,n)).filter(x=>x.output).map(x=>({from:x.id,by:x.role,file:x.output,...(x.note?{note:x.note}:{})})),
   ...(fs.existsSync(scriptOf(job))&&!t.needs.some(n=>taskOf(p,n).output===scriptOf(job))&&t.id!=='script'?[{from:'the script',by:'the user',file:scriptOf(job),note:'The script to use, word for word. Read this file, not the request: the user may have kept improved lines.'}]:[])],
  ...(fb.length?{feedbackOnThisJob:fb.map(f=>({said:f.said,rule:f.rule,verdict:f.verdict}))}:{}),
  ...(taste?{taste:{note:second?`Your taste for this review: the "${p.secondProfile}" profile, not the one the video was made for. Judge with it.`:'What this user likes. Start from it; a line the brief contradicts gives way to the brief.',...taste}}:{}),
  ...(second&&!taste?{lens:'You are a general viewer: you know none of this user\'s own taste lines. Judge by the general principles in your lessons and by what someone seeing it for the first time on a phone feels. Where the user\'s taste and a general viewer would differ, say so: that is the point of your review.'}:{}),
  ...(CHECKED.has(t.id)&&hasTargets(p)?{checkYourOwnVideo:`Before you finish: pnpm tempoloom studio check ${job} ${t.id} VIDEO.mp4. It measures your video against the user's taste and gives frame sheets to look at. Fix what is off, render again, check again; then studio done.`}:{}),
  ...(t.scope?{onlyScenes:{note:`The user commented on ${t.scope.scenes.length===1?'one scene':`${t.scope.scenes.length} scenes`} of the last version. Change ${t.scope.scenes.length===1?'that scene':'those scenes'} only, for what they said; keep every other scene exactly as it is (its words, timing, look and motion). The render reuses nothing that changed, so keep the rest untouched.${t.scope.keep?' studio done checks that the other scenes are unchanged.':''}`,
   scenes:t.scope.scenes.map(s=>({scene:s.n,...(s.id?{id:s.id}:{}),from:s.start,to:s.end,shows:s.label,userSaid:s.comments}))}}:{}),
  ...(p.type==='footage-edit'&&t.id==='cut-plan'?{editByText:`Plan the cuts from the words: pnpm tempoloom edit text FOOTAGE --job ${job} (the footage files are in the request). It finds fillers, long pauses and lines said more than once (the strongest take kept, with why), ranks the ten best openings and suggests b-roll from the user's clips. Read it with edit text DOC; decide with --hook RANK, --take GROUP N, --cut N, --shape 9:16 (it follows the speaker), --broll N on. The user sees it on the Edit by text page and can strike or bring back any sentence; make the edit with edit text DOC --render and show it with --show.`}:{}),
  ...(p.type==='footage-edit'&&t.id==='analysis'?{brollClips:'If the user added clips of their own (pnpm tempoloom edit broll list), look at each shot\'s sheet and describe what it shows in a few plain words: edit broll describe CLIP SHOT "WHAT IT SHOWS" --agent. The edit suggests a shot where what is said matches its description.'}:{}),
  ...(p.type==='footage-edit'&&t.id==='analysis'?{cleanUp:'Check how much each clip shakes: pnpm tempoloom media shake FILE... (steady, fix, or too shaky to save: tell the user which clips are too shaky and suggest another take). A screen recording: pnpm tempoloom media screen FILE --plan (the cursor, the clicks to zoom on, the waiting to trim).'}:{}),
  ...(t.id==='final'?{publishKit:'Covers: write two to four titles (under 60 characters; pnpm tempoloom publish titles suggests some from the words) and run publish covers FILE --titles "One|Two"; show the user the covers sheet to choose. When they will post it: publish package FILE --for tiktok,reels,shorts (or youtube) with the title, caption and hashtags you wrote; fix what its checks mark. Nothing is posted for them. A timeline for Premiere, Resolve or Final Cut only when they ask: pnpm tempoloom edit export EDIT.json --to premiere.'}:{}),
  ...(p.type==='footage-edit'&&t.id==='finish'?{cleanUp:'Steady shaky clips with the steady operation (or media stabilize FILE). Blur faces of other people, number plates or phone numbers only when the user asked: media blur FILE (or the blur operation from media private --edl-out); the speaker is never blurred unless they ask.'}:{}),
  ...(t.id==='script'?{scriptDoctor:`When it is written: pnpm tempoloom write --doctor ${scriptOf(job)}. Rewrite every weak line and give every figure, price, date and claim a source (write --source ... --url) or take it out, until it reports nothing. Only if the brief asks for a line as it is: write --accept ${scriptOf(job)} --why "WHY".`}:{}),
  ...(t.id==='brief'&&!p.options.includes('write')&&fs.existsSync(scriptOf(job))?{scriptDoctor:`The user wrote the script (${scriptOf(job)}). Never change it yourself. Run pnpm tempoloom write --doctor ${scriptOf(job)}; for each weak line add one better version with write --suggest ${scriptOf(job)} --line N --text "..." --why "...", and give each figure you can source a link with write --source. The user keeps or declines each suggestion on the Studio page before the storyboard starts.`}:{}),
  ...(t.id==='style'&&p.options.includes('pick')?{twoVersions:`The user chooses the look. Make two clearly different looks (not two shades of one), each with a sample frame, and finish with: --choice "A: NAME|SAMPLE.png|LESSON_ID,LESSON_ID" --choice "B: NAME|SAMPLE.png|LESSON_ID". Give each the lesson ids only it used; --applied takes the ids both used. Write both in ${t.produces??'the output'}; the user's pick arrives as a note to the next roles.`}:{}),
  lessons:{note:'Apply every "always" lesson. Use the others where they fit. Name the ids you used in --applied when you finish.',items:lessons},
  delegate:r.id==='director'?'This task is the Director\'s own: do it yourself.':r.independent?`This task must be done by someone who did not make the work: the ${r.agent} sub-agent (give it the job and task names), or on a host without sub-agents a fresh session or another AI started from \`pnpm tempoloom studio prompt ${job} ${t.id}\`.`
   :r.agent?`This is the ${r.title}'s task: hand it to the ${r.agent} sub-agent with the job and task names, or do it yourself with this playbook when your host has no sub-agents.`
   :`Do it with this playbook. When it is heavy or can run beside another task, hand it to the tempoloom-specialist sub-agent (job and task names), or to any other AI with \`pnpm tempoloom studio prompt ${job} ${t.id}\`.`,
  ...(t.produces?{writeTo:path.join(dir,t.produces)}:{}),
  finish:`pnpm tempoloom studio done ${job} ${t.id}${t.produces?` --output ${path.join(dir,t.produces)}`:''} --applied ID,ID [--learned "what you would do again, with numbers"] [--note "one line for the next role"]`};
}

/** A complete brief for one task, for any AI that is not in this conversation (another tool, a
 *  fresh session, a host without sub-agents): what the studio is, the task, and the two commands
 *  that give it the role's playbook and lessons and record its work. Nothing here depends on a host. */
export function prompt(job:string,taskId:string){
 const p=readPlan(job),t=taskOf(p,taskId);if(t.gate)throw new Error(`"${taskId}" is the user's approval, not a task`);
 const r=roleOf(t.role!),dir=jobDir(job);
 return `You are the ${r.title} of the Tempoloom studio, working in the project at ${ROOT}. ${r.mission}

Your task: ${t.title} (job "${job}", task "${t.id}").
The request: ${p.request}

1. Run \`pnpm tempoloom studio start ${job} ${t.id}\` from the project root. It returns your playbook (steps, guides to read, commands, checks), your inputs (files made by earlier tasks), the lessons the studio has learned for your role and the user's feedback on this job.
2. Read the inputs and the guides. Apply every lesson marked "always"; use the others where they fit.
3. Do the task with the commands of your playbook.${t.produces?` Write the result to ${path.join(dir,t.produces)}.`:''}
4. Check the result against your playbook's checks.
5. Run \`pnpm tempoloom studio done ${job} ${t.id}${t.produces?` --output ${path.join(dir,t.produces)}`:''} --applied ID,ID\` with the lesson ids you used (or \`--applied none\`), \`--learned "what you would do again, with numbers"\` if the task taught you something, and \`--note "one line for the next role"\`.
${r.independent?'\nYou are independent: read the request, the approved script and the preview only, not the makers\' notes, and fix nothing yourself.\n':''}
Do not talk to the user, approve anything or start other tasks. Finish with a short report: the output file, what you decided and why, the lessons you applied, and anything the next role must know.
`;
}

/** Finishes a task: its output must exist; the lessons it used are kept for the verdict; something
 *  it learned becomes this role's own lesson in the brain (a trial until a verdict proves it). */
export function done(job:string,taskId:string,o:{output?:string;applied?:string[];learned?:string[];note?:string;link?:string;show?:string[];choices?:string[];anyway?:boolean}={}){
 const p=readPlan(job),t=taskOf(p,taskId);
 if(t.gate)throw new Error(`"${taskId}" is the user's approval: pnpm tempoloom studio approve ${job} ${taskId}`);
 if(t.status==='todo')throw new Error(`Start it first, to get the playbook and the lessons: pnpm tempoloom studio start ${job} ${taskId}`);
 const r=roleOf(t.role!),out=o.output?path.resolve(o.output):t.output;
 if(t.produces){if(!out)throw new Error(`"${taskId}" produces ${t.produces}: write it and pass --output`);
  if(!fs.existsSync(out)||!fs.statSync(out).size)throw new Error('The output does not exist or is empty: '+out);}
 // Learning every time: a role that was given rules says which it used (or "none"), and the job's
 // last task needs the user's verdict.
 if(o.applied===undefined&&!t.applied.length&&lessonsFor(r.id,p.request).some(l=>l.always))throw new Error(`Say which lessons this task used: --applied ID,ID (the ids from studio start), or --applied none`);
 if(CHECKED.has(t.id)&&hasTargets(p)){
  const c=t.selfcheck;
  if(!c)throw new Error(`Watch your own video before the user does: pnpm tempoloom studio check ${job} ${taskId} VIDEO.mp4`);
  if(c.verdict==='fix'&&!c.accepted&&c.attempt<3)throw new Error(`Your check found ${c.off} thing${c.off>1?'s':''} off the user's taste. Fix, render again and check again (attempt ${c.attempt} of 3), or accept with a reason when the brief asks for it: studio check ${job} ${taskId} VIDEO.mp4 --accept "WHY". Off: ${c.checks.filter(x=>x.verdict==='off').map(x=>x.fix).join(' ')}`);
 }
 // A script the studio wrote is finished only when every line is strong enough and every figure has a source.
 if(t.id==='script'&&out&&fs.existsSync(out)){const d=doctorScript(out);if(!d.answered)throw new Error(`The script doctor still finds ${d.weak.length?`weak line${d.weak.length>1?'s':''} ${d.weak.join(', ')}`:''}${d.weak.length&&d.unsourced.length?' and ':''}${d.unsourced.length?`no source for ${d.unsourced.map(u=>`"${u.claim}" (line ${u.line})`).join(', ')}`:''}. Fix them and run pnpm tempoloom write --doctor ${out}; keep a line as it is only when the brief asks: write --accept ${out} --why "WHY".`);}
 // A second opinion says where it disagrees, or that it does not, and why.
 if(t.id==='second'&&out&&fs.existsSync(out)){const o=opinionOf(fs.readFileSync(out,'utf8'));if(!o.points.length&&!o.none)throw new Error('Write the second opinion with a section "## Disagree" (one line per point: the time or scene, what you see, why, and the role that fixes it), or one line "No disagreement:" and why.');}
 // A redo after comments on some scenes keeps the others as they were.
 if(t.scope&&!o.anyway){const off=outsideScope(p,t);if(off.length)throw new Error(`The user commented on ${t.scope.scenes.map(s=>'scene '+s.n).join(', ')} only, but ${off.join(', ')} changed too. Put ${off.length>1?'them':'it'} back as ${off.length>1?'they were':'it was'}, or finish with --anyway and say why in --note.`);}
 if(t.id==='learn'&&!p.verdict)throw new Error(`Ask the user for their verdict first: pnpm tempoloom studio verdict ${job} approved|revised|rejected`);
 const applied=[...new Set(o.applied??[])].filter(id=>id!=='none'),added:string[]=[];
 // Files for the user to see with this step, and versions to choose between.
 const seen=(f:string)=>{const abs=path.resolve(f);if(!fs.existsSync(abs)||!fs.statSync(abs).isFile())throw new Error('No such file to show: '+f);return abs;};
 const show=(o.show??[]).map(seen);
 const choices=(o.choices??[]).map(c=>{const [label,file,ids]=c.split('|').map(x=>x.trim());if(!label||!file)throw new Error('--choice "A: NAME|SAMPLE_FILE|LESSON_ID,LESSON_ID"');
  const own=(ids??'').split(',').map(x=>x.trim()).filter(x=>x&&x!=='none');const bad=own.filter(id=>!getKnowledge(id));if(bad.length)throw new Error('Unknown lesson ids in --choice: '+bad.join(', '));
  return {label,file:seen(file),applied:own};});
 if(choices.length===1)throw new Error('Give at least two versions to choose between (--choice twice), or none');
 if(t.id==='style'&&p.options.includes('pick')&&choices.length<2&&!t.picked)throw new Error('The user chooses the look for this job: give two versions with --choice "A: NAME|SAMPLE.png|IDS" --choice "B: NAME|SAMPLE.png|IDS"');
 const unknown=applied.filter(id=>!getKnowledge(id));
 if(unknown.length)throw new Error('Unknown lesson ids: '+unknown.join(', ')+'. Use the ids from studio start.');
 for(const text of o.learned??[]){if(text.trim().length<12)continue;
  const a=add({title:text.trim().split(/(?<=[.!?])\s/)[0]!.slice(0,90),body:text.trim(),domain:r.domain,kind:'technique',tags:['role:'+r.id,...topicsOf(text)],source:'job:'+job,status:'trial'});
  added.push(a.knowledge.id);}
 Object.assign(t,{status:'done' as Status,finished:now(),applied:[...new Set([...t.applied,...applied,...added])],learned:[...new Set([...t.learned,...added])],...(out?{output:out}:{}),...(o.note?{note:o.note}:{}),...(show.length?{show}:{}),...(choices.length?{choices,picked:undefined}:{})});
 if(o.link)p.videoJob=o.link;
 t.predicted=predict(job,t);
 // Once the guesses have proved reliable, a first version the user would probably reject is held
 // back once: improve it, or finish it anyway.
 if(t.predicted.good<.4&&t.predicted.basis>=6&&t.rounds===0&&!o.anyway&&t.held!==t.rounds&&predictionRecord().trusted){
  t.held=t.rounds;t.status='doing';save(p);
  emit(job,{type:'step.held',task:t.id,role:r.id,face:'confused',text:`Held back: you would probably rate it bad (${Math.round(t.predicted.good*100)}% good). Improving it first.`});
  throw new Error(`The user would probably rate this bad (${Math.round(t.predicted.good*100)}% good from ${t.predicted.basis} ratings${t.predicted.reasons.length?'; they usually say: '+t.predicted.reasons.join(', '):''}). Improve it and finish again, or finish as it is with --anyway.`);
 }
 // The comments this round answered, and the version it made, kept for the history of the step.
 if(t.scope){for(const c of p.comments??[])if(c.task===t.id&&c.round===t.scope.round&&c.answered===undefined)c.answered=t.rounds;delete t.scope;}
 save(p);
 let kept:string|null=null;try{keepVersion(p,t);}catch(e){kept=(e as Error).message;}
 emit(job,{type:'step.done',task:t.id,role:r.id,face:'done',text:`Finished: ${t.title}`,data:{...(out?{output:path.basename(out)}:{}),shown:show.length,choices:choices.map(c=>c.label),applied:t.applied.length,learned:added.length}});
 const e=t.predicted;
 return {job,task:t.id,status:'done',version:t.rounds+1,...(kept?{versionNotKept:kept}:{}),...(added.length?{learned:added}:{}),
  ...(e.basis>=6?{expect:`From ${e.basis} earlier ratings of this step, the user will probably rate it ${e.good>=.5?'good':'bad'} (${Math.round(e.good*100)}% good)${e.good<.5&&e.reasons.length?`; what they usually say: ${e.reasons.join(', ')}. Consider improving it before they look`:''}.`}:{}),next:next(job)};
}

/** The user's approval of a gate (their own yes, never assumed). */
export function approve(job:string,gate:string){
 const p=readPlan(job),t=taskOf(p,gate);if(!t.gate)throw new Error(`"${gate}" is a task, not an approval`);
 const block=blockers(p,t);if(block.length)throw new Error(`Nothing to approve yet. First: ${block.join(', ')}`);
 const unpicked=t.needs.map(n=>taskOf(p,n)).find(x=>x.choices?.length&&!x.picked);
 if(unpicked)throw new Error(`The user chooses a version of "${unpicked.id}" first: pnpm tempoloom studio pick ${job} ${unpicked.id} "${unpicked.choices![0]!.label}"`);
 Object.assign(t,{status:'done' as Status,finished:now()});save(p);emit(job,{type:'gate.approved',task:gate,role:'you',face:'excited',text:`You approved: ${t.title}`});return {job,approved:gate,next:next(job)};
}

/** The user's feedback, in their words: saved as a rule, routed to the roles it concerns, and
 *  (unless it is praise) their finished tasks and everything built on them are reopened. */
export function feedback(job:string,said:string,o:{rule?:string;verdict?:Verdict;task?:string;topics?:string[]}={}){
 return change({kind:'lessons',job,title:`You told the studio: ${said.trim().slice(0,110)}`},()=>feedbackNow(job,said,o));
}
async function feedbackNow(job:string,said:string,o:{rule?:string;verdict?:Verdict;task?:string;topics?:string[]}={}){
 const p=readPlan(job),verdict=o.verdict??'revise';
 const r=await addFeedback({said,rule:o.rule,verdict,job:p.videoJob??job,...(o.topics?{topics:o.topics}:{})});sync();
 // Routed by the user's own words (not the rule written from them); a specific topic (colour,
 // sound, captions…) decides alone, and the broad ones (design, motion) only when nothing else matched.
 const inPlan=new Set(p.tasks.map(t=>t.role).filter(Boolean) as string[]),heard=topicsOf(said),specific=heard.filter(t=>!['design','motion'].includes(t));
 const topics=specific.length?specific:heard.length?heard:r.lesson.topics;
 const makers=loadStudio().roles.filter(x=>inPlan.has(x.id)&&!x.independent&&!x.agent&&x.topics.some(t=>topics.includes(t))).map(x=>x.id);
 // Feedback on one step goes to that step's role and reopens that step only (and what was built on it).
 const about=o.task?taskOf(p,o.task):undefined;
 const roles=about?.role?[about.role]:makers.length?makers:['director'],reopened:string[]=[];
 if(verdict!=='approve'){
  if(about){if(!about.gate&&about.status==='done'){about.status='redo';reopened.push(about.id);}}
  else for(const t of p.tasks)if(!t.gate&&roles.includes(t.role??'')&&t.status==='done'&&!['intake','learn'].includes(t.id)){t.status='redo';reopened.push(t.id);}
  // Everything built on a reopened task is reopened too, and its approvals are asked again.
  reopened.push(...reopenAfter(p,reopened));
  // Feedback on the whole step (not on some scenes) lets the redo change anything again.
  for(const id of reopened)delete taskOf(p,id).scope;
 }
 p.feedback.push({at:now(),said:said.trim(),rule:r.lesson.rule,verdict,lesson:r.lesson.id,topics:o.topics?.length?o.topics:topics,roles,reopened});save(p);
 emit(job,{type:'feedback',role:'you',...(o.task?{task:o.task}:{}),text:said,data:{verdict,goesTo:roles,reopened}});
 return {job,saved:r.lesson.id,rule:r.lesson.rule,seen:r.lesson.count,topics,goesTo:roles.map(id=>roleOf(id).title),reopened,next:next(job),
  tellUser:`Saved for next time: ${r.lesson.rule}`};
}

// ---------- the agent's own check, and what it expects the user to say ----------
/** The steps that make a video the agent checks itself. */
const CHECKED=new Set(['build']);
const hasTargets=(p:Plan)=>{try{return buildTaste(p.profile??'main').targets.length>0;}catch{return false;}};
/** The agent checks the video a step made against the user's taste, before the user sees it. */
export async function check(job:string,taskId:string,file:string,o:{accept?:string}={}){
 const p=readPlan(job),t=taskOf(p,taskId);if(t.gate)throw new Error(`"${taskId}" is an approval, not a step`);
 if(t.status!=='doing')throw new Error(`Start the step first: pnpm tempoloom studio start ${job} ${taskId}`);
 const attempt=(t.selfcheck?.attempt??0)+1;
 const {result,measured}=await selfCheck(file,path.join(jobDir(job),'selfcheck',taskId),{profile:p.profile??'main',attempt});
 if(o.accept?.trim())result.accepted=o.accept.trim().slice(0,300);
 const q=readPlan(job);taskOf(q,taskId).selfcheck=result;save(q);
 emit(job,{type:'step.checked',task:taskId,role:t.role??'',face:result.verdict==='pass'?'excited':'confused',text:`Checked its own video against your taste: ${result.passed} match, ${result.near} close, ${result.off} off`,data:{verdict:result.verdict,attempt}});
 const off=result.checks.filter(c=>c.verdict==='off');
 return {job,task:taskId,verdict:result.verdict,attempt,profile:result.profile,passed:result.passed,near:result.near,off:result.off,checks:result.checks,measured,
  look:{note:'Open every sheet. Hold the frames against these lines: anything that breaks one is a problem even when the numbers pass.',sheets:result.sheets,lines:result.look},
  next:result.verdict==='pass'||result.accepted?`It matches the user's taste${result.accepted?' (accepted: '+result.accepted+')':''}. If the frames look right too: pnpm tempoloom studio done ${job} ${taskId} --show ${result.file} ...`
   :`Fix first, then render and check again: ${off.map(c=>`${c.fix} (${c.role})`).join(' ')}`};
}
function history(){
 let names:string[]=[];try{names=fs.readdirSync(studioRoot());}catch{return [];}
 return names.filter(n=>/^[a-z0-9][a-z0-9-]{0,60}$/.test(n)).map(n=>{try{return readPlan(n);}catch{return null;}}).filter((x):x is Plan=>!!x);
}
/** What the user will probably say about a step: how they rated this kind of step before, how
 *  much the lessons it used are trusted, and what its own check found. A guess, shown as one. */
export function predict(job:string,t:Task){
 const past=history().flatMap(p=>(p.ratings??[]).filter(r=>r.task===t.id&&r.rating!=='ok'&&!(p.job===job&&r.round===t.rounds)));
 const good=past.filter(r=>r.rating==='good').length,bad=past.length-good;
 let pr=(good+1)/(past.length+2);
 const ks=t.applied.map(id=>getKnowledge(id)).filter((k):k is NonNullable<typeof k>=>!!k);
 if(ks.length)pr+=(ks.reduce((a,k)=>a+confidence(k),0)/ks.length-.6)*.5;
 if(t.selfcheck&&!t.selfcheck.accepted)pr-=Math.min(.3,t.selfcheck.off*.12);
 const count=new Map<string,number>();for(const r of past.filter(x=>x.rating==='bad'))for(const id of r.reasons)count.set(id,(count.get(id)??0)+1);
 void bad;
 return {good:Math.round(Math.max(.05,Math.min(.95,pr))*100)/100,reasons:[...count].sort((a,b)=>b[1]-a[1]).slice(0,2).map(([id])=>RATE_REASONS[id]?.label??id),basis:past.length};
}
/** How often the studio's guesses matched the user's ratings. */
export function predictionRecord(){
 const judged=history().flatMap(p=>p.ratings??[]).filter(r=>r.rating!=='ok'&&r.predicted!==undefined);
 const matched=judged.filter(r=>(r.predicted!>=.5)===(r.rating==='good')).length;
 return {judged:judged.length,matched,share:judged.length?Math.round(matched/judged.length*100):null,trusted:judged.length>=20&&matched/judged.length>=.7};
}

export const RATE_REASONS:Record<string,{label:string;topic:string}>={slow:{label:'too slow',topic:'pacing'},fast:{label:'too fast',topic:'pacing'},busy:{label:'too busy',topic:'design'},empty:{label:'too empty',topic:'design'},
 colors:{label:'wrong colours',topic:'color'},unreadable:{label:'hard to read',topic:'typography'},boring:{label:'boring, not enough motion',topic:'motion'},brand:{label:'off-brand',topic:'brand'},
 words:{label:'wrong words',topic:'script'},sound:{label:'the sound is wrong',topic:'audio'},captions:{label:'the captions are wrong',topic:'captions'},cuts:{label:'the cuts are wrong',topic:'editing'},long:{label:'too long',topic:'length'}};
export type RateInput={rating:'good'|'ok'|'bad';reasons?:string[];note?:string;parts?:{part:string;rating:'good'|'bad';note?:string}[]};
/** The user's rating of one step. It scores only the lessons that step used: good adds a win to
 *  each, bad a loss; "ok" (not bad) scores nothing. Bad also saves the reason as a rule, sends it
 *  to the step's role and reopens that step only. One rating per round of a step counts. */
export function rate(job:string,taskId:string,i:RateInput){
 const t=taskOf(readPlan(job),taskId);
 return change({kind:'ratings',job,title:`You rated ${t.title}: ${i.rating==='ok'?'not bad':i.rating}`},()=>rateNow(job,taskId,i));
}
async function rateNow(job:string,taskId:string,i:RateInput){
 const p=readPlan(job),t=taskOf(p,taskId);
 if(t.gate)throw new Error(`"${taskId}" is an approval, not a step: rate the step before it`);
 if(t.status!=='done')throw new Error(`"${taskId}" is not finished yet (${t.status}); rate it when its work is shown`);
 if(!['good','ok','bad'].includes(i.rating))throw new Error('The rating is good, ok or bad');
 const reasons=[...new Set(i.reasons??[])];const unknown=reasons.filter(r=>!RATE_REASONS[r]);if(unknown.length)throw new Error(`Unknown reason: ${unknown.join(', ')}. Reasons: ${Object.keys(RATE_REASONS).join(', ')}`);
 const parts=(i.parts??[]).map(x=>({part:x.part.trim().slice(0,80),rating:x.rating,note:(x.note??'').trim().slice(0,300)})).filter(x=>x.part);
 // A part marked bad makes the step bad: something in it has to change.
 const rating=i.rating!=='bad'&&parts.some(x=>x.rating==='bad')?'bad':i.rating,note=(i.note??'').trim().slice(0,600);
 const badParts=parts.filter(x=>x.rating==='bad');
 if(rating==='bad'&&!reasons.length&&!note&&!badParts.some(x=>x.note))throw new Error('Say what is wrong (a reason or a note), so it can be fixed and remembered');
 p.ratings??=[];
 const again=p.ratings.find(r=>r.task===taskId&&r.round===t.rounds);
 if(again)throw new Error(`This version of "${taskId}" was already rated ${again.rating}. A new rating counts after the step is redone.`);
 const ids=rating==='ok'?[]:[...new Set(t.applied)].filter(id=>getKnowledge(id));
 const scored=ids.length?score(ids,rating==='good',`rate:${job}:${taskId}:${rating}`):[];
 const entry:Rating={at:now(),task:taskId,round:t.rounds,rating,...(t.predicted&&t.predicted.basis>=3?{predicted:t.predicted.good}:{}),reasons,note,parts,scored:ids,reopened:[]};
 p.ratings.push(entry);save(p);
 emit(job,{type:'step.rated',task:taskId,role:t.role??'',face:rating==='good'?'excited':rating==='bad'?'confused':'done',text:`You rated ${t.title}: ${rating==='ok'?'not bad':rating}${note?` (${note})`:''}`,data:{rating,reasons}});
 if(rating!=='bad')return {job,task:taskId,rating,scored,next:next(job)};
 const said=[`${t.title}:`,reasons.map(r=>RATE_REASONS[r]!.label).join(', '),...badParts.map(x=>`${x.part}${x.note?' - '+x.note:''}`),note].filter(Boolean).join(' ').replace(/: ,/,':');
 const f=await feedback(job,said,{verdict:'revise',task:taskId,topics:[...new Set(reasons.map(r=>RATE_REASONS[r]!.topic))]});
 const q=readPlan(job),e=q.ratings!.find(r=>r.task===taskId&&r.round===entry.round&&r.at===entry.at)!;e.rule=f.rule;e.reopened=f.reopened;save(q);
 return {job,task:taskId,rating,scored,savedRule:f.rule,goesTo:f.goesTo,reopened:f.reopened,next:f.next};
}
/** The user's choice between versions of a step: the lessons only the picked one used win, the
 *  ones only the others used lose; the pick is passed on to the next roles. */
export function pick(job:string,taskId:string,label:string){
 return change({kind:'ratings',job,title:`You picked "${label.trim().slice(0,60)}" for ${taskOf(readPlan(job),taskId).title}`},()=>pickNow(job,taskId,label));
}
function pickNow(job:string,taskId:string,label:string){
 const p=readPlan(job),t=taskOf(p,taskId);
 if(!t.choices?.length)throw new Error(`"${taskId}" has no versions to choose between`);
 if(t.picked)throw new Error(`"${t.picked}" was already picked for "${taskId}"`);
 const want=label.trim().toLowerCase(),c=t.choices.find(x=>x.label.toLowerCase()===want)??t.choices.find(x=>x.label.toLowerCase().startsWith(want));
 if(!c)throw new Error(`No version "${label}". Versions: ${t.choices.map(x=>x.label).join('; ')}`);
 const others=new Set(t.choices.filter(x=>x!==c).flatMap(x=>x.applied)),mine=new Set(c.applied);
 const won=[...mine].filter(id=>!others.has(id)),lost=[...others].filter(id=>!mine.has(id));
 if(won.length)score(won,true,`pick:${job}:${taskId}`);if(lost.length)score(lost,false,`pick:${job}:${taskId}`);
 t.picked=c.label;t.applied=[...new Set([...t.applied.filter(id=>!others.has(id)||mine.has(id)),...c.applied])];
 t.note=`The user picked "${c.label}" (${path.basename(c.file)}). Build on this version only.`+(t.note?' '+t.note.replace(/^The user picked[^.]*\.[^.]*\. ?/,''):'');
 save(p);emit(job,{type:'step.picked',task:taskId,role:t.role??'',face:'excited',text:`You picked ${c.label}`});return {job,task:taskId,picked:c.label,won,lost,next:next(job)};
}

/** A job that stopped in the middle of a step (the session ended, the computer slept, something
 *  failed): what was in progress, what it left behind and how to continue. Starting the step again
 *  keeps its round, its lessons and its inputs; a render continues from its last finished scene and
 *  an edit from its last finished step. */
export function resume(job:string){
 const p=readPlan(job),evs=events(job,0,400),doing=p.tasks.filter(t=>t.status==='doing');
 const pieces=(()=>{if(!p.videoJob||!/^[a-z0-9][a-z0-9_-]{0,150}$/i.test(p.videoJob))return null;
  const base=path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','projects',p.videoJob,'render-cache','scenes');
  try{const best=fs.readdirSync(base).map(d=>fs.readdirSync(path.join(base,d)).filter(n=>n.endsWith('.done.json')).length).sort((a,b)=>b-a)[0];return best?{project:p.videoJob,scenesRendered:best}:null;}catch{return null;}})();
 const stopped=doing.map(t=>{const mine=evs.filter(e=>e.task===t.id),last=mine.at(-1),said=[...mine].reverse().find(e=>e.type==='agent.say');
  const dir=jobDir(job),out=t.produces?path.join(dir,t.produces):null;
  return {task:t.id,title:t.title,role:roleOf(t.role!).title,started:t.started??null,lastHeard:last?.at??t.started??null,...(said?{lastSaid:said.text}:{}),
   ...(out&&fs.existsSync(out)?{outputSoFar:out}:{}),round:t.rounds+1,continue:`pnpm tempoloom studio start ${job} ${t.id}`};});
 const n=next(job);
 return {job,stopped,...(pieces?{render:{...pieces,note:`${pieces.scenesRendered} scene${pieces.scenesRendered>1?'s were':' was'} rendered before it stopped: the same render continues from there.`}}:{}),
  ready:n.ready.map(r=>r.task),waitingForUser:n.waitingForUser.map(g=>g.gate),
  note:stopped.length?`Start ${stopped.length>1?'each step':'the step'} again with studio start: it keeps its round, lessons and inputs. Read what it left (outputSoFar) and carry on from there; a render continues from its last finished scene, an edit from its last finished step.`
   :n.ready.length?'Nothing stopped in the middle of a step. Continue with the ready steps.':'Nothing stopped in the middle of a step.'};
}

/** Hides a job from the Studio page's list, or brings it back. Nothing is deleted. */
export function archive(job:string,on:boolean){const p=readPlan(job);p.archived=on;save(p);return {job,archived:on};}

export function status(job:string){const p=readPlan(job);
 return {job,type:p.type,request:p.request,options:p.options,...(p.videoJob?{videoJob:p.videoJob}:{}),...(p.verdict?{verdict:p.verdict}:{}),
  tasks:p.tasks.map(t=>({task:t.id,stage:t.stage,owner:t.gate?'the user':roleOf(t.role!).title,status:t.gate?(t.status==='done'?'approved':'waiting'):t.status,...(t.output?{output:t.output}:{}),...(t.rounds?{rounds:t.rounds+1}:{})})),
  feedback:p.feedback.length,plan:path.join(jobDir(job),'plan.md')};}

/** The user's verdict on the finished job: every lesson any role used is scored in the brain. */
export function verdict(job:string,v:'approved'|'revised'|'rejected',o:{videoJob?:string;score?:boolean}={}){
 return change({kind:'ratings',job,title:`Your verdict on the video: ${v}`},()=>verdictNow(job,v,o));
}
function verdictNow(job:string,v:'approved'|'revised'|'rejected',o:{videoJob?:string;score?:boolean}={}){
 const p=readPlan(job);if(o.videoJob)p.videoJob=o.videoJob;const id=p.videoJob??job;
 // A lesson scored by a step's rating or by a pick is not scored again: the verdict scores the rest.
 const rated=new Set([...(p.ratings??[]).filter(r=>r.rating!=='ok').flatMap(r=>r.scored),...p.tasks.filter(t=>t.picked).flatMap(t=>t.choices!.flatMap(c=>c.applied))]);
 const ids=o.score===false?[]:[...new Set(p.tasks.flatMap(t=>t.applied))].filter(x=>!rated.has(x));
 if(ids.length)apply(id,ids);const scored=o.score===false?{scored:[]}:brainVerdict(id,v);
 if(o.score===false)recordJob({id,verdict:v});
 // The video job's own learning (style traits and compositions) is scored by its verdict too.
 p.verdict=v;save(p);emit(job,{type:'verdict',role:'you',face:v==='approved'?'excited':'confused',text:`Your verdict on the video: ${v}`});return {job,scoredAs:id,verdict:v,lessons:scored.scored};
}

/** What each role did, used and learned on this job, and what the user said. */
export function retro(job:string){const p=readPlan(job);
 const roles=[...new Set(p.tasks.map(t=>t.role).filter(Boolean) as string[])].map(id=>{const ts=p.tasks.filter(t=>t.role===id);
  return {role:roleOf(id).title,tasks:ts.map(t=>t.id),rounds:ts.reduce((n,t)=>n+t.rounds,0),applied:[...new Set(ts.flatMap(t=>t.applied))],learned:[...new Set(ts.flatMap(t=>t.learned))],
   feedback:p.feedback.filter(f=>f.roles.includes(id)).map(f=>f.rule)};});
 const r={job,verdict:p.verdict??'none yet',finished:p.tasks.every(t=>t.status==='done'),revisions:p.feedback.filter(f=>f.verdict!=='approve').length,roles,
  lessonsApplied:new Set(p.tasks.flatMap(t=>t.applied)).size,lessonsLearned:new Set(p.tasks.flatMap(t=>t.learned)).size,
  ...(p.verdict?{}:{then:`Ask the user, then: pnpm tempoloom studio verdict ${job} approved|revised|rejected`})};
 return r;
}

/** The organisation as a tree. */
export function org(){const s=loadStudio();
 return {director:{title:s.director.title,mission:s.director.mission,rules:s.director.rules},
  departments:s.departments.map(d=>({department:d.title,mission:d.mission,...(d.lead?{lead:roleOf(d.lead).title}:{}),
   roles:s.roles.filter(r=>r.department===d.id&&r.id!==d.lead).map(r=>({role:r.id,title:r.title,mission:r.mission,learnsFrom:r.topics,...(r.agent?{subAgent:r.agent}:{})}))})),
  kindsOfRequest:Object.fromEntries(Object.entries(s.plans).map(([k,v])=>[k,v.title]))};}

function planMarkdown(p:Plan){
 const mark=(t:Task)=>t.gate?(t.status==='done'?'approved':ready(p,t)?'**waiting for you**':'later'):({todo:'to do',doing:'in progress',done:'done',redo:'to redo'} as const)[t.status];
 return `# Plan: ${p.title}\n\nRequest: ${p.request}\n\nJob \`${p.job}\`${p.options.length?` · options: ${p.options.join(', ')}`:''}${p.videoJob?` · video job \`${p.videoJob}\``:''}${p.verdict?` · verdict: **${p.verdict}**`:''}\n\n`+
  `| # | Stage | Task | Owner | Needs | Output | Status |\n| --- | --- | --- | --- | --- | --- | --- |\n`+
  p.tasks.map((t,i)=>`| ${i+1} | ${t.stage} | ${t.title} (\`${t.id}\`) | ${t.gate?'**You**':roleOf(t.role!).title} | ${t.needs.join(', ')||'–'} | ${t.produces??'–'} | ${mark(t)}${t.rounds?` (round ${t.rounds+1})`:''} |`).join('\n')+
  (p.feedback.length?`\n\n## Your feedback\n\n${p.feedback.map(f=>`- "${f.said}" → ${f.roles.map(r=>roleOf(r).title).join(', ')}${f.reopened.length?`; reopened: ${f.reopened.join(', ')}`:''}`).join('\n')}`:'')+'\n';
}

// ---------- Undo: the change history puts a job's ratings, words, choices and steps back ----------
adapter('plan',{
 read:job=>{try{return planState(readPlan(job));}catch{return null;}},
 label:job=>`The video ${job}`,
 merge:(before,after,cur)=>{
  if(cur===null)return {value:null,kept:['the job was deleted']};
  const B=(before??{ratings:[],feedback:[],verdict:null,tasks:{}}) as PlanState,A=after as PlanState,C=cur as PlanState,kept:string[]=[];
  const out:PlanState={...C,ratings:revertSet(B.ratings,A.ratings,C.ratings,'at') as PlanState['ratings'],feedback:revertSet(B.feedback,A.feedback,C.feedback,'at') as PlanState['feedback'],
   comments:revertSet(B.comments??[],A.comments??[],C.comments??[],'id') as PlanState['comments'],tasks:{...C.tasks}};
  if(JSON.stringify(C.verdict)===JSON.stringify(A.verdict))out.verdict=B.verdict;else if(B.verdict!==A.verdict)kept.push('verdict');
  for(const id of Object.keys(A.tasks)){if(!C.tasks[id]||!B.tasks[id])continue;const r=merge3(B.tasks[id],A.tasks[id],C.tasks[id],{sets:{applied:null}});
   out.tasks[id]=r.value as PlanState['tasks'][string];if(r.kept.length)kept.push(`${id}: ${r.kept.includes('status')?'being worked on again, so it stays reopened':r.kept.join(', ')}`);}
  return {value:out,kept};},
 write:(job,v)=>{if(v===null)return;const s=v as PlanState,p=readPlan(job);
  p.ratings=s.ratings;p.feedback=s.feedback;p.comments=s.comments;if(s.verdict)p.verdict=s.verdict;else delete p.verdict;
  for(const t of p.tasks){const x=s.tasks[t.id];if(!x)continue;t.status=x.status;t.applied=x.applied;if(x.picked)t.picked=x.picked;else delete t.picked;if(x.note)t.note=x.note;else delete t.note;if(x.scope)t.scope=x.scope;else delete t.scope;}
  save(p);emit(job,{type:'feedback',role:'you',text:'You undid a change on the History page'});}});
