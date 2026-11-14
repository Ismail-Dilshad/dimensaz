// The Live studio: one job seen as a team at work. Each role in the job is a member with the
// mascot's face for what it is doing now (from the job's events and the state of its steps), the
// line it last said, and its steps; the user is a member too, when a choice is waiting for them.
import {readPlan,roleOf,loadStudio,next,type Plan} from './studio.js';
import {jobView,plans} from './studio-requests.js';
import {events,readState,WORKING_FACE,type Face,type StudioEvent} from './studio-events.js';

const RECENT=10*60_000,ASLEEP=24*3600_000;
const firstLine=(s:string)=>{const m=/(?:to use as written|write one\)|What the user wants):\n([^\n]+)/.exec(s);return (m?m[1]!:s.split('\n')[0]!).slice(0,120);};

/** Every role's place in the organisation, so each keeps one colour everywhere. */
export function roleColors():Record<string,number>{
 const ids=['director',...loadStudio().roles.map(r=>r.id)];return Object.fromEntries(ids.map((id,i)=>[id,i]));
}

/** The jobs to watch, the most recently active first. */
export function liveJobs(){
 return plans().filter(p=>!p.archived).map(p=>{const evs=events(p.job,0,1),last=evs.at(-1),n=next(p.job),finished=p.tasks.every(t=>t.status==='done');
  return {job:p.job,title:firstLine(p.request),mode:p.type==='footage-edit'?'edit':'motion',done:n.done,of:n.of,finished,
   active:!!last&&Date.now()-Date.parse(last.at)<RECENT,face:last&&Date.now()-Date.parse(last.at)<RECENT?last.face??null:null,said:last&&Date.now()-Date.parse(last.at)<RECENT?last.text??null:null,last:last?.at??p.updated,waitingForYou:!finished&&!n.ready.length&&n.waitingForUser.length>0};})
  .sort((a,b)=>b.last.localeCompare(a.last));
}

/** The agent's face for the whole app: what it said or did last (from any job, or from
 *  `tempoloom status`), going idle after ten quiet minutes and to sleep after a day; when nothing
 *  is happening and a choice waits for the user, it asks for them. */
export function agentNow(){
 const s=readState(),age=s?Date.now()/1000-s.updated:Infinity;
 const waiting=plans().filter(p=>!p.archived&&!p.tasks.every(t=>t.status==='done')).filter(p=>{const n=next(p.job);return !n.ready.length&&n.waitingForUser.length>0;});
 const who=s?.role?(()=>{try{return roleOf(s.role!).title;}catch{return null;}})():null;
 const settled=s&&['done','excited','error','needs-approval','sleeping'].includes(s.state);
 if(s&&age<RECENT/1000)return {face:s.state,detail:s.detail,who,job:s.job??null,at:new Date(s.updated*1000).toISOString(),recent:true};
 if(waiting.length)return {face:'needs-approval' as Face,detail:`${waiting.length} video${waiting.length>1?'s wait':' waits'} for you`,who:null,job:waiting[0]!.job,at:null,recent:false};
 return {face:(age<ASLEEP/1000?(settled?s!.state:'idle'):'sleeping') as Face,detail:s&&age<ASLEEP/1000?s.detail:'',who:age<ASLEEP/1000?who:null,job:s?.job??null,at:s?new Date(s.updated*1000).toISOString():null,recent:false};
}

function member(p:Plan,id:string,evs:StudioEvent[],readyIds:Set<string>,asleep:boolean){
 const r=roleOf(id),tasks=p.tasks.filter(t=>t.role===id),now=Date.now();
 const mine=evs.filter(e=>e.role===id),last=mine.at(-1),recent=(e?:StudioEvent)=>!!e&&now-Date.parse(e.at)<RECENT;
 const doing=tasks.find(t=>t.status==='doing'),said=[...mine].reverse().find(e=>e.type==='agent.say');
 let face:Face,state:string;
 if(doing){
  face=recent(last)&&last!.task===doing.id&&last!.face&&last!.type!=='step.done'?last!.face:WORKING_FACE[id]??'thinking';
  state=said&&said.task===doing.id&&Date.parse(said.at)>=Date.parse(doing.started??'')?said.text!:`Working on: ${doing.title}`;
 }else if(tasks.length&&tasks.every(t=>t.status==='done')){
  face=recent(last)&&last!.face&&['step.rated','step.picked','step.checked'].includes(last!.type)?last!.face:'done';
  state=tasks.length>1?`Finished all ${tasks.length} steps`:`Finished: ${tasks[0]!.title}`;
 }else{
  const ready=tasks.find(t=>readyIds.has(t.id)),redo=tasks.find(t=>t.status==='redo');
  face=asleep?'sleeping':ready?'listening':'idle';
  state=ready?`Ready to ${ready.status==='redo'?'redo':'start'}: ${ready.title}`:redo?`Will redo: ${redo.title}`:`Waits for earlier steps`;
 }
 if(recent(last)&&last!.face==='error')face='error';
 return {id,title:r.title,department:r.department,face,state,step:doing?.id??null,since:doing?.started??null,
  tasks:tasks.map(t=>({id:t.id,title:t.title,status:t.status,stage:t.stage}))};
}

/** One job as it is now: the job view of the Studio page, the team, what waits for the user and the events. */
export function live(job:string,after=0){
 const p=readPlan(job),view=jobView(p),evs=events(job,0,400),n=next(job);
 const last=evs.at(-1),asleep=!view.finished&&Date.now()-Date.parse(last?.at??p.updated)>ASLEEP;
 const readyIds=new Set(n.ready.map(x=>x.task));
 const ids=[...new Set(p.tasks.map(t=>t.role).filter((x):x is string=>!!x))];
 const team=ids.map(id=>member(p,id,evs,readyIds,asleep));
 const doing=team.filter(m=>m.step);
 const you=n.waitingForUser.length||n.userChooses?.length?{face:'needs-approval' as Face,gates:n.waitingForUser.map(g=>({gate:g.gate,title:g.title})),picks:(n.userChooses??[]).map(c=>({step:c.step,versions:c.versions}))}:null;
 const driver=view.finished?{state:'finished',label:'Finished'}:doing.length?{state:'working',label:doing.length>1?`${doing.length} agents working`:`${doing[0]!.title} is working`}
  :you&&!n.ready.length?{state:'you',label:'Waiting for you'}:{state:'agent',label:'Waiting for your agent to continue'};
 return {...view,title:firstLine(p.request),team,you,driver,colors:roleColors(),asleep,
  events:evs.filter(e=>e.seq>after),lastSeq:last?.seq??0,
  continueWith:`Continue the studio job ${job}`};
}
