// `pnpm tempoloom studio`: the organisation that runs every job. Plan first; every task goes to
// the role that is best at it, starts with that role's playbook and lessons, and ends with its
// output; the user's feedback reaches the roles responsible; a verdict scores what was used.
import {parseArgs} from 'node:util';
import {plan,next,start,done,approve,feedback,status,verdict,retro,org,prompt,loadStudio,rate,pick,check,resume,RATE_REASONS} from '../engine/studio.js';
import {versionsView,bringBack,comment} from '../engine/studio-versions.js';
import {inbox,take} from '../engine/studio-requests.js';
import {verdicts,type Verdict} from '../engine/feedback.js';
import {say,FACES} from '../engine/studio-events.js';
import {readPlan} from '../engine/studio.js';

const usage=`Usage: tempoloom studio <command>

  open [--port 4747] [--no-browser]  The Studio page on this computer: brief a video (motion or an edit of your
                                   footage), watch every step, rate each one good or bad, pick between two looks
  inbox                            What to do now: new requests from the page, jobs with tasks ready, what waits for the user
  take REQUEST [--job NAME]        Plan a request from the page into a job
  org                              The organisation: director, departments, roles and what each learns from
  plan "REQUEST" --type KIND [--write] [--voice] [--visuals] [--second [--second-profile ID]] [--job NAME]
                                   Plan a request (script-to-motion, reference-match, footage-edit) into tasks
                                   with owners, inputs, outputs and the user's approvals. --write: no script yet;
                                   --voice: a voice-over was asked for; --visuals: designed visuals over footage
                                   --second: a second reviewer with a different taste (--second-profile ID,
                                   else a general viewer) watches the preview after the first
  next JOB                         What can be done now, and which approval is waiting for the user
  start JOB TASK                   Start a task: the role's playbook, its inputs, its lessons, the user's feedback
  say JOB TASK "WHAT YOU ARE DOING" [--face FACE]
                                   One line for the Live studio page while you work (searching, drawing, rendering).
                                   FACE: idle, listening, thinking, planning, creating, rendering, done, excited, confused, error, needs-approval, sleeping
  prompt JOB TASK                  A complete brief of one task as plain text, for any other AI (codex exec, gemini -p,
                                   a fresh session): it needs nothing from this conversation
  done JOB TASK [--output FILE] [--applied ID,ID] [--learned "LESSON"]... [--note "..."] [--link VIDEO_JOB]
                [--show FILE]... [--choice "A: NAME|SAMPLE_FILE|ID,ID"]... [--anyway]
                                   Finish a task: its output, the lessons used, and anything learned. --show: a picture,
                                   video or sound the user should see with this step. --choice (twice or more):
                                   versions for the user to pick from, each with the lessons only it used
  check JOB TASK VIDEO.mp4 [--accept "WHY"]
                                   Watch your own video before the user does: measures it against their taste profile
                                   and gives frame sheets to look at. Needed before done on the preview step
  rate JOB TASK good|ok|bad [--reason slow,busy] [--note "..."] [--part "scene 3: too busy"]...
                                   The user's rating of one step: scores only the lessons that step used; bad saves
                                   the reason as a rule for the step's role and reopens that step
  pick JOB TASK "LABEL"            The user's choice between versions: the picked one's lessons win, the others' lose
  approve JOB GATE                 The user's own yes to a gate (script-ok, design-ok, preview-ok)
  feedback JOB "WHAT THE USER SAID" [--rule "WHAT TO DO NEXT TIME"] [--verdict reject|revise|approve]
                                   Save it as a rule, send it to the roles it concerns, reopen their tasks
  status JOB                       Every task, its owner and state (also workspace/studio/JOB/plan.md)
  verdict JOB approved|revised|rejected [--link VIDEO_JOB]
                                   The user's verdict: scores every lesson the job used
  retro JOB                        What each role did, used and learned; what the user said
  versions JOB TASK                Every version of a step (each finish keeps one), newest first, with its rating
  bring-back JOB TASK N            Make version N the step's current version again; steps built on it are reopened
  comment JOB TASK SECONDS "TEXT" [--video 1]
                                   The user's comment on a moment of a step's video: only the scene at that moment
                                   is redone (studio start says which; studio done checks the others are unchanged)
  resume JOB                       A job that stopped in the middle of a step: what was in progress, what it left,
                                   and how to continue (a render continues from its last finished scene)`;

async function main(){
 const [cmd,...rest]=process.argv.slice(2);const out=(x:unknown)=>console.log(JSON.stringify(x,null,2));
 const {values:v,positionals:a}=parseArgs({args:rest,allowPositionals:true,options:{second:{type:'boolean'},'second-profile':{type:'string'},type:{type:'string'},job:{type:'string'},write:{type:'boolean'},voice:{type:'boolean'},visuals:{type:'boolean'},
  output:{type:'string'},face:{type:'string'},applied:{type:'string'},show:{type:'string',multiple:true},choice:{type:'string',multiple:true},reason:{type:'string'},accept:{type:'string'},anyway:{type:'boolean'},part:{type:'string',multiple:true},port:{type:'string'},'no-browser':{type:'boolean'},learned:{type:'string',multiple:true},note:{type:'string'},link:{type:'string'},video:{type:'string'},rule:{type:'string'},verdict:{type:'string'}}});
 const need=(n:number,what:string)=>{if(a.length<n)throw new Error('studio '+cmd+' '+what);};
 switch(cmd){
  case 'open':{const {openPage}=await import('../teach/open.js');return openPage('studio',{...(v.port?{port:Number(v.port)}:{}),browser:!v['no-browser']});}
  case 'inbox':return out(inbox());
  case 'take':need(1,'REQUEST');return out(take(a[0]!,{...(v.job?{job:v.job}:{})}));
  case 'rate':{need(3,`JOB TASK good|ok|bad [--reason ${Object.keys(RATE_REASONS).slice(0,3).join(',')}] [--note "..."]`);
   return out(await rate(a[0]!,a[1]!,{rating:a[2] as 'good',...(v.reason?{reasons:v.reason.split(',').map(s=>s.trim()).filter(Boolean)}:{}),...(v.note?{note:v.note}:{}),
    parts:(v.part??[]).map(x=>{const i=x.indexOf(':');return {part:i<0?x:x.slice(0,i),rating:'bad' as const,note:i<0?'':x.slice(i+1).trim()};})}));}
  case 'check':need(3,'JOB TASK VIDEO.mp4');return out(await check(a[0]!,a[1]!,a[2]!,{...(v.accept?{accept:v.accept}:{})}));
  case 'pick':need(3,'JOB TASK "LABEL"');return out(pick(a[0]!,a[1]!,a.slice(2).join(' ')));
  case 'org':return out(org());
  case 'plan':{need(1,'"REQUEST" --type KIND');if(!v.type)throw new Error('--type is needed: '+Object.keys(loadStudio().plans).join(', '));
   const p=plan(a.join(' '),{type:v.type,...(v.job?{job:v.job}:{}),options:[...(v.write?['write']:[]),...(v.voice?['voice']:[]),...(v.visuals?['visuals']:[]),...(v.second?['second']:[])],...(v['second-profile']?{secondProfile:v['second-profile']}:{})});
   return out({job:p.job,kind:p.title,tasks:p.tasks.length,plan:status(p.job).plan,next:next(p.job)});}
  case 'next':need(1,'JOB');return out(next(a[0]!));
  case 'start':need(2,'JOB TASK');return out(start(a[0]!,a[1]!));
  case 'say':{need(3,'JOB TASK "WHAT YOU ARE DOING" [--face '+FACES.join('|')+']');const t=readPlan(a[0]!).tasks.find(x=>x.id===a[1]);if(!t||t.gate)throw new Error(`No step "${a[1]}" in ${a[0]}`);
   const e=say(a[0]!,t.id,t.role!,a.slice(2).join(' '),v.face);return out({said:e.text,face:e.face??null,seq:e.seq});}
  case 'prompt':need(2,'JOB TASK');return console.log(prompt(a[0]!,a[1]!));
  case 'done':need(2,'JOB TASK');return out(done(a[0]!,a[1]!,{...(v.output?{output:v.output}:{}),...(v.applied?{applied:v.applied.split(',').map(s=>s.trim()).filter(Boolean)}:{}),...(v.learned?{learned:v.learned}:{}),...(v.show?{show:v.show}:{}),...(v.anyway?{anyway:true}:{}),...(v.choice?{choices:v.choice}:{}),...(v.note?{note:v.note}:{}),...(v.link?{link:v.link}:{})}));
  case 'approve':need(2,'JOB GATE');return out(approve(a[0]!,a[1]!));
  case 'feedback':{need(2,'JOB "WHAT THE USER SAID"');if(v.verdict&&!verdicts.includes(v.verdict as Verdict))throw new Error('--verdict must be reject, revise or approve');
   return out(await feedback(a[0]!,a.slice(1).join(' '),{...(v.rule?{rule:v.rule}:{}),...(v.verdict?{verdict:v.verdict as Verdict}:{})}));}
  case 'status':need(1,'JOB');return out(status(a[0]!));
  case 'verdict':{need(2,'JOB approved|revised|rejected');if(!['approved','revised','rejected'].includes(a[1]!))throw new Error('The verdict is approved, revised or rejected');
   return out(verdict(a[0]!,a[1] as 'approved',{...(v.link?{videoJob:v.link}:{})}));}
  case 'retro':need(1,'JOB');return out(retro(a[0]!));
  case 'versions':need(2,'JOB TASK');return out(versionsView(a[0]!,a[1]!));
  case 'bring-back':need(3,'JOB TASK N');return out(bringBack(a[0]!,a[1]!,Number(a[2])));
  case 'comment':{need(4,'JOB TASK SECONDS "TEXT" [--video 1]');const sec=Number(a[2]);if(!Number.isFinite(sec))throw new Error('SECONDS is a number, like 4.5');
   const t=readPlan(a[0]!).tasks.find(x=>x.id===a[1]),vids=(t?.show??[]).map((f,k)=>({f,k})).filter(x=>/\.(mp4|webm|mov|m4v)$/i.test(x.f)),pickV=vids[(Number(v.video)||1)-1];
   if(!pickV)throw new Error(`"${a[1]}" showed ${vids.length?`${vids.length} video${vids.length>1?'s':''}`:'no video'}`);
   return out(await comment(a[0]!,a[1]!,[{slot:`show-${pickV.k}`,time:sec,text:a.slice(3).join(' ')}]));}
  case 'resume':need(1,'JOB');return out(resume(a[0]!));
  default:console.log(usage);if(cmd&&cmd!=='help')process.exitCode=1;
 }
}
main().catch(e=>{console.error(JSON.stringify({error:(e as Error).message}));process.exitCode=1;});
