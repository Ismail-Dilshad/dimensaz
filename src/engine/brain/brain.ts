// The brain: what Dimensaz knows about motion design and video editing, and how it gets
// better. Four sources feed it: every finished job (measured facts), the user's feedback
// (rules), the user's references (measured styles and techniques), and study sessions on
// the web (new techniques, kept as "trial" until a job proves them or the user approves).
// Before every video or edit the agent recalls what applies; after the user's verdict, the
// knowledge it used is scored, so proven things rise and failed ones fall.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT} from '../config.js';
import {db,putKnowledge,getKnowledge,allKnowledge,putJob,getJob,allJobs,exportCommitted,toKnowledge,
 type Knowledge,type Job,type Domain,type Kind,type Status,domains,kinds,statuses} from './db.js';
import {seedKnowledge} from './seed-data.js';
import {parseLessons,memoryFile} from '../feedback.js';

const now=()=>new Date().toISOString();
const slug=(s:string)=>s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'').slice(0,48)||'item';
/** Confidence 0..1 from outcomes, starting from the status (Bayesian average). */
export function confidence(k:Pick<Knowledge,'status'|'wins'|'losses'>){
 const prior=({approved:.8,proven:.85,trial:.5,rejected:.05,retired:.1} as const)[k.status];
 return (prior*4+k.wins)/(4+k.wins+k.losses);
}
const weight:Record<Status,number>={proven:1.15,approved:1,trial:.6,rejected:0,retired:0};

// ---------- seeding and syncing local knowledge ----------
function sha(s:string){return createHash('sha256').update(s).digest('hex').slice(0,16);}
/** Adds the curated starting knowledge and imports styles, motion references, guides and pieces. Safe to run any time. */
export function sync(){
 const d=db(),stamp=now();let added=0,updated=0,removed=0;const seen=new Set<string>();
 const upsert=(k:Omit<Knowledge,'wins'|'losses'|'uses'|'created'|'updated'|'evidence'>&{evidence?:string[]})=>{
  seen.add(k.id);const cur=getKnowledge(k.id);
  if(cur&&cur.title===k.title&&cur.body===k.body&&cur.kind===k.kind&&cur.domain===k.domain&&cur.tags.join(' ')===k.tags.join(' '))return;
  putKnowledge(d,{...k,wins:cur?.wins??0,losses:cur?.losses??0,uses:cur?.uses??0,created:cur?.created??stamp,updated:stamp,evidence:k.evidence??cur?.evidence??[],status:cur&&['rejected','retired'].includes(cur.status)?cur.status:k.status});
  cur?updated++:added++;
 };
 d.exec('begin');
 try{
  for(const s of seedKnowledge)upsert({...s,tags:s.tags.split(' '),source:'seed:dimensaz',status:'approved'});
  // Reference styles and motion references the user has given (references/catalog.json).
  const catalog=readJson(path.join(ROOT,'references','catalog.json')) as {styles?:{id:string;name:string;folder:string;aliases?:string[]}[];motion?:{id:string;folder:string;category?:string}[]}|null;
  for(const st of catalog?.styles??[]){
   const md=readText(path.join(ROOT,st.folder,'style.md'));if(!md)continue;
   upsert({id:'ref-style-'+st.id,domain:'motion',kind:'style',title:`${st.name} (your reference style)`,body:summary(md,1400),tags:['style','reference',st.id,...(st.aliases??[])],source:'reference:'+st.folder,status:'proven'});
  }
  for(const m of catalog?.motion??[]){
   const md=readText(path.join(ROOT,m.folder,'motion.md'));if(!md)continue;
   upsert({id:'ref-motion-'+m.id.slice(0,60),domain:'both',kind:'technique',title:titleOf(md)??m.id.replace(/-/g,' '),body:summary(md,1100),tags:['reference','motion',slug(m.category??'')].filter(Boolean),source:'reference:'+m.folder,status:'proven'});
  }
  // The user's feedback rules saved in memory.md.
  for(const l of parseLessons(readText(memoryFile()).replace(/\r\n/g,'\n')))
   upsert({id:l.id,domain:'both',kind:l.verdict==='approve'?'preference':'rule',title:l.rule.slice(0,100),body:`${l.rule} (The user said: "${l.quote}"; seen ${l.count}×.)`,tags:l.topics,source:'feedback',status:'proven'});
  // Guides from the knowledge index, so recall finds the full guide.
  const index=readJson(path.join(ROOT,'agent','knowledge','index.json')) as {entries?:{id:string;title:string;path:string;topics:string[]}[]}|null;
  for(const e of index?.entries??[]){
   const text=readText(path.join(ROOT,e.path));if(!text||e.path.endsWith('memory.md'))continue;
   upsert({id:'guide-'+e.id,domain:e.topics.some(t=>/edit|audio|caption|footage/.test(t))?'editing':e.topics.some(t=>/motion|design|style|typography/.test(t))?'motion':'both',kind:'tool',
    title:`Guide: ${e.title}`,body:`Read ${e.path}. `+summary(text,900),tags:['guide',...e.topics],source:'guide:'+e.path,status:'approved'});
  }
  // References that were renamed or deleted leave the brain, and so does starting knowledge that was
  // removed (named style examples, genre recipes, ready-made pieces and their layouts): the brain
  // keeps general principles, the user's feedback and references, and what it learned itself.
  for(const r of d.prepare("select id from knowledge where source like 'reference:%' or source like 'piece:%' or source like 'seed:%' or id like 'pt-layout-%'").all() as {id:string}[])
   if(!seen.has(r.id)){d.prepare('delete from knowledge where id=?').run(r.id);d.prepare('delete from knowledge_fts where id=?').run(r.id);removed++;}
  d.exec('commit');
 }catch(e){d.exec('rollback');throw e;}
 if(added||updated||removed)exportCommitted();
 return {added,updated,removed,total:(d.prepare('select count(*) n from knowledge').get() as {n:number}).n};
}
function readJson(f:string){try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return null;}}
function readText(f:string){try{return fs.readFileSync(f,'utf8');}catch{return '';}}
const titleOf=(md:string)=>md.match(/^#\s+(.+)$/m)?.[1]?.trim()??null;
function summary(md:string,max:number){return md.replace(/```[\s\S]*?```/g,'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/^#+\s*/gm,'').replace(/\|/g,' ').replace(/\s+/g,' ').trim().slice(0,max);}

// ---------- adding knowledge ----------
export type AddInput={title:string;body:string;domain?:Domain;kind?:Kind;tags?:string[];source:string;status?:Status;id?:string;evidence?:string[]};
/** Adds or updates knowledge. Web findings start as trial; job-measured facts and feedback start as proven. */
export function add(i:AddInput){
 if(!i.title?.trim()||!i.body?.trim())throw new Error('Knowledge needs a title and a body');
 if(!i.source?.trim())throw new Error('Record where it came from (--source): a link, job:ID, feedback, reference:FILE');
 const domain=i.domain??'both',kind=i.kind??'technique';
 if(!domains.includes(domain))throw new Error('domain must be '+domains.join(', '));if(!kinds.includes(kind))throw new Error('kind must be '+kinds.join(', '));
 const status=i.status??(/^https?:|^web:|^study:/.test(i.source)?'trial':'proven');
 if(!statuses.includes(status))throw new Error('status must be '+statuses.join(', '));
 const id=i.id??`${kind.slice(0,3)}-${slug(i.title)}`;
 const cur=getKnowledge(id),stamp=now();
 const k:Knowledge={id,domain,kind,title:i.title.trim(),body:i.body.trim(),tags:[...new Set((i.tags??[]).map(t=>t.toLowerCase().trim()).filter(Boolean))],source:i.source,
  status:cur&&cur.status!=='trial'&&status==='trial'?cur.status:status,wins:cur?.wins??0,losses:cur?.losses??0,uses:cur?.uses??0,created:cur?.created??stamp,updated:stamp,
  evidence:[...new Set([...(cur?.evidence??[]),...(i.evidence??[]),i.source])].slice(-20)};
 putKnowledge(db(),k);exportCommitted();
 return {action:cur?'updated':'added',knowledge:k};
}
export function setStatus(id:string,status:Status,note?:string){
 const k=getKnowledge(id);if(!k)throw new Error('No knowledge '+id);
 const next={...k,status,updated:now(),evidence:note?[...k.evidence,note].slice(-20):k.evidence};putKnowledge(db(),next);exportCommitted();return next;
}

// ---------- recall ----------
export type Recalled={id:string;title:string;use:string;kind:Kind;domain:Domain;status:Status;confidence:number;always:boolean;source:string;tags:string[]};
const ftsQuery=(text:string)=>[...new Set(text.toLowerCase().normalize('NFKC').split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>2&&!STOP.has(w)))].slice(0,24).map(w=>`"${w.replace(/"/g,'')}"*`).join(' OR ');
const STOP=new Set(['the','and','for','with','that','this','are','was','you','your','from','into','about','make','want','need','video','please','some','have']);
/** What to apply to a brief: rules and preferences always; then the best-matching proven, approved and trial knowledge. */
export function recall(brief:string,{domain,limit=15,includeTrial=true}:{domain?:Domain;limit?:number;includeTrial?:boolean}={}){
 const d=db();
 const always=(d.prepare("select * from knowledge where kind in ('rule','preference','avoid') and status in ('proven','approved')").all() as Record<string,unknown>[]).map(toKnowledge)
  .filter(k=>!domain||k.domain===domain||k.domain==='both');
 const q=ftsQuery(brief);
 const matched=q?(d.prepare(`select k.*,bm25(knowledge_fts,0,3,1,2) score from knowledge_fts f join knowledge k on k.id=f.id where knowledge_fts match ? and k.status not in ('rejected','retired') order by score limit 120`).all(q) as (Record<string,unknown>&{score:number})[]):[];
 const briefWords=new Set(brief.toLowerCase().normalize('NFKC').split(/[^\p{L}\p{N}:]+/u).filter(Boolean).flatMap(w=>[w,w.replace(/s$/,'')]));
 const scored=matched.map(r=>{const k=toKnowledge(r);const tagHits=k.tags.filter(t=>briefWords.has(t)).length;return {k,s:(-r.score)*weight[k.status]*(0.5+confidence(k))*(1+.6*tagHits)};})
  .filter(x=>!domain||x.k.domain===domain||x.k.domain==='both').filter(x=>includeTrial||x.k.status!=='trial').filter(x=>!always.some(a=>a.id===x.k.id))
  .sort((a,b)=>b.s-a.s);
 const out:Recalled[]=[];
 const push=(k:Knowledge,isAlways:boolean)=>out.push({id:k.id,title:k.title,use:k.body,kind:k.kind,domain:k.domain,status:k.status,confidence:Math.round(confidence(k)*100)/100,always:isAlways,source:k.source,tags:k.tags});
 for(const k of always.sort((a,b)=>confidence(b)-confidence(a)))push(k,true);
 // keep variety: at most 4 styles, 3 trial items
 let styles=0,trials=0,guides=0;
 for(const {k} of scored){if(out.length>=always.length+limit)break;if(k.kind==='style'&&++styles>4)continue;if(k.kind==='tool'&&++guides>4)continue;if(k.status==='trial'&&++trials>3)continue;push(k,false);}
 return {brief,always:out.filter(x=>x.always).length,items:out,note:'Apply every "always" item. Use the rest where they fit; items with status "trial" are unproven: try them only when they suit the brief and record them with brain apply.'};
}

// ---------- jobs ----------
export type JobInput=Partial<Omit<Job,'id'|'created'|'updated'>>&{id:string};
/** Records or updates a job (called automatically when a video or edit finishes). */
export function recordJob(j:JobInput){
 const cur=getJob(j.id),stamp=now();
 const defaults:Job={id:j.id,kind:'video',title:'',brief:'',language:null,format:null,preset:null,durationSeconds:null,scenes:null,pieces:[],transitions:[],renderSeconds:null,checks:{},applied:[],verdict:null,revisions:0,output:null,created:stamp,updated:stamp};
 const given=Object.fromEntries(Object.entries(j).filter(([,v])=>v!==undefined)) as Partial<Job>;
 const job:Job={...defaults,...cur,...given,checks:{...cur?.checks,...j.checks},applied:[...new Set([...(cur?.applied??[]),...(j.applied??[])])],id:j.id,created:cur?.created??stamp,updated:stamp};
 putJob(db(),job);exportCommitted();return job;
}
/** Marks knowledge as used in a job; its score changes when the job gets a verdict. */
export function apply(jobId:string,ids:string[]){
 const missing=ids.filter(id=>!getKnowledge(id));if(missing.length)throw new Error('Unknown knowledge: '+missing.join(', '));
 const d=db();
 for(const id of ids){const k=getKnowledge(id)!;putKnowledge(d,{...k,uses:k.uses+1,updated:now()});}
 const job=recordJob({id:jobId,applied:ids});
 return {job:job.id,applied:job.applied};
}
/** The user's verdict on a job: scores every piece of knowledge it used; trial items with two wins become proven, repeated losers retire. */
export function verdict(jobId:string,v:'approved'|'revised'|'rejected'){
 const cur=getJob(jobId)??recordJob({id:jobId});
 const job=recordJob({id:jobId,verdict:v,revisions:cur.revisions+(v==='revised'?1:0)});
 const d=db(),changes:{id:string;status:Status;confidence:number}[]=[];
 const win=v==='approved',loss=v==='rejected';
 if(win||loss)for(const id of job.applied){
  const k=getKnowledge(id);if(!k)continue;
  const next={...k,wins:k.wins+(win?1:0),losses:k.losses+(loss?1:0),updated:now(),evidence:[...k.evidence,`job:${jobId}:${v}`].slice(-20)};
  if(next.status==='trial'&&next.wins>=2&&next.wins>next.losses)next.status='proven';
  if(next.losses>=2&&confidence(next)<.35&&!['rule','preference'].includes(next.kind))next.status='retired';
  putKnowledge(d,next);changes.push({id,status:next.status,confidence:Math.round(confidence(next)*100)/100});
 }
 exportCommitted();
 return {job:jobId,verdict:v,scored:changes};
}

// ---------- study sessions ----------
/** A measured signal (not a user verdict): automatic quality checks mark traits that made a frame fail. */
export function nudge(ids:string[],good:boolean,evidence:string){
 const d=db();const out:{id:string;confidence:number}[]=[];
 for(const id of ids){const k=getKnowledge(id);if(!k)continue;
  const next={...k,wins:k.wins+(good?1:0),losses:k.losses+(good?0:1),updated:now(),evidence:[...k.evidence,evidence].slice(-20)};
  putKnowledge(d,next);out.push({id,confidence:Math.round(confidence(next)*100)/100});}
 if(out.length)exportCommitted();return out;
}
export function saveFindings(topic:string,rows:{channel:string;title:string|null;url:string|null;text:string|null}[]){
 const d=db(),st=d.prepare('insert into findings(topic,channel,title,url,text,created) values(?,?,?,?,?,?)'),stamp=now();
 for(const r of rows)if(r.url&&!d.prepare('select 1 from findings where url=? and topic=?').get(r.url,topic))st.run(topic,r.channel,r.title,r.url,(r.text??'').slice(0,1200),stamp);
 return (d.prepare('select id,channel,title,url,text from findings where topic=? and used=0 order by id desc limit 60').all(topic) as Record<string,unknown>[]);
}
export function markFindingsUsed(ids:number[]){const st=db().prepare('update findings set used=1 where id=?');for(const id of ids)st.run(id);}

// ---------- report: is it getting better? ----------
export function report(){
 const ks=allKnowledge(),jobs=allJobs();
 const byStatus=Object.fromEntries(statuses.map(s=>[s,ks.filter(k=>k.status===s).length]));
 const byDomain=Object.fromEntries(domains.map(dm=>[dm,ks.filter(k=>k.domain===dm).length]));
 const judged=jobs.filter(j=>j.verdict);
 const window=(list:Job[])=>list.length?{jobs:list.length,approvedFirstTime:Math.round(list.filter(j=>j.verdict==='approved'&&j.revisions===0).length/list.length*100)+'%',avgRevisions:Math.round(list.reduce((a,j)=>a+j.revisions,0)/list.length*10)/10}:null;
 const half=Math.floor(judged.length/2);
 const top=ks.filter(k=>k.uses>0).sort((a,b)=>confidence(b)-confidence(a)).slice(0,8).map(k=>({id:k.id,title:k.title,confidence:Math.round(confidence(k)*100)/100,wins:k.wins,losses:k.losses}));
 const weak=ks.filter(k=>k.losses>0).sort((a,b)=>confidence(a)-confidence(b)).slice(0,5).map(k=>({id:k.id,title:k.title,confidence:Math.round(confidence(k)*100)/100,status:k.status}));
 const recent=ks.slice().sort((a,b)=>b.created.localeCompare(a.created)).slice(0,8).map(k=>({id:k.id,title:k.title,status:k.status,source:k.source,created:k.created.slice(0,10)}));
 return {knowledge:{total:ks.length,byStatus,byDomain,trialToTry:ks.filter(k=>k.status==='trial').length},
  jobs:{total:jobs.length,judged:judged.length,videos:jobs.filter(j=>j.kind==='video').length,edits:jobs.filter(j=>j.kind==='edit').length},
  improvement:judged.length>=4?{earlier:window(judged.slice(0,half)),recent:window(judged.slice(half))}:{note:'Needs at least 4 jobs with a verdict to compare earlier and recent work.',all:window(judged)},
  topKnowledge:top,weakKnowledge:weak,recentlyLearned:recent};
}
export {getKnowledge,getJob,allKnowledge};
