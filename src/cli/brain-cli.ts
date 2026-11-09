// `pnpm dimensaz brain`: what Dimensaz knows about motion design and video editing, and how it
// learns: from finished jobs, the user's feedback, the user's references and web study sessions.
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseArgs} from 'node:util';
import {ROOT} from '../engine/config.js';
import * as brain from '../engine/brain/brain.js';
import {allKnowledge} from '../engine/brain/db.js';
import type {Domain,Kind,Status} from '../engine/brain/db.js';

const usage=`Usage: dimensaz brain <command>

  recall "THE BRIEF" [--domain motion|editing] [--limit 15] [--no-trial]
                     What to apply to a new video or edit (rules always, then the best matches)
  add --title T --body B --source S [--domain D] [--kind K] [--tags a,b] [--status S] [--id ID]
                     Save something learned (web sources start as "trial")
  apply --job JOB ID...            Record which knowledge a job used
  verdict JOB approved|revised|rejected
                     The user's verdict; scores the knowledge the job used
  study "TOPIC" [--channels web,youtube,dribbble,behance,pinterest,tiktok,reddit] [--limit 6]
                     Search the web and platforms for a topic and list what was found
  learn-reference FILE... --name NAME
                     Measure a reference (video or images), save it as a style, add it to the brain
  approve ID | reject ID | retire ID
  show ID | list [--kind K] [--status S] [--domain D]
  report             How much it knows and whether recent work is getting approved faster
  sync               Re-import the starting knowledge, reference styles and guides`;

const {values:v,positionals}=parseArgs({allowPositionals:true,options:{domain:{type:'string'},limit:{type:'string'},'no-trial':{type:'boolean'},title:{type:'string'},body:{type:'string'},
 source:{type:'string'},kind:{type:'string'},tags:{type:'string'},status:{type:'string'},id:{type:'string'},job:{type:'string'},channels:{type:'string'},name:{type:'string'}}});
const [cmd,...rest]=positionals;
const out=(x:unknown)=>console.log(JSON.stringify(x,null,2));

async function study(topic:string){
 const {run}=await import('../reach/manage.js');
 const channels=(v.channels??'web,youtube,dribbble,behance').split(',').map(s=>s.trim()).filter(Boolean);
 const limit=Number(v.limit??6);
 const action:Record<string,string>={web:'search',youtube:'search',dribbble:'search',behance:'search',pinterest:'search',tiktok:'search',reddit:'search',vimeo:'search',x:'search'};
 const rows:{channel:string;title:string|null;url:string|null;text:string|null}[]=[];const problems:Record<string,string>={};
 for(const ch of channels){
  if(!action[ch]){problems[ch]='not a study channel';continue;}
  const query=ch==='web'?`${topic} motion design video editing technique tutorial`:topic;
  const r=await run(ch,action[ch]!,{query,limit});
  if(r.ok)rows.push(...r.items.map(i=>({channel:ch,title:i.title,url:i.url,text:i.text})));else problems[ch]=`${r.error?.code}: ${r.error?.message}`;
 }
 const findings=brain.saveFindings(topic,rows);
 return {topic,found:rows.length,problems,findings,next:[
  'Open the most useful ones: pnpm dimensaz reach read URL, or reach youtube transcript URL for videos.',
  'For each real technique, style or trend, save it: pnpm dimensaz brain add --title "..." --body "how to do it, with numbers" --source URL --domain motion|editing --kind technique|style|trend --tags a,b',
  'It starts as "trial": the agent tries it when it fits, and two approved jobs make it proven.']};
}

async function main(){
 if(!cmd||cmd==='help')return console.log(usage);
 switch(cmd){
  case 'sync':return out(brain.sync());
  case 'recall':{brain.sync();return out(brain.recall(rest.join(' '),{domain:v.domain as Domain|undefined,limit:Number(v.limit??15),includeTrial:!v['no-trial']}));}
  case 'add':return out(brain.add({title:v.title??'',body:v.body??'',source:v.source??'',domain:v.domain as Domain|undefined,kind:v.kind as Kind|undefined,status:v.status as Status|undefined,id:v.id,tags:v.tags?.split(',')}));
  case 'apply':if(!v.job||!rest.length)throw new Error('apply --job JOB ID...');return out(brain.apply(v.job,rest));
  case 'verdict':{const [job,verdict]=rest;if(!job||!['approved','revised','rejected'].includes(verdict??''))throw new Error('verdict JOB approved|revised|rejected');
   // Scores everything the video used: its style's traits and the compositions of its visuals.
   return out(brain.verdict(job,verdict as 'approved'));}
  case 'approve':return out(brain.setStatus(rest[0]??'','approved','approved by the user'));
  case 'reject':return out(brain.setStatus(rest[0]??'','rejected','rejected by the user'));
  case 'retire':return out(brain.setStatus(rest[0]??'','retired','retired'));
  case 'show':{const k=brain.getKnowledge(rest[0]??'');if(!k)throw new Error('No knowledge '+rest[0]);return out({...k,confidence:Math.round(brain.confidence(k)*100)/100});}
  case 'list':{brain.sync();return out(allKnowledge().filter(k=>(!v.kind||k.kind===v.kind)&&(!v.status||k.status===v.status)&&(!v.domain||k.domain===v.domain)).map(k=>({id:k.id,kind:k.kind,domain:k.domain,status:k.status,title:k.title,confidence:Math.round(brain.confidence(k)*100)/100})));}
  case 'report':{brain.sync();return out(brain.report());}
  case 'study':{if(!rest.length)throw new Error('study "TOPIC"');return out(await study(rest.join(' ')));}
  case 'learn-reference':{
   if(!rest.length||!v.name)throw new Error('learn-reference FILE... --name NAME');
   const r=spawnSync(process.execPath,[path.join(ROOT,'scripts/run-checks.mjs'),'--import','tsx',path.join(ROOT,'src/cli/media-cli.ts'),'style',...rest,'--name',v.name,'--save'],{cwd:ROOT,encoding:'utf8'});
   if(r.status!==0)throw new Error('media style failed: '+(r.stderr||r.stdout).slice(-600));
   const synced=brain.sync();
   return out({measured:JSON.parse(r.stdout.slice(r.stdout.indexOf('{'))),brain:synced,next:`Recall it with: pnpm dimensaz brain recall "${v.name}"`});
  }
 }
 console.error(usage);process.exitCode=1;
}
main().catch(e=>{console.error(JSON.stringify({error:(e as Error).message}));process.exitCode=1;});
