// The brain's database: SQLite (node:sqlite, built into Node 22) in .dimensaz/brain.db, with
// full-text search. The committed copy lives in agent/brain/*.jsonl, so the database rebuilds
// itself on any computer and every change shows up in git.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {ROOT} from '../config.js';

const require=createRequire(import.meta.url);
type Sqlite=typeof import('node:sqlite');
let sqlite:Sqlite|null=null;
function lib(){
 if(sqlite)return sqlite;
 const emit=process.emitWarning;
 // node:sqlite prints an "experimental" warning once; it is stable enough for this use.
 process.emitWarning=((w:string|Error,...rest:unknown[])=>{if(String((w as Error)?.message??w).includes('SQLite'))return;return (emit as (...a:unknown[])=>void).call(process,w,...rest);}) as typeof process.emitWarning;
 try{sqlite=require('node:sqlite') as Sqlite;}
 catch{throw new Error('The knowledge database needs Node 22.13 or newer (node:sqlite). Update Node from nodejs.org.');}
 finally{process.emitWarning=emit;}
 return sqlite;
}

export const brainDir=()=>process.env.DIMENSAZ_BRAIN_DIR??path.join(ROOT,'agent','brain');
export const dbPath=()=>process.env.DIMENSAZ_BRAIN_DB??path.join(ROOT,'.dimensaz','brain.db');
export const files=()=>({knowledge:path.join(brainDir(),'knowledge.jsonl'),jobs:path.join(brainDir(),'jobs.jsonl')});

export const domains=['motion','editing','both'] as const;
export const kinds=['principle','technique','style','rule','preference','recipe','trend','tool','fact','avoid'] as const;
export const statuses=['approved','proven','trial','rejected','retired'] as const;
export type Domain=typeof domains[number];export type Kind=typeof kinds[number];export type Status=typeof statuses[number];
export type Knowledge={id:string;domain:Domain;kind:Kind;title:string;body:string;tags:string[];source:string;status:Status;
 wins:number;losses:number;uses:number;created:string;updated:string;evidence:string[]};
export type Job={id:string;kind:'video'|'edit';title:string;brief:string;language:string|null;format:string|null;preset:string|null;
 durationSeconds:number|null;scenes:number|null;pieces:string[];transitions:string[];renderSeconds:number|null;checks:Record<string,unknown>;
 applied:string[];verdict:'approved'|'revised'|'rejected'|null;revisions:number;output:string|null;created:string;updated:string};

const SCHEMA=`
create table if not exists knowledge(id text primary key,domain text not null,kind text not null,title text not null,body text not null,tags text not null,
 source text not null,status text not null,wins integer not null default 0,losses integer not null default 0,uses integer not null default 0,
 created text not null,updated text not null,evidence text not null default '[]');
create virtual table if not exists knowledge_fts using fts5(id unindexed,title,body,tags,tokenize='unicode61 remove_diacritics 2');
create table if not exists jobs(id text primary key,data text not null,created text not null,verdict text);
create table if not exists findings(id integer primary key autoincrement,topic text not null,channel text not null,title text,url text,text text,created text not null,used integer not null default 0);
create table if not exists meta(key text primary key,value text not null);
`;

let open:import('node:sqlite').DatabaseSync|null=null;
let openPath='';
export function db(){
 const file=dbPath();
 if(open&&openPath===file)return open;
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const {DatabaseSync}=lib();
 open=new DatabaseSync(file);openPath=file;
 open.exec('pragma journal_mode=wal;pragma busy_timeout=5000;');
 open.exec(SCHEMA);
 importCommitted(open);
 return open;
}
export function closeDb(){open?.close();open=null;openPath='';}

const rowToKnowledge=(r:Record<string,unknown>):Knowledge=>({id:String(r.id),domain:r.domain as Domain,kind:r.kind as Kind,title:String(r.title),body:String(r.body),
 tags:String(r.tags).split(' ').filter(Boolean),source:String(r.source),status:r.status as Status,wins:Number(r.wins),losses:Number(r.losses),uses:Number(r.uses),
 created:String(r.created),updated:String(r.updated),evidence:JSON.parse(String(r.evidence||'[]'))});
export const toKnowledge=rowToKnowledge;

/** Writes one knowledge item (insert or replace) and its search entry. */
export function putKnowledge(d:import('node:sqlite').DatabaseSync,k:Knowledge){
 d.prepare(`insert into knowledge(id,domain,kind,title,body,tags,source,status,wins,losses,uses,created,updated,evidence) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  on conflict(id) do update set domain=excluded.domain,kind=excluded.kind,title=excluded.title,body=excluded.body,tags=excluded.tags,source=excluded.source,status=excluded.status,
  wins=excluded.wins,losses=excluded.losses,uses=excluded.uses,updated=excluded.updated,evidence=excluded.evidence`)
  .run(k.id,k.domain,k.kind,k.title,k.body,k.tags.join(' '),k.source,k.status,k.wins,k.losses,k.uses,k.created,k.updated,JSON.stringify(k.evidence));
 d.prepare('delete from knowledge_fts where id=?').run(k.id);
 d.prepare('insert into knowledge_fts(id,title,body,tags) values(?,?,?,?)').run(k.id,k.title,k.body,k.tags.join(' '));
}
export function getKnowledge(id:string){const r=db().prepare('select * from knowledge where id=?').get(id) as Record<string,unknown>|undefined;return r?rowToKnowledge(r):null;}
export function allKnowledge(){return (db().prepare('select * from knowledge order by id').all() as Record<string,unknown>[]).map(rowToKnowledge);}
export function putJob(d:import('node:sqlite').DatabaseSync,j:Job){d.prepare('insert into jobs(id,data,created,verdict) values(?,?,?,?) on conflict(id) do update set data=excluded.data,verdict=excluded.verdict').run(j.id,JSON.stringify(j),j.created,j.verdict);}
export function getJob(id:string){const r=db().prepare('select data from jobs where id=?').get(id) as {data:string}|undefined;return r?JSON.parse(r.data) as Job:null;}
export function allJobs(){return (db().prepare('select data from jobs order by created').all() as {data:string}[]).map(r=>JSON.parse(r.data) as Job);}

// ---------- committed copy (agent/brain/*.jsonl) ----------
const readLines=(f:string)=>{try{return fs.readFileSync(f,'utf8').split(/\r?\n/).filter(l=>l.trim());}catch{return [];}};
const stamp=(f:string)=>{try{const s=fs.statSync(f);return s.size+':'+s.mtimeMs;}catch{return 'none';}};
/** Loads the committed files when they changed since the database last saw them (a git pull, another computer). */
function importCommitted(d:import('node:sqlite').DatabaseSync){
 const f=files(),mark=stamp(f.knowledge)+'|'+stamp(f.jobs);
 const seen=(d.prepare("select value from meta where key='committed'").get() as {value:string}|undefined)?.value;
 if(seen===mark)return;
 d.exec('begin');
 try{
  for(const line of readLines(f.knowledge)){const k=JSON.parse(line) as Knowledge;const cur=d.prepare('select updated from knowledge where id=?').get(k.id) as {updated:string}|undefined;if(!cur||cur.updated<=k.updated)putKnowledge(d,k);}
  for(const line of readLines(f.jobs)){const j=JSON.parse(line) as Job;const cur=d.prepare('select data from jobs where id=?').get(j.id) as {data:string}|undefined;if(!cur||(JSON.parse(cur.data) as Job).updated<=j.updated)putJob(d,j);}
  d.prepare("insert into meta(key,value) values('committed',?) on conflict(key) do update set value=excluded.value").run(mark);
  d.exec('commit');
 }catch(e){d.exec('rollback');throw e;}
}
/** Writes the committed copy: one JSON object per line, sorted, so git diffs stay small. */
export function exportCommitted(){
 const f=files();fs.mkdirSync(brainDir(),{recursive:true});
 const write=(file:string,lines:string[])=>{const tmp=file+'.tmp';fs.writeFileSync(tmp,lines.join('\n')+(lines.length?'\n':''));fs.renameSync(tmp,file);};
 write(f.knowledge,allKnowledge().map(k=>JSON.stringify(k)));
 write(f.jobs,allJobs().map(j=>JSON.stringify(j)));
 db().prepare("insert into meta(key,value) values('committed',?) on conflict(key) do update set value=excluded.value").run(stamp(f.knowledge)+'|'+stamp(f.jobs));
}
