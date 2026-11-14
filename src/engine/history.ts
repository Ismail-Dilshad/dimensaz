// The change history: every change to what the studio learned (lessons, your rules, taught videos),
// your taste profiles and your ratings, with what each item was before. Undo puts an item back the
// way it was, field by field: a field changed again later keeps the later value, a counter (wins,
// losses, times seen) gives back only what this change added, a list loses only what this change
// put in. An undo is itself a change, so it can be undone too (that is a redo).
import fs from 'node:fs';
import path from 'node:path';
import {AsyncLocalStorage} from 'node:async_hooks';
import {randomBytes} from 'node:crypto';
import {ROOT} from './config-root.js';
import {watchChanges,db,getKnowledge,putKnowledge,removeKnowledge,getJob,putJob,removeJob,getVideo,putVideo,removeVideo,exportCommitted,type Knowledge,type Job,type VideoRow} from './brain/db.js';

export type Kind='lessons'|'taste'|'ratings';
export const KINDS:Kind[]=['lessons','taste','ratings'];
export type Store='lesson'|'rule'|'taught'|'profile'|'plan'|'gallery'|'brainjob';
type Item={store:Store;key:string;label:string;before:unknown;after:unknown};
export type Entry={id:string;at:string;kind:Kind;title:string;job?:string;items:Item[];undoes?:string;undoneBy?:string;kept?:string[]};
type Meta={kind:Kind;title:string;job?:string};
type Group=Meta&{quiet?:boolean;items:Map<string,{store:Store;key:string;label?:string;before:unknown}>};

/** How to read and write one kind of item, and how to undo a change to it. */
export type Adapter={read:(key:string)=>unknown;write:(key:string,value:unknown)=>void;label:(key:string,value:unknown)=>string;
 counters?:string[];sets?:Record<string,string|null>;skip?:string[];
 merge?:(before:unknown,after:unknown,current:unknown)=>{value:unknown;kept:string[]};after?:()=>void};
const adapters:Partial<Record<Store,Adapter>>={};
/** Each part of the studio that keeps changeable things says how to read and write them. */
export function adapter(store:Store,a:Adapter){adapters[store]=a;}

const now=()=>new Date().toISOString();
const eq=(a:unknown,b:unknown)=>JSON.stringify(a??null)===JSON.stringify(b??null);
const clone=<T>(x:T):T=>x===undefined?null as T:JSON.parse(JSON.stringify(x)) as T;
const als=new AsyncLocalStorage<Group>();

/** Remembers what an item was before the change being recorded first touches it. Outside a recorded
 *  change it does nothing. */
export function touch(store:Store,key:string,before:()=>unknown,label?:string){
 const g=als.getStore();if(!g||g.quiet)return;const k=store+'\0'+key;
 if(!g.items.has(k))g.items.set(k,{store,key,...(label?{label}:{}),before:clone(before())});
}
watchChanges((store,id,before)=>touch(store,id,before));

/** Records everything `fn` changes as one entry of the history (a change inside another one is part of it). */
export function change<T>(meta:Meta,fn:()=>T):T{
 if(als.getStore())return fn();
 const g:Group={...meta,items:new Map()};
 let r:T;
 try{r=als.run(g,fn);}catch(e){finish(g);throw e;}
 if(r instanceof Promise)return r.then(v=>{finish(g);return v;},e=>{finish(g);throw e;}) as T;
 finish(g);return r;
}
/** Runs `fn` without recording it (housekeeping the user did not ask for). */
export function quietly<T>(fn:()=>T):T{return als.run({kind:'lessons',title:'',quiet:true,items:new Map()},fn);}

function finish(g:Group,extra:Partial<Entry>={}){
 const items:Item[]=[];
 for(const x of g.items.values()){const a=adapters[x.store];if(!a)continue;const after=clone(a.read(x.key));if(eq(x.before,after))continue;
  items.push({store:x.store,key:x.key,label:x.label??a.label(x.key,after??x.before),before:x.before,after});}
 if(!items.length)return null;
 const e:Entry={id:'h-'+Date.now().toString(36)+randomBytes(2).toString('hex'),at:now(),kind:g.kind,title:g.title.slice(0,160),...(g.job?{job:g.job}:{}),items,...extra};
 const all=load();all.push(e);save(all);return e;
}

// ---------- where it is kept ----------
const file=()=>path.join(path.resolve(ROOT,process.env.TEMPOLOOM_SETTINGS_DIR||'.tempoloom'),'history.json');
// Tests that did not choose a folder keep their history in memory: it never lands in the project.
const inMemory=()=>!!process.env.VITEST&&!process.env.TEMPOLOOM_SETTINGS_DIR;
let memory:Entry[]=[];
const MAX=600;
export const historyFile=file;
function load():Entry[]{
 if(inMemory())return memory;
 try{const x=JSON.parse(fs.readFileSync(file(),'utf8')) as {entries?:Entry[]};return Array.isArray(x.entries)?x.entries:[];}catch{return [];}
}
function save(all:Entry[]){
 const kept=all.slice(-MAX);if(inMemory()){memory=kept;return;}
 fs.mkdirSync(path.dirname(file()),{recursive:true});const tmp=file()+'.'+process.pid+'.tmp';
 fs.writeFileSync(tmp,JSON.stringify({version:1,entries:kept})+'\n');fs.renameSync(tmp,file());
}

// ---------- undo, field by field ----------
export function revertSet(before:unknown[],after:unknown[],cur:unknown[],idKey:string|null){
 const key=(x:unknown)=>idKey&&x&&typeof x==='object'?String((x as Record<string,unknown>)[idKey]):JSON.stringify(x);
 const b=new Set(before.map(key)),a=new Set(after.map(key));
 const added=new Set([...a].filter(k=>!b.has(k))),removed=before.filter(x=>!a.has(key(x)));
 const out=cur.filter(x=>!added.has(key(x)));for(const x of removed)if(!out.some(y=>key(y)===key(x)))out.push(x);
 return out;
}
/** The value an item gets back: exactly what it was when nothing changed it since; otherwise each
 *  field this change made goes back, unless a later change set it again. */
export function merge3(before:unknown,after:unknown,cur:unknown,o:{counters?:string[];sets?:Record<string,string|null>;skip?:string[]}={}):{value:unknown;kept:string[]}{
 if(eq(cur,after))return {value:clone(before),kept:[]};
 if(after===null)return cur===null?{value:clone(before),kept:[]}:{value:cur,kept:['made again later']};
 if(cur===null)return {value:null,kept:['removed later']};
 if(typeof cur!=='object'||typeof after!=='object'||Array.isArray(cur))return {value:cur,kept:['changed again later']};
 const A=after as Record<string,unknown>,C=cur as Record<string,unknown>,out:Record<string,unknown>={...C},kept:string[]=[];
 // Made by this change and changed since: it stays (a later change uses it), without the counts and
 // list entries this change gave it.
 if(before===null){
  for(const k of Object.keys(A))if(o.counters?.includes(k))out[k]=Math.max(0,Number(C[k]??0)-Number(A[k]??0));
  return {value:out,kept:['kept: a later change uses it']};
 }
 const B=before as Record<string,unknown>;
 for(const k of new Set([...Object.keys(B),...Object.keys(A)])){
  if(o.skip?.includes(k)||eq(B[k],A[k]))continue;
  if(o.counters?.includes(k)){out[k]=Math.max(0,Number(C[k]??0)-(Number(A[k]??0)-Number(B[k]??0)));continue;}
  if(o.sets&&k in o.sets&&Array.isArray(C[k])){out[k]=revertSet((B[k]??[]) as unknown[],(A[k]??[]) as unknown[],C[k] as unknown[],o.sets[k]!);continue;}
  if(eq(C[k],A[k])){if(B[k]===undefined)delete out[k];else out[k]=clone(B[k]);}else kept.push(k);
 }
 return {value:out,kept};
}

async function ensureAdapters(){await Promise.all([import('./feedback.js'),import('./taste.js'),import('./studio.js'),import('./gallery.js')]);}

/** Undoes one entry of the history. A change made after it to the same field keeps its value. */
export async function undo(id:string){
 await ensureAdapters();
 const all=load(),e=all.find(x=>x.id===id);if(!e)throw new Error(`No change "${id}" in the history`);
 if(e.undoneBy)throw new Error('This change was already undone');
 const original=e.undoes?all.find(x=>x.id===e.undoes):undefined;
 const title=e.undoes?`Redid: ${original?.title??e.title.replace(/^Undid: /,'')}`:`Undid: ${e.title}`;
 const kept:string[]=[];
 const g:Group={kind:e.kind,title,...(e.job?{job:e.job}:{}),items:new Map()};
 let wroteLessons=false;
 als.run(g,()=>{
  const d=db();d.exec('begin');
  try{
   for(const it of [...e.items].reverse()){const a=adapters[it.store];if(!a)continue;
    const cur=clone(a.read(it.key)),r=a.merge?a.merge(it.before,it.after,cur):merge3(it.before,it.after,cur,a);
    if(r.kept.length)kept.push(`${it.label}: ${r.kept.join(', ')}`);
    if(eq(r.value,cur))continue;
    touch(it.store,it.key,()=>cur,it.label);a.write(it.key,r.value);if(['lesson','brainjob','taught'].includes(it.store))wroteLessons=true;}
   d.exec('commit');
  }catch(err){d.exec('rollback');throw err;}
 });
 if(wroteLessons)exportCommitted();
 for(const a of Object.values(adapters))a.after?.();
 const done=finish(g,{undoes:e.id,...(kept.length?{kept}:{})});
 const list=load(),me=list.find(x=>x.id===e.id);
 if(me&&done){me.undoneBy=done.id;if(original&&original.undoneBy===e.id)delete list.find(x=>x.id===original.id)!.undoneBy;save(list);}
 return {undid:e.title,as:done?.id??null,changed:done?.items.length??0,...(kept.length?{kept}:{}),
  note:done?(kept.length?'Undone. Some fields kept the value a later change gave them.':'Undone.'):'Nothing to undo: everything is already as it was before.'};
}

// ---------- what the page shows ----------
const pick=(x:unknown)=>(x??{}) as Record<string,unknown>;
function what(it:Item):string[]{
 const B=pick(it.before),A=pick(it.after),out:string[]=[];
 if(it.before===null)return [it.store==='plan'?'started':'added'];
 if(it.after===null)return ['removed'];
 switch(it.store){
  case 'lesson':case 'taught':{
   if(B.status!==A.status)out.push(`${B.status} → ${A.status}`);
   const w=Number(A.wins??0)-Number(B.wins??0),l=Number(A.losses??0)-Number(B.losses??0);if(w)out.push(`${w>0?'+':''}${w} good`);if(l)out.push(`${l>0?'+':''}${l} bad`);
   if(B.title!==A.title||B.body!==A.body)out.push('text changed');if(it.store==='taught'&&B.verdict!==A.verdict)out.push(`example: ${A.verdict??'none'}`);break;}
  case 'rule':if(B.count!==A.count)out.push(`seen ${B.count}× → ${A.count}×`);if(B.rule!==A.rule)out.push('wording changed');break;
  case 'profile':{
   const off=(x:Record<string,unknown>)=>new Set((x.off??[]) as string[]),bo=off(B),ao=off(A);
   const n=[...ao].filter(x=>!bo.has(x)).length,m=[...bo].filter(x=>!ao.has(x)).length;if(n)out.push(`${n} line${n>1?'s':''} switched off`);if(m)out.push(`${m} line${m>1?'s':''} switched on`);
   const ba=((B.added??[]) as {id:string}[]).length,aa=((A.added??[]) as {id:string}[]).length;if(aa>ba)out.push('own line added');if(aa<ba)out.push('own line removed');
   if(!eq(B.targets,A.targets))out.push('targets changed');if(B.name!==A.name)out.push('renamed');if(B.notes!==A.notes)out.push('notes changed');if(!eq(B.videos,A.videos))out.push('examples changed');break;}
  case 'plan':{
   const r=((A.ratings??[]) as {task:string;rating:string;at:string}[]).filter(x=>!((B.ratings??[]) as {at:string}[]).some(y=>y.at===x.at));
   for(const x of r)out.push(`${x.task} rated ${x.rating==='ok'?'not bad':x.rating}`);
   const gone=((B.ratings??[]) as {task:string;at:string}[]).filter(x=>!((A.ratings??[]) as {at:string}[]).some(y=>y.at===x.at));for(const x of gone)out.push(`rating of ${x.task} removed`);
   const c=((A.comments??[]) as {id:string}[]).length-((B.comments??[]) as unknown[]).length;if(c>0)out.push(`${c} comment${c>1?'s':''}`);
   const tb=pick(B.tasks),ta=pick(A.tasks);
   const reopened=Object.keys(ta).filter(k=>pick(tb[k]).status==='done'&&['redo','todo'].includes(String(pick(ta[k]).status)));if(reopened.length)out.push('reopened: '+reopened.join(', '));
   const closed=Object.keys(ta).filter(k=>pick(ta[k]).status==='done'&&['redo','todo'].includes(String(pick(tb[k]).status)));if(closed.length)out.push('finished again: '+closed.join(', '));
   const picked=Object.keys(ta).filter(k=>pick(ta[k]).picked&&pick(ta[k]).picked!==pick(tb[k]).picked);for(const k of picked)out.push(`${k}: picked ${pick(ta[k]).picked}`);
   if(B.verdict!==A.verdict)out.push(`verdict: ${A.verdict??'none'}`);break;}
  case 'gallery':out.push(`rated ${pick(A).rating??'none'}`);break;
  case 'brainjob':if(B.verdict!==A.verdict)out.push(`verdict: ${A.verdict??'none'}`);break;
 }
 return out.length?out:['changed'];
}
/** The history, newest first. */
export function history(o:{kind?:Kind;job?:string;limit?:number}={}){
 const all=load(),undone=new Set(all.filter(e=>e.undoneBy).map(e=>e.id));
 const list=all.filter(e=>(!o.kind||e.kind===o.kind)&&(!o.job||e.job===o.job)).reverse().slice(0,Math.max(1,Math.min(600,o.limit??200)));
 return {entries:list.map(e=>({id:e.id,at:e.at,kind:e.kind,title:e.title,job:e.job??null,undone:undone.has(e.id),undoes:e.undoes??null,kept:e.kept??[],
   items:e.items.map(it=>({store:it.store,label:it.label,what:what(it)}))})),
  counts:Object.fromEntries(KINDS.map(k=>[k,all.filter(e=>e.kind===k).length])) as Record<Kind,number>,total:all.length,kept:MAX};
}
export const entry=(id:string)=>load().find(e=>e.id===id)??null;

// ---------- the brain's own items ----------
adapter('lesson',{read:k=>getKnowledge(k),write:(k,v)=>{if(v===null)removeKnowledge(k);else putKnowledge(db(),{...(v as Knowledge),updated:now()});},
 label:(k,v)=>String(pick(v).title??k),counters:['wins','losses','uses'],sets:{evidence:null,tags:null},skip:['updated','created']});
adapter('brainjob',{read:k=>getJob(k),write:(k,v)=>{if(v===null)removeJob(k);else putJob(db(),{...(v as Job),updated:now()});},
 label:(k,v)=>`The studio's record of ${String(pick(v).title||k)}`,counters:['revisions'],sets:{applied:null},skip:['updated','created']});
adapter('taught',{read:k=>getVideo(k),write:(k,v)=>{if(v===null)removeVideo(k);else putVideo({...(v as VideoRow),updated:now()});},
 label:(k,v)=>`The taught video ${String(pick(v).title||k)}`,skip:['updated','created','step']});
