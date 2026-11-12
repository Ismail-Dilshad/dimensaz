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
import {recall,add,apply,verdict as brainVerdict,sync,getKnowledge,type Recalled} from './brain/brain.js';
import {addFeedback,topicsOf,type Verdict} from './feedback.js';

const TOPICS=['motion','pacing','design','typography','color','captions','transitions','audio','voice','brand','cta','assets','kurdish','length','format','script','editing'] as const;
const roleSchema=z.object({id:z.string().regex(/^[a-z][a-z-]{1,30}$/),department:z.string(),title:z.string(),agent:z.string().optional(),independent:z.boolean().optional(),mission:z.string(),
 topics:z.array(z.enum(TOPICS)).min(1),domain:z.enum(['motion','editing','both']),guides:z.array(z.string()).min(1),commands:z.array(z.string()).min(1),steps:z.array(z.string()).min(2),checks:z.array(z.string()).min(1)}).strict();
const taskSchema=z.object({id:z.string().regex(/^[a-z][a-z-]{1,30}$/),stage:z.number().int().min(1).max(8),role:z.string().optional(),gate:z.boolean().optional(),title:z.string(),
 needs:z.array(z.string()).default([]),produces:z.string().optional(),when:z.enum(['write','voice','visuals']).optional()}).strict();
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
  guides:['agent/workflow.md','agent/policies.md','docs/guides/studio.md'],commands:['pnpm dimensaz studio status JOB','pnpm dimensaz studio next JOB'],steps:s.director.rules,checks:['The plan is up to date; every gate has the user\'s own yes.']};
 const r=s.roles.find(x=>x.id===id);if(!r)throw new Error('No role '+id);return r;
}

// ---------- jobs ----------
type Status='todo'|'doing'|'done'|'redo';
export type Task={id:string;stage:number;role?:string;gate?:boolean;title:string;needs:string[];produces?:string;status:Status;output?:string;note?:string;
 applied:string[];learned:string[];started?:string;finished?:string;rounds:number};
export type Plan={version:1;job:string;type:string;title:string;request:string;options:string[];created:string;updated:string;videoJob?:string;verdict?:string;
 tasks:Task[];feedback:{at:string;said:string;rule:string;verdict:Verdict;lesson:string;topics:string[];roles:string[];reopened:string[]}[]};
const now=()=>new Date().toISOString();
const slug=(s:string)=>s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);
export const studioRoot=()=>path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','studio');
export const jobDir=(job:string)=>{if(!/^[a-z0-9][a-z0-9-]{0,60}$/.test(job))throw new Error('Not a studio job name: '+job);return path.join(studioRoot(),job);};
export function readPlan(job:string):Plan{try{return JSON.parse(fs.readFileSync(path.join(jobDir(job),'plan.json'),'utf8')) as Plan;}catch{throw new Error(`No studio job "${job}". Start one: pnpm dimensaz studio plan "REQUEST" --type TYPE`);}}
function save(p:Plan){p.updated=now();const dir=jobDir(p.job);fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'plan.json'),JSON.stringify(p,null,1)+'\n');fs.writeFileSync(path.join(dir,'plan.md'),planMarkdown(p));return p;}
const taskOf=(p:Plan,id:string)=>{const t=p.tasks.find(x=>x.id===id);if(!t)throw new Error(`No task "${id}" in ${p.job}. Tasks: ${p.tasks.map(x=>x.id).join(', ')}`);return t;};
const ready=(p:Plan,t:Task)=>t.status!=='done'&&t.needs.every(n=>taskOf(p,n).status==='done');
const blockers=(p:Plan,t:Task)=>t.needs.filter(n=>taskOf(p,n).status!=='done');

/** Plans a request: the task tree of its kind, with the options it was given (write, voice, visuals). */
export function plan(request:string,o:{type:string;job?:string;options?:string[]}):Plan{
 const s=loadStudio(),tpl=s.plans[o.type];if(!tpl)throw new Error(`Unknown kind of request "${o.type}". Kinds: ${Object.keys(s.plans).join(', ')}`);
 if(!request.trim())throw new Error('Give the request in the user\'s words');
 const options=[...new Set(o.options??[])];for(const x of options)if(!['write','voice','visuals'].includes(x))throw new Error('Options are: write, voice, visuals');
 let job=o.job??(slug(request)||'job');if(!o.job){const base=job;for(let i=2;fs.existsSync(path.join(studioRoot(),job));i++)job=`${base.slice(0,36)}-${i}`;}
 else if(fs.existsSync(path.join(jobDir(job),'plan.json')))throw new Error(`Studio job "${job}" already exists: pnpm dimensaz studio status ${job}`);
 const kept=tpl.tasks.filter(t=>!t.when||options.includes(t.when)),ids=new Set(kept.map(t=>t.id));
 const tasks:Task[]=kept.map(t=>({id:t.id,stage:t.stage,...(t.role?{role:t.role}:{}),...(t.gate?{gate:true}:{}),title:t.title,needs:t.needs.filter(n=>ids.has(n)),...(t.produces?{produces:t.produces}:{}),status:'todo',applied:[],learned:[],rounds:0}));
 return save({version:1,job,type:o.type,title:tpl.title,request:request.trim(),options,created:now(),updated:now(),tasks,feedback:[]});
}

/** What can be done now: tasks whose needs are done, and gates waiting for the user. */
export function next(job:string){
 const p=readPlan(job),open=p.tasks.filter(t=>ready(p,t));
 return {job,done:p.tasks.filter(t=>t.status==='done').length,of:p.tasks.length,
  ready:open.filter(t=>!t.gate).map(t=>({task:t.id,role:t.role,title:t.title,status:t.status,department:roleOf(t.role!).department,start:`pnpm dimensaz studio start ${job} ${t.id}`})),
  waitingForUser:open.filter(t=>t.gate).map(t=>({gate:t.id,title:t.title,approve:`pnpm dimensaz studio approve ${job} ${t.id}`})),
  ...(p.tasks.every(t=>t.status==='done')?{finished:true,then:`pnpm dimensaz studio retro ${job}`}:{})};
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
 if(t.gate)throw new Error(`"${taskId}" is the user's approval, not a task: show them the work, then pnpm dimensaz studio approve ${job} ${taskId}`);
 const block=blockers(p,t);if(block.length)throw new Error(`"${taskId}" cannot start yet. First: ${block.map(b=>{const x=taskOf(p,b);return x.gate?`${b} (the user's approval)`:`${b} (${x.role})`;}).join(', ')}`);
 const r=roleOf(t.role!),dir=jobDir(job),lessons=lessonsFor(r.id,p.request);
 if(t.status!=='doing'){t.rounds+=t.status==='redo'||t.status==='done'?1:0;t.status='doing';t.started=now();save(p);}
 const fb=p.feedback.filter(f=>f.roles.includes(r.id)||r.id==='director');
 return {job,task:t.id,title:t.title,request:p.request,...(t.rounds?{round:t.rounds+1}:{}),
  role:{id:r.id,title:r.title,department:r.department,mission:r.mission,steps:r.steps,guides:r.guides,commands:r.commands,checks:r.checks},
  inputs:t.needs.map(n=>taskOf(p,n)).filter(x=>x.output).map(x=>({from:x.id,by:x.role,file:x.output,...(x.note?{note:x.note}:{})})),
  ...(fb.length?{feedbackOnThisJob:fb.map(f=>({said:f.said,rule:f.rule,verdict:f.verdict}))}:{}),
  lessons:{note:'Apply every "always" lesson. Use the others where they fit. Name the ids you used in --applied when you finish.',items:lessons},
  delegate:r.id==='director'?'This task is the Director\'s own: do it yourself.':r.independent?`This task must be done by someone who did not make the work: the ${r.agent} sub-agent (give it the job and task names), or on a host without sub-agents a fresh session or another AI started from \`pnpm dimensaz studio prompt ${job} ${t.id}\`.`
   :r.agent?`This is the ${r.title}'s task: hand it to the ${r.agent} sub-agent with the job and task names, or do it yourself with this playbook when your host has no sub-agents.`
   :`Do it with this playbook. When it is heavy or can run beside another task, hand it to the dimensaz-specialist sub-agent (job and task names), or to any other AI with \`pnpm dimensaz studio prompt ${job} ${t.id}\`.`,
  ...(t.produces?{writeTo:path.join(dir,t.produces)}:{}),
  finish:`pnpm dimensaz studio done ${job} ${t.id}${t.produces?` --output ${path.join(dir,t.produces)}`:''} --applied ID,ID [--learned "what you would do again, with numbers"] [--note "one line for the next role"]`};
}

/** A complete brief for one task, for any AI that is not in this conversation (another tool, a
 *  fresh session, a host without sub-agents): what the studio is, the task, and the two commands
 *  that give it the role's playbook and lessons and record its work. Nothing here depends on a host. */
export function prompt(job:string,taskId:string){
 const p=readPlan(job),t=taskOf(p,taskId);if(t.gate)throw new Error(`"${taskId}" is the user's approval, not a task`);
 const r=roleOf(t.role!),dir=jobDir(job);
 return `You are the ${r.title} of the Dimensaz studio, working in the project at ${ROOT}. ${r.mission}

Your task: ${t.title} (job "${job}", task "${t.id}").
The request: ${p.request}

1. Run \`pnpm dimensaz studio start ${job} ${t.id}\` from the project root. It returns your playbook (steps, guides to read, commands, checks), your inputs (files made by earlier tasks), the lessons the studio has learned for your role and the user's feedback on this job.
2. Read the inputs and the guides. Apply every lesson marked "always"; use the others where they fit.
3. Do the task with the commands of your playbook.${t.produces?` Write the result to ${path.join(dir,t.produces)}.`:''}
4. Check the result against your playbook's checks.
5. Run \`pnpm dimensaz studio done ${job} ${t.id}${t.produces?` --output ${path.join(dir,t.produces)}`:''} --applied ID,ID\` with the lesson ids you used (or \`--applied none\`), \`--learned "what you would do again, with numbers"\` if the task taught you something, and \`--note "one line for the next role"\`.
${r.independent?'\nYou are independent: read the request, the approved script and the preview only, not the makers\' notes, and fix nothing yourself.\n':''}
Do not talk to the user, approve anything or start other tasks. Finish with a short report: the output file, what you decided and why, the lessons you applied, and anything the next role must know.
`;
}

/** Finishes a task: its output must exist; the lessons it used are kept for the verdict; something
 *  it learned becomes this role's own lesson in the brain (a trial until a verdict proves it). */
export function done(job:string,taskId:string,o:{output?:string;applied?:string[];learned?:string[];note?:string;link?:string}={}){
 const p=readPlan(job),t=taskOf(p,taskId);
 if(t.gate)throw new Error(`"${taskId}" is the user's approval: pnpm dimensaz studio approve ${job} ${taskId}`);
 if(t.status==='todo')throw new Error(`Start it first, to get the playbook and the lessons: pnpm dimensaz studio start ${job} ${taskId}`);
 const r=roleOf(t.role!),out=o.output?path.resolve(o.output):t.output;
 if(t.produces){if(!out)throw new Error(`"${taskId}" produces ${t.produces}: write it and pass --output`);
  if(!fs.existsSync(out)||!fs.statSync(out).size)throw new Error('The output does not exist or is empty: '+out);}
 // Learning every time: a role that was given rules says which it used (or "none"), and the job's
 // last task needs the user's verdict.
 if(o.applied===undefined&&!t.applied.length&&lessonsFor(r.id,p.request).some(l=>l.always))throw new Error(`Say which lessons this task used: --applied ID,ID (the ids from studio start), or --applied none`);
 if(t.id==='learn'&&!p.verdict)throw new Error(`Ask the user for their verdict first: pnpm dimensaz studio verdict ${job} approved|revised|rejected`);
 const applied=[...new Set(o.applied??[])].filter(id=>id!=='none'),added:string[]=[];
 const unknown=applied.filter(id=>!getKnowledge(id));
 if(unknown.length)throw new Error('Unknown lesson ids: '+unknown.join(', ')+'. Use the ids from studio start.');
 for(const text of o.learned??[]){if(text.trim().length<12)continue;
  const a=add({title:text.trim().split(/(?<=[.!?])\s/)[0]!.slice(0,90),body:text.trim(),domain:r.domain,kind:'technique',tags:['role:'+r.id,...topicsOf(text)],source:'job:'+job,status:'trial'});
  added.push(a.knowledge.id);}
 Object.assign(t,{status:'done' as Status,finished:now(),applied:[...new Set([...t.applied,...applied,...added])],learned:[...new Set([...t.learned,...added])],...(out?{output:out}:{}),...(o.note?{note:o.note}:{})});
 if(o.link)p.videoJob=o.link;
 save(p);
 return {job,task:t.id,status:'done',...(added.length?{learned:added}:{}),next:next(job)};
}

/** The user's approval of a gate (their own yes, never assumed). */
export function approve(job:string,gate:string){
 const p=readPlan(job),t=taskOf(p,gate);if(!t.gate)throw new Error(`"${gate}" is a task, not an approval`);
 const block=blockers(p,t);if(block.length)throw new Error(`Nothing to approve yet. First: ${block.join(', ')}`);
 Object.assign(t,{status:'done' as Status,finished:now()});save(p);return {job,approved:gate,next:next(job)};
}

/** The user's feedback, in their words: saved as a rule, routed to the roles it concerns, and
 *  (unless it is praise) their finished tasks and everything built on them are reopened. */
export async function feedback(job:string,said:string,o:{rule?:string;verdict?:Verdict}={}){
 const p=readPlan(job),verdict=o.verdict??'revise';
 const r=await addFeedback({said,rule:o.rule,verdict,job:p.videoJob??job});sync();
 // Routed by the user's own words (not the rule written from them); a specific topic (colour,
 // sound, captions…) decides alone, and the broad ones (design, motion) only when nothing else matched.
 const inPlan=new Set(p.tasks.map(t=>t.role).filter(Boolean) as string[]),heard=topicsOf(said),specific=heard.filter(t=>!['design','motion'].includes(t));
 const topics=specific.length?specific:heard.length?heard:r.lesson.topics;
 const makers=loadStudio().roles.filter(x=>inPlan.has(x.id)&&!x.independent&&!x.agent&&x.topics.some(t=>topics.includes(t))).map(x=>x.id);
 const roles=makers.length?makers:['director'],reopened:string[]=[];
 if(verdict!=='approve'){
  for(const t of p.tasks)if(!t.gate&&roles.includes(t.role??'')&&t.status==='done'&&!['intake','learn'].includes(t.id)){t.status='redo';reopened.push(t.id);}
  // Everything built on a reopened task is reopened too, and its approvals are asked again.
  for(let changed=true;changed;){changed=false;for(const t of p.tasks)if(t.status==='done'&&t.needs.some(n=>['redo','todo'].includes(taskOf(p,n).status)&&reopened.includes(n))){t.status=t.gate?'todo':'redo';reopened.push(t.id);changed=true;}}
 }
 p.feedback.push({at:now(),said:said.trim(),rule:r.lesson.rule,verdict,lesson:r.lesson.id,topics,roles,reopened});save(p);
 return {job,saved:r.lesson.id,rule:r.lesson.rule,seen:r.lesson.count,topics,goesTo:roles.map(id=>roleOf(id).title),reopened,next:next(job),
  tellUser:`Saved for next time: ${r.lesson.rule}`};
}

export function status(job:string){const p=readPlan(job);
 return {job,type:p.type,request:p.request,options:p.options,...(p.videoJob?{videoJob:p.videoJob}:{}),...(p.verdict?{verdict:p.verdict}:{}),
  tasks:p.tasks.map(t=>({task:t.id,stage:t.stage,owner:t.gate?'the user':roleOf(t.role!).title,status:t.gate?(t.status==='done'?'approved':'waiting'):t.status,...(t.output?{output:t.output}:{}),...(t.rounds?{rounds:t.rounds+1}:{})})),
  feedback:p.feedback.length,plan:path.join(jobDir(job),'plan.md')};}

/** The user's verdict on the finished job: every lesson any role used is scored in the brain. */
export function verdict(job:string,v:'approved'|'revised'|'rejected',o:{videoJob?:string}={}){
 const p=readPlan(job);if(o.videoJob)p.videoJob=o.videoJob;const id=p.videoJob??job;
 const ids=[...new Set(p.tasks.flatMap(t=>t.applied))];
 if(ids.length)apply(id,ids);const scored=brainVerdict(id,v);
 // The video job's own learning (style traits and compositions) is scored by its verdict too.
 p.verdict=v;save(p);return {job,scoredAs:id,verdict:v,lessons:scored.scored};
}

/** What each role did, used and learned on this job, and what the user said. */
export function retro(job:string){const p=readPlan(job);
 const roles=[...new Set(p.tasks.map(t=>t.role).filter(Boolean) as string[])].map(id=>{const ts=p.tasks.filter(t=>t.role===id);
  return {role:roleOf(id).title,tasks:ts.map(t=>t.id),rounds:ts.reduce((n,t)=>n+t.rounds,0),applied:[...new Set(ts.flatMap(t=>t.applied))],learned:[...new Set(ts.flatMap(t=>t.learned))],
   feedback:p.feedback.filter(f=>f.roles.includes(id)).map(f=>f.rule)};});
 const r={job,verdict:p.verdict??'none yet',finished:p.tasks.every(t=>t.status==='done'),revisions:p.feedback.filter(f=>f.verdict!=='approve').length,roles,
  lessonsApplied:new Set(p.tasks.flatMap(t=>t.applied)).size,lessonsLearned:new Set(p.tasks.flatMap(t=>t.learned)).size,
  ...(p.verdict?{}:{then:`Ask the user, then: pnpm dimensaz studio verdict ${job} approved|revised|rejected`})};
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
