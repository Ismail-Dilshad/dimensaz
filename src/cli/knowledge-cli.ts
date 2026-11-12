// Knowledge base: search, show, list, validate, and write proposals for user approval.
import fs from 'node:fs/promises';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import {ROOT} from '../engine/config.js';

const entrySchema=z.object({id:z.string().regex(/^[a-z0-9][a-z0-9-]*$/),title:z.string().min(1),path:z.string(),kind:z.enum(['guide','record','lesson','research','principles','policy','playbook','skill','technique','style']),topics:z.array(z.string()).min(1),source:z.string(),license:z.string(),reviewed:z.boolean()}).strict();
export const knowledgeIndexSchema=z.object({version:z.literal(1),updated:z.string().optional(),description:z.string().optional(),entries:z.array(entrySchema)}).strict();
export type KnowledgeEntry=z.infer<typeof entrySchema>;
const indexFile=path.join(ROOT,'agent/knowledge/index.json');
const proposalDir=path.join(ROOT,'agent/knowledge/proposals');

export async function readIndex(){return knowledgeIndexSchema.parse(JSON.parse(await fs.readFile(indexFile,'utf8')));}
const words=(s:string)=>s.toLowerCase().normalize('NFKC').split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>1);

export async function searchKnowledge(query:string,limit=8){
 const q=words(query);if(!q.length)return [];
 const {entries}=await readIndex();
 const scored=await Promise.all(entries.map(async e=>{
  const body=await fs.readFile(path.join(ROOT,e.path),'utf8').catch(()=>'');
  const head=words(e.title+' '+e.topics.join(' ')+' '+e.id),text=words(body);
  const counts=new Map<string,number>();for(const w of text)counts.set(w,(counts.get(w)??0)+1);
  let score=0;const lines:string[]=[];
  for(const w of q){score+=head.filter(h=>h.startsWith(w)).length*5+Math.min(counts.get(w)??0,10);}
  if(score>0)for(const line of body.split('\n'))if(q.some(w=>line.toLowerCase().includes(w))&&line.trim()&&lines.length<3)lines.push(line.trim().slice(0,200));
  return {...e,score:score+(e.reviewed?1:0),snippets:lines};
 }));
 return scored.filter(e=>e.score>1).sort((a,b)=>b.score-a.score).slice(0,limit);
}

export async function validateKnowledge(){
 const index=await readIndex();const problems:string[]=[];const ids=new Set<string>();
 for(const e of index.entries){
  if(ids.has(e.id))problems.push('Duplicate id '+e.id);ids.add(e.id);
  await fs.access(path.join(ROOT,e.path)).catch(()=>problems.push('Missing file for '+e.id+': '+e.path));
 }
 return {entries:index.entries.length,problems};
}

const slug=(s:string)=>s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'').slice(0,60)||'proposal';
export async function propose(input:{title:string;body:string;source:string;license:string;target?:string;topics?:string[]}){
 if(!input.title.trim()||!input.body.trim())throw new Error('A proposal needs a title and a body');
 if(!input.source.trim()||!input.license.trim())throw new Error('Record where the knowledge came from (--source) and its license (--license)');
 await fs.mkdir(proposalDir,{recursive:true});
 const date=new Date().toISOString().slice(0,10);let file='';
 for(let n=1;;n++){file=path.join(proposalDir,`${date}-${slug(input.title)}${n>1?'-'+n:''}.md`);try{await fs.access(file);}catch{break;}}
 const front=['---','title: '+JSON.stringify(input.title),'source: '+JSON.stringify(input.source),'license: '+JSON.stringify(input.license),'target: '+JSON.stringify(input.target??'agent/knowledge/memory.md'),'topics: '+JSON.stringify(input.topics??[]),'status: pending-approval','created: '+date,'---',''].join('\n');
 await fs.writeFile(file,front+input.body.trim()+'\n',{flag:'wx'});
 return path.relative(ROOT,file).split(path.sep).join('/');
}

async function main(){
 const [command,...rest]=process.argv.slice(2);
 const {values:v,positionals}=parseArgs({args:rest,allowPositionals:true,options:{topic:{type:'string'},kind:{type:'string'},limit:{type:'string'},title:{type:'string'},body:{type:'string'},file:{type:'string'},source:{type:'string'},license:{type:'string'},target:{type:'string'},topics:{type:'string'}}});
 const out=(x:unknown)=>console.log(JSON.stringify(x,null,2));
 if(command==='search')return out(await searchKnowledge(positionals.join(' '),Number(v.limit??8)));
 if(command==='list'){const {entries}=await readIndex();return out(entries.filter(e=>(!v.topic||e.topics.includes(v.topic))&&(!v.kind||e.kind===v.kind)).map(({id,title,path,kind,topics,reviewed})=>({id,title,path,kind,topics,reviewed})));}
 if(command==='show'){const {entries}=await readIndex();const e=entries.find(x=>x.id===positionals[0]);if(!e)throw new Error('Unknown knowledge id: '+positionals[0]);return console.log(await fs.readFile(path.join(ROOT,e.path),'utf8'));}
 if(command==='validate'){const r=await validateKnowledge();out(r);if(r.problems.length)process.exitCode=1;return;}
 if(command==='propose'||command==='update'){
  const body=v.file?await fs.readFile(path.resolve(v.file),'utf8'):v.body??'';
  return out({proposal:await propose({title:v.title??'',body,source:v.source??'',license:v.license??'',target:v.target,topics:v.topics?.split(',').map(s=>s.trim()).filter(Boolean)}),note:'Waiting for the user to approve. Nothing in the knowledge base changed.'});
 }
 console.log('Usage: knowledge <search QUERY | list [--topic T] [--kind K] | show ID | validate | propose --title T (--body B | --file F) --source S --license L [--target FILE] [--topics a,b]>');
 if(command&&command!=='help')process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
