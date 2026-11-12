// `pnpm tempoloom feedback`: the agent records the user's feedback on a video automatically and
// loads the matching rules before the next one.
import {parseArgs} from 'node:util';
import {addFeedback,lessonsFor,listLessons,forget,verdicts,type Verdict} from '../engine/feedback.js';

const usage=`Usage: tempoloom feedback <command>

  add "WHAT THE USER SAID" [--rule "WHAT TO DO NEXT TIME"] [--verdict reject|revise|approve]
      [--job JOB] [--video FILE] [--topics a,b] [--id ID]
                     Record feedback now; adds a rule to memory or strengthens the same one
  lessons [--for "THE NEW BRIEF"] [--limit 12]
                     Rules to apply to a new video (strong rules always, others by match)
  list               Every learned rule
  forget ID          Remove a rule the user no longer wants`;

async function main(){
 const [cmd,...rest]=process.argv.slice(2);
 const {values:v,positionals}=parseArgs({args:rest,allowPositionals:true,options:{rule:{type:'string'},verdict:{type:'string'},job:{type:'string'},video:{type:'string'},topics:{type:'string'},id:{type:'string'},for:{type:'string'},limit:{type:'string'}}});
 const out=(x:unknown)=>console.log(JSON.stringify(x,null,2));
 if(cmd==='add'){
  if(v.verdict&&!verdicts.includes(v.verdict as Verdict))throw new Error('--verdict must be reject, revise or approve');
  const r=await addFeedback({said:positionals.join(' '),rule:v.rule,verdict:v.verdict as Verdict|undefined,job:v.job,video:v.video,id:v.id,topics:v.topics?.split(',').map(s=>s.trim()).filter(Boolean)});
  return out({...r,tellUser:`Saved for next time: ${r.lesson.rule}${r.action==='strengthened'?` (now ${r.lesson.count}×)`:''}`});
 }
 if(cmd==='lessons')return out(await lessonsFor(v.for??positionals.join(' '),Number(v.limit??12)));
 if(cmd==='list')return out(await listLessons());
 if(cmd==='forget'){if(!positionals[0])throw new Error('forget needs a lesson id');return out(await forget(positionals[0]));}
 console.log(usage);if(cmd&&cmd!=='help')process.exitCode=1;
}
main().catch(e=>{console.error(JSON.stringify({error:(e as Error).message}));process.exitCode=1;});
