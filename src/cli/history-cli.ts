// `pnpm tempoloom history`: every change to what the studio learned (lessons, your rules, taught
// videos), your taste profiles and your ratings, newest first, each with Undo.
import {parseArgs} from 'node:util';
import {history,undo,KINDS,type Kind} from '../engine/history.js';

const usage=`Usage: tempoloom history [list] [--kind lessons|taste|ratings] [--job JOB] [--limit 30]
       tempoloom history undo ID

Lists the changes, newest first: lessons added, kept, removed or scored; rules from your feedback;
taste profile edits; ratings, picks, comments and verdicts. undo puts what one change touched back
the way it was. A field changed again later keeps its newer value, and a count (good, bad, times
seen) gives back only what that change added. An undo is a change too: undo it to redo.
The page has the same list: Studio page, History.`;
const {values:v,positionals:a}=parseArgs({args:process.argv.slice(2),allowPositionals:true,options:{kind:{type:'string'},job:{type:'string'},limit:{type:'string'}}});
const out=(x:unknown)=>console.log(JSON.stringify(x,null,2));
async function main(){
 const [cmd='list',id]=a;
 if(v.kind&&!(KINDS as string[]).includes(v.kind))throw new Error('--kind is lessons, taste or ratings');
 switch(cmd){
  case 'list':return out(history({...(v.kind?{kind:v.kind as Kind}:{}),...(v.job?{job:v.job}:{}),limit:Number(v.limit)||30}));
  case 'undo':if(!id)throw new Error('history undo ID (the ids are in history list)');return out(await undo(id));
  default:console.log(usage);if(cmd!=='help'&&cmd!=='--help')process.exitCode=1;
 }
}
main().catch(e=>{console.error(JSON.stringify({error:(e as Error).message}));process.exitCode=1;});
