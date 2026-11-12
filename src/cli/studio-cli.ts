// `pnpm tempoloom studio`: the organisation that runs every job. Plan first; every task goes to
// the role that is best at it, starts with that role's playbook and lessons, and ends with its
// output; the user's feedback reaches the roles responsible; a verdict scores what was used.
import {parseArgs} from 'node:util';
import {plan,next,start,done,approve,feedback,status,verdict,retro,org,prompt,loadStudio} from '../engine/studio.js';
import {verdicts,type Verdict} from '../engine/feedback.js';

const usage=`Usage: tempoloom studio <command>

  org                              The organisation: director, departments, roles and what each learns from
  plan "REQUEST" --type KIND [--write] [--voice] [--visuals] [--job NAME]
                                   Plan a request (script-to-motion, reference-match, footage-edit) into tasks
                                   with owners, inputs, outputs and the user's approvals. --write: no script yet;
                                   --voice: a voice-over was asked for; --visuals: designed visuals over footage
  next JOB                         What can be done now, and which approval is waiting for the user
  start JOB TASK                   Start a task: the role's playbook, its inputs, its lessons, the user's feedback
  prompt JOB TASK                  A complete brief of one task as plain text, for any other AI (codex exec, gemini -p,
                                   a fresh session): it needs nothing from this conversation
  done JOB TASK [--output FILE] [--applied ID,ID] [--learned "LESSON"]... [--note "..."] [--link VIDEO_JOB]
                                   Finish a task: its output, the lessons used, and anything learned
  approve JOB GATE                 The user's own yes to a gate (script-ok, design-ok, preview-ok)
  feedback JOB "WHAT THE USER SAID" [--rule "WHAT TO DO NEXT TIME"] [--verdict reject|revise|approve]
                                   Save it as a rule, send it to the roles it concerns, reopen their tasks
  status JOB                       Every task, its owner and state (also workspace/studio/JOB/plan.md)
  verdict JOB approved|revised|rejected [--link VIDEO_JOB]
                                   The user's verdict: scores every lesson the job used
  retro JOB                        What each role did, used and learned; what the user said`;

async function main(){
 const [cmd,...rest]=process.argv.slice(2);const out=(x:unknown)=>console.log(JSON.stringify(x,null,2));
 const {values:v,positionals:a}=parseArgs({args:rest,allowPositionals:true,options:{type:{type:'string'},job:{type:'string'},write:{type:'boolean'},voice:{type:'boolean'},visuals:{type:'boolean'},
  output:{type:'string'},applied:{type:'string'},learned:{type:'string',multiple:true},note:{type:'string'},link:{type:'string'},rule:{type:'string'},verdict:{type:'string'}}});
 const need=(n:number,what:string)=>{if(a.length<n)throw new Error('studio '+cmd+' '+what);};
 switch(cmd){
  case 'org':return out(org());
  case 'plan':{need(1,'"REQUEST" --type KIND');if(!v.type)throw new Error('--type is needed: '+Object.keys(loadStudio().plans).join(', '));
   const p=plan(a.join(' '),{type:v.type,...(v.job?{job:v.job}:{}),options:[...(v.write?['write']:[]),...(v.voice?['voice']:[]),...(v.visuals?['visuals']:[])]});
   return out({job:p.job,kind:p.title,tasks:p.tasks.length,plan:status(p.job).plan,next:next(p.job)});}
  case 'next':need(1,'JOB');return out(next(a[0]!));
  case 'start':need(2,'JOB TASK');return out(start(a[0]!,a[1]!));
  case 'prompt':need(2,'JOB TASK');return console.log(prompt(a[0]!,a[1]!));
  case 'done':need(2,'JOB TASK');return out(done(a[0]!,a[1]!,{...(v.output?{output:v.output}:{}),...(v.applied?{applied:v.applied.split(',').map(s=>s.trim()).filter(Boolean)}:{}),...(v.learned?{learned:v.learned}:{}),...(v.note?{note:v.note}:{}),...(v.link?{link:v.link}:{})}));
  case 'approve':need(2,'JOB GATE');return out(approve(a[0]!,a[1]!));
  case 'feedback':{need(2,'JOB "WHAT THE USER SAID"');if(v.verdict&&!verdicts.includes(v.verdict as Verdict))throw new Error('--verdict must be reject, revise or approve');
   return out(await feedback(a[0]!,a.slice(1).join(' '),{...(v.rule?{rule:v.rule}:{}),...(v.verdict?{verdict:v.verdict as Verdict}:{})}));}
  case 'status':need(1,'JOB');return out(status(a[0]!));
  case 'verdict':{need(2,'JOB approved|revised|rejected');if(!['approved','revised','rejected'].includes(a[1]!))throw new Error('The verdict is approved, revised or rejected');
   return out(verdict(a[0]!,a[1] as 'approved',{...(v.link?{videoJob:v.link}:{})}));}
  case 'retro':need(1,'JOB');return out(retro(a[0]!));
  default:console.log(usage);if(cmd&&cmd!=='help')process.exitCode=1;
 }
}
main().catch(e=>{console.error(JSON.stringify({error:(e as Error).message}));process.exitCode=1;});
