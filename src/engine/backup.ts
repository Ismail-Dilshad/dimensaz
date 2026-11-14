// Backup and move: everything the studio learned, in one file you can keep or carry to another
// computer. The brain (lessons, scores, taught videos, jobs), your taste profiles, your feedback
// rules, the taught videos' thumbnails, the studio's jobs and your ratings, the gallery's stars and
// your settings. Never the keys, the videos themselves or anything outside these places.
// Restoring always saves a backup of what is here first, then merges (or replaces, if asked).
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import {ROOT} from './config.js';
import {db,dbPath,brainDir,allKnowledge,allJobs,allVideos,putKnowledge,putJob,putVideo,exportCommitted,toKnowledge,type Knowledge,type Job,type VideoRow} from './brain/db.js';
import {memoryFile,feedbackLog,parseLessons,writeLessons} from './feedback.js';
import {tasteFile} from './taste.js';
import {studioRoot} from './studio.js';
import {settingsDir} from './models/settings.js';

export const FORMAT='tempoloom-backup';
export const backupDir=()=>path.resolve(ROOT,process.env.TEMPOLOOM_BACKUP_DIR||'backups');
const thumbsDir=()=>path.join(path.dirname(dbPath()),'teach-thumbs');
const galleryFile=()=>path.join(path.dirname(dbPath()),'gallery.json');
const settingsFile=()=>path.join(settingsDir(),'settings.json');
const appVersion=()=>{try{return String(JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')).version);}catch{return 'unknown';}};
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const read=(f:string)=>{try{return fs.readFileSync(f);}catch{return null;}};
const lines=(b:Uint8Array|undefined)=>b?strFromU8(b).split(/\r?\n/).filter(l=>l.trim()):[];
const MAX_FILE=50*1048576,MAX_TOTAL=600*1048576,MAX_STUDIO_FILE=2*1048576;

/** Where each kind of file may sit in a backup; anything else in a backup file is ignored. */
const ALLOWED=[/^manifest\.json$/,/^brain\/(knowledge|jobs|videos)\.jsonl$/,/^brain\/taste\.json$/,/^knowledge\/(memory\.md|feedback\.jsonl)$/,
 /^thumbs\/[a-z0-9][a-z0-9-]{0,70}\.jpg$/,/^studio\/[a-z0-9][a-z0-9-]{0,60}\/[\w][\w .()-]{0,100}\.(json|jsonl|md|txt|srt|vtt|csv)$/,/^local\/(gallery|settings|trends|history)\.json$/];
const allowed=(name:string)=>!name.includes('..')&&!name.includes('\\')&&ALLOWED.some(re=>re.test(name));
const learnedOnly=(k:Knowledge)=>!/^(seed|guide|reference|piece):/.test(k.source);

export type Manifest={format:typeof FORMAT;version:1;app:string;created:string;
 counts:{lessons:number;knowledge:number;taught:number;jobs:number;profiles:number;rules:number;studioJobs:number;thumbs:number};files:{path:string;bytes:number;sha256:string}[]};

/** Everything to back up, as files for the zip. */
function collect():Record<string,Uint8Array>{
 const out:Record<string,Uint8Array>={};
 const ks=allKnowledge(),vids=allVideos().filter(v=>v.status==='learned'),jobs=allJobs();
 out['brain/knowledge.jsonl']=strToU8(ks.map(k=>JSON.stringify(k)).join('\n')+'\n');
 out['brain/jobs.jsonl']=strToU8(jobs.map(j=>JSON.stringify(j)).join('\n')+(jobs.length?'\n':''));
 out['brain/videos.jsonl']=strToU8(vids.map(v=>JSON.stringify(v)).join('\n')+(vids.length?'\n':''));
 for(const [name,f] of [['brain/taste.json',tasteFile()],['knowledge/memory.md',memoryFile()],['knowledge/feedback.jsonl',feedbackLog()],['local/gallery.json',galleryFile()],['local/settings.json',settingsFile()],['local/trends.json',path.join(settingsDir(),'trends.json')],['local/history.json',path.join(settingsDir(),'history.json')]] as const){const b=read(f);if(b)out[name]=b;}
 for(const v of vids){const b=read(path.join(thumbsDir(),v.id+'.jpg'));if(b)out[`thumbs/${v.id}.jpg`]=b;}
 let jobsDirs:string[]=[];try{jobsDirs=fs.readdirSync(studioRoot()).filter(n=>/^[a-z0-9][a-z0-9-]{0,60}$/.test(n));}catch{/* no studio jobs */}
 for(const j of jobsDirs){const dir=path.join(studioRoot(),j);if(!fs.existsSync(path.join(dir,'plan.json')))continue;
  for(const f of fs.readdirSync(dir)){const name=`studio/${j}/${f}`;if(!allowed(name))continue;const st=fs.statSync(path.join(dir,f),{throwIfNoEntry:false});
   if(st?.isFile()&&st.size<=MAX_STUDIO_FILE)out[name]=fs.readFileSync(path.join(dir,f));}}
 return out;
}
function countsOf(files:Record<string,Uint8Array>):Manifest['counts']{
 const ks=lines(files['brain/knowledge.jsonl']).map(l=>JSON.parse(l) as Knowledge);
 let profiles=0;try{profiles=(JSON.parse(strFromU8(files['brain/taste.json']!)) as {profiles:unknown[]}).profiles.length;}catch{/* none */}
 return {lessons:ks.filter(learnedOnly).length,knowledge:ks.length,taught:lines(files['brain/videos.jsonl']).length,jobs:lines(files['brain/jobs.jsonl']).length,profiles,
  rules:files['knowledge/memory.md']?parseLessons(strFromU8(files['knowledge/memory.md'])).length:0,
  studioJobs:new Set(Object.keys(files).filter(n=>n.startsWith('studio/')).map(n=>n.split('/')[1])).size,thumbs:Object.keys(files).filter(n=>n.startsWith('thumbs/')).length};
}

/** Makes a backup as bytes, with a manifest that names every file and its checksum. */
export function backupBytes(){
 db();const files=collect();
 const manifest:Manifest={format:FORMAT,version:1,app:appVersion(),created:new Date().toISOString(),counts:countsOf(files),
  files:Object.entries(files).map(([p,b])=>({path:p,bytes:b.length,sha256:sha(b)})).sort((a,b)=>a.path.localeCompare(b.path))};
 const zip=zipSync({'manifest.json':strToU8(JSON.stringify(manifest,null,1)),...files},{level:6,mtime:new Date()});
 return {zip,manifest};
}
const stamp=(d=new Date())=>d.toISOString().slice(0,16).replace(/[-:]/g,'').replace('T','-');
/** Writes a backup file and says where it is. */
export function createBackup(o:{out?:string;kind?:'manual'|'auto'|'before-restore'}={}){
 const {zip,manifest}=backupBytes(),kind=o.kind??'manual';
 let file=o.out?path.resolve(o.out):path.join(backupDir(),kind==='auto'?'auto':'',`tempoloom-${kind==='manual'?'backup':kind}-${stamp()}.zip`);
 // Two backups in the same minute get a number, so none is ever overwritten.
 if(!o.out){const base=file.slice(0,-4);for(let i=2;fs.existsSync(file);i++)file=`${base}-${i}.zip`;}
 if(o.out&&!file.toLowerCase().endsWith('.zip'))throw new Error('A backup file ends in .zip');
 fs.mkdirSync(path.dirname(file),{recursive:true});
 if(fs.existsSync(file))throw new Error('There is already a file at '+file);
 fs.writeFileSync(file,zip);
 return {file,bytes:zip.length,counts:manifest.counts};
}
/** A weekly backup, kept automatically (the four newest stay), whenever the app opens. */
export function autoBackup(){
 if(process.env.VITEST&&!process.env.TEMPOLOOM_BACKUP_DIR)return null;
 const dir=path.join(backupDir(),'auto');let names:string[]=[];try{names=fs.readdirSync(dir).filter(n=>/^tempoloom-auto-[\d-]+\.zip$/.test(n)).sort();}catch{/* none yet */}
 const newest=names.at(-1),age=newest?Date.now()-fs.statSync(path.join(dir,newest)).mtimeMs:Infinity;
 if(age<7*86400_000)return null;
 if(!allKnowledge().some(learnedOnly)&&!allVideos().length)return null;
 const made=createBackup({kind:'auto'});
 for(const old of [...names,path.basename(made.file)].sort().slice(0,-4))fs.rmSync(path.join(dir,old),{force:true});
 return made;
}
export function listBackups(){
 const found:{file:string;name:string;kind:string;bytes:number;at:string}[]=[];
 for(const [sub,kind] of [['','manual'],['auto','auto']] as const){let names:string[]=[];try{names=fs.readdirSync(path.join(backupDir(),sub));}catch{continue;}
  for(const n of names.filter(n=>n.endsWith('.zip'))){const f=path.join(backupDir(),sub,n),st=fs.statSync(f);found.push({file:f,name:n,kind:n.includes('before-restore')?'before restore':kind,bytes:st.size,at:st.mtime.toISOString()});}}
 return found.sort((a,b)=>b.at.localeCompare(a.at));
}

/** Opens a backup: checks it is one, that nothing is damaged, and that every file is where it may be. */
export function openBackup(bytes:Uint8Array){
 let total=0,files:Record<string,Uint8Array>;
 try{files=unzipSync(bytes,{filter:f=>{total+=f.originalSize;return allowed(f.name)&&f.originalSize<=MAX_FILE&&total<=MAX_TOTAL;}});}
 catch{throw new Error('This is not a Tempoloom backup (it is not a zip file, or it is damaged).');}
 if(total>MAX_TOTAL)throw new Error('This backup is too big to be a Tempoloom backup.');
 let m:Manifest;try{m=JSON.parse(strFromU8(files['manifest.json']!)) as Manifest;}catch{throw new Error('This zip has no Tempoloom manifest: it is not a Tempoloom backup.');}
 if(m.format!==FORMAT||m.version!==1)throw new Error('This is not a Tempoloom backup, or it was made by a newer version of Tempoloom.');
 for(const f of m.files){if(!allowed(f.path))continue;const b=files[f.path];if(!b)throw new Error(`The backup is damaged: ${f.path} is missing.`);if(sha(b)!==f.sha256)throw new Error(`The backup is damaged: ${f.path} does not match its checksum.`);}
 delete files['manifest.json'];
 for(const name of Object.keys(files))if(!m.files.some(f=>f.path===name))delete files[name];
 return {manifest:m,files};
}

type Plan={what:string;add:number;update:number;same:number;keep:number};
/** Two records hold the same thing when they differ only in when they were written (a fresh
 *  computer seeds the same starting knowledge with today's date). */
const sameThing=(a:object,b:object)=>{const strip=(x:object)=>JSON.stringify({...x,created:undefined,updated:undefined});return strip(a)===strip(b);};
/** What a restore would change, without changing anything. */
export function previewRestore(bytes:Uint8Array,mode:'merge'|'replace'='merge'){
 const {manifest,files}=openBackup(bytes);return {manifest,mode,changes:plan(files,mode,false)};
}
/** Restores a backup. A backup of what is here now is always made first. */
export function restoreBackup(bytes:Uint8Array,mode:'merge'|'replace'='merge'){
 const {manifest,files}=openBackup(bytes);
 const before=createBackup({kind:'before-restore'});
 const changes=plan(files,mode,true);
 return {manifest,mode,changes,savedFirst:before.file};
}

/** Works out (and with `apply`, makes) every change. Merge: newer wins item by item, nothing is
 *  removed and your own settings and taste profiles stay. Replace: the backup wins everywhere. */
function plan(files:Record<string,Uint8Array>,mode:'merge'|'replace',apply:boolean):Plan[]{
 const d=db(),out:Plan[]=[];const tally=(what:string)=>{const p={what,add:0,update:0,same:0,keep:0};out.push(p);return p;};
 // The brain: lessons and their scores, past jobs, taught videos.
 const k=tally('Lessons and what the studio knows'),kj=tally('Videos the studio made (brain records)'),kv=tally('Taught videos (measurements and lessons)');
 if(apply)d.exec('begin');
 try{
  for(const line of lines(files['brain/knowledge.jsonl'])){const x=JSON.parse(line) as Knowledge,row=d.prepare('select * from knowledge where id=?').get(x.id) as Record<string,unknown>|undefined,cur=row?toKnowledge(row):undefined;
   if(!cur){k.add++;if(apply)putKnowledge(d,x);}else if(cur.updated===x.updated||sameThing(cur,x))k.same++;else if(mode==='replace'||cur.updated<x.updated){k.update++;if(apply)putKnowledge(d,x);}else k.keep++;}
  for(const line of lines(files['brain/jobs.jsonl'])){const x=JSON.parse(line) as Job,cur=d.prepare('select data from jobs where id=?').get(x.id) as {data:string}|undefined,cu=cur?(JSON.parse(cur.data) as Job).updated:null;
   if(!cur){kj.add++;if(apply)putJob(d,x);}else if(cu===x.updated||sameThing(JSON.parse(cur.data) as Job,x))kj.same++;else if(mode==='replace'||(cu??'')<x.updated){kj.update++;if(apply)putJob(d,x);}else kj.keep++;}
  if(apply)d.exec('commit');
 }catch(e){if(apply)d.exec('rollback');throw e;}
 for(const line of lines(files['brain/videos.jsonl'])){const x=JSON.parse(line) as VideoRow,cur=d.prepare('select updated from videos where id=?').get(x.id) as {updated:string}|undefined;
  if(!cur){kv.add++;if(apply)putVideo(x);}else if(cur.updated===x.updated)kv.same++;else if(mode==='replace'||cur.updated<x.updated){kv.update++;if(apply)putVideo(x);}else kv.keep++;}
 if(apply&&(k.add+k.update+kj.add+kj.update+kv.add+kv.update))exportCommitted();
 // Taste profiles: merge adds the ones you do not have; yours stay as they are.
 const t=tally('Taste profiles');
 if(files['brain/taste.json']){const inc=(JSON.parse(strFromU8(files['brain/taste.json'])) as {profiles:{id:string}[]}).profiles;
  let mine:{id:string}[]=[];try{mine=(JSON.parse(fs.readFileSync(tasteFile(),'utf8')) as {profiles:{id:string}[]}).profiles;}catch{/* none yet */}
  const next=mode==='replace'?inc:[...mine];
  for(const p of inc){const has=mine.find(x=>x.id===p.id);if(!has){t.add++;if(mode!=='replace')next.push(p);}else if(JSON.stringify(has)===JSON.stringify(p))t.same++;else if(mode==='replace')t.update++;else t.keep++;}
  if(apply&&(t.add||t.update)){fs.mkdirSync(brainDir(),{recursive:true});fs.writeFileSync(tasteFile(),JSON.stringify({version:1,profiles:next},null,1)+'\n');}}
 // Your feedback rules: by id, the one seen more often (or more recently) wins.
 const r=tally('Your feedback rules');
 if(files['knowledge/memory.md']){const inc=parseLessons(strFromU8(files['knowledge/memory.md'])),md=read(memoryFile())?.toString('utf8')??'',mine=parseLessons(md);
  const merged=mode==='replace'?[...inc]:[...mine];
  for(const l of inc){const i=mine.findIndex(x=>x.id===l.id);if(i<0){r.add++;if(mode!=='replace')merged.push(l);}else if(JSON.stringify(mine[i])===JSON.stringify(l))r.same++;
   else if(mode==='replace'||l.count>mine[i]!.count||(l.count===mine[i]!.count&&l.date>mine[i]!.date)){r.update++;if(mode!=='replace')merged[merged.findIndex(x=>x.id===l.id)]=l;}else r.keep++;}
  if(apply&&(r.add||r.update)){fs.mkdirSync(path.dirname(memoryFile()),{recursive:true});fs.writeFileSync(memoryFile(),writeLessons(md||strFromU8(files['knowledge/memory.md']).split('## Learned from your feedback')[0]!,merged));}}
 if(files['knowledge/feedback.jsonl']&&apply){const have=new Set(lines(read(feedbackLog())??undefined));const add=lines(files['knowledge/feedback.jsonl']).filter(l=>!have.has(l));
  if(add.length){fs.mkdirSync(path.dirname(feedbackLog()),{recursive:true});fs.appendFileSync(feedbackLog(),(have.size&&!(read(feedbackLog())!.toString().endsWith('\n'))?'\n':'')+add.join('\n')+'\n');}}
 // Studio jobs: plans, ratings and events; a job here that is newer stays.
 const s=tally('Studio jobs and your ratings');
 const jobs=new Map<string,string[]>();for(const n of Object.keys(files).filter(n=>n.startsWith('studio/'))){const [,j]=n.split('/');jobs.set(j!,[...(jobs.get(j!)??[]),n]);}
 for(const [j,names] of jobs){const dir=path.join(studioRoot(),j),planFile=path.join(dir,'plan.json');
  const incUpdated=(()=>{try{return (JSON.parse(strFromU8(files[`studio/${j}/plan.json`]!)) as {updated:string}).updated;}catch{return '';}})();
  const curUpdated=(()=>{try{return (JSON.parse(fs.readFileSync(planFile,'utf8')) as {updated:string}).updated;}catch{return null;}})();
  const write=()=>{fs.mkdirSync(dir,{recursive:true});for(const n of names)fs.writeFileSync(path.join(dir,path.basename(n)),files[n]!);fs.rmSync(path.join(dir,'deleted-plan.json'),{force:true});};
  if(fs.existsSync(path.join(dir,'deleted-plan.json'))&&mode==='merge'){s.keep++;continue;} // you deleted it here: it stays deleted
  if(curUpdated===null&&!fs.existsSync(dir)){s.add++;if(apply)write();}else if(curUpdated===incUpdated)s.same++;else if(mode==='replace'||(curUpdated??'')<incUpdated){s.update++;if(apply)write();}else s.keep++;}
 // Thumbnails of taught videos.
 const th=tally('Thumbnails of taught videos');
 for(const n of Object.keys(files).filter(n=>n.startsWith('thumbs/'))){const f=path.join(thumbsDir(),path.basename(n));if(fs.existsSync(f)&&mode==='merge'){th.same++;continue;}th[fs.existsSync(f)?'update':'add']++;if(apply){fs.mkdirSync(thumbsDir(),{recursive:true});fs.writeFileSync(f,files[n]!);}}
 // The gallery's stars and ratings, and your settings: merge keeps yours when you have them.
 for(const [name,f,label] of [['local/gallery.json',galleryFile(),'Gallery stars and ratings'],['local/settings.json',settingsFile(),'Settings (no keys)'],['local/trends.json',path.join(settingsDir(),'trends.json'),'Trend watch topics and choices'],['local/history.json',path.join(settingsDir(),'history.json'),'The change history (Undo)']] as const){
  const p=tally(label);if(!files[name])continue;const exists=fs.existsSync(f);
  if(!exists){p.add++;if(apply){fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,files[name]!);}}
  else if(read(f)!.equals(Buffer.from(files[name]!)))p.same++;else if(mode==='replace'){p.update++;if(apply)fs.writeFileSync(f,files[name]!);}else p.keep++;}
 return out;
}
