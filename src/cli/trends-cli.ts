// `pnpm tempoloom trends`: formats getting popular for the topics you watch, with links, to accept
// (a lesson on trial for the scriptwriter) or ignore. Read-only: Reach never posts anything.
import {parseArgs} from 'node:util';
import * as T from '../engine/trends.js';

const usage=`Usage: tempoloom trends [list]
       tempoloom trends add "TOPIC" | remove "TOPIC"
       tempoloom trends check ["TOPIC"] [--channels youtube,tiktok] [--limit 12]
       tempoloom trends accept ID | ignore ID

Watches up to 12 topics. A check searches the channels (pnpm tempoloom reach channels shows which
are set up) and sorts the top results into formats: lists, how-tos, mistakes and myths, before and
after, comparisons, "I tried it", stories, reviews, question hooks, secrets, big numbers. A format
in several results is suggested with its links ("rising" when it grew since the last check).
accept makes it a lesson on trial the scriptwriter uses; ignore stops suggesting it for that topic.`;
const {values:v,positionals:a}=parseArgs({args:process.argv.slice(2),allowPositionals:true,options:{channels:{type:'string'},limit:{type:'string'}}});
const out=(x:unknown)=>console.log(JSON.stringify(x,null,2));
async function main(){
 const [cmd='list',...rest]=a,arg=rest.join(' ');
 switch(cmd){
  case 'list':return out(T.overview());
  case 'add':return out(T.addTopic(arg));
  case 'remove':return out(T.removeTopic(arg));
  case 'check':return out(await T.check({...(arg?{topic:arg}:{}),...(v.channels?{channels:v.channels.split(',').map(s=>s.trim()).filter(Boolean)}:{}),...(v.limit?{limit:Number(v.limit)}:{})}));
  case 'accept':return out(T.accept(arg));
  case 'ignore':return out(T.ignore(arg));
  default:console.log(usage);if(cmd!=='help'&&cmd!=='--help')process.exitCode=1;
 }
}
main().catch(e=>{console.error(JSON.stringify({error:(e as Error).message}));process.exitCode=1;});
