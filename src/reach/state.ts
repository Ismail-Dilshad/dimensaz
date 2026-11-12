// Reach's small memory file and cross-process locks (Agent Reach runtime/state.py and
// browser_binding.py). The state keeps only health, pauses, rate limits, added channels and
// session records: never queries, results or cookies.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT} from '../engine/config.js';
import {ReachError} from './result.js';

export const reachRoot=()=>path.resolve(process.env.TEMPOLOOM_REACH_HOME||path.join(ROOT,'.tempoloom','reach'));
const statePath=()=>path.join(reachRoot(),'state.json');
export type State={added?:Record<string,{at:string}>;cooldowns?:Record<string,{code:string;at:string;message?:string}>;
 backendHealth?:Record<string,Record<string,Record<string,{code:string;at:string}>>>;requestStarts?:Record<string,number>;
 sessions?:Record<string,{source:string;copied:number;at:string;manual?:boolean;blocked?:boolean}>;removed?:Record<string,string>;[k:string]:unknown};

export const now=()=>new Date().toISOString();
export const ageSeconds=(iso?:string|number)=>{if(iso===undefined)return Infinity;const t=typeof iso==='number'?iso:Date.parse(iso);return Number.isFinite(t)?(Date.now()-t)/1000:Infinity;};

export function load():State{
 try{return JSON.parse(fs.readFileSync(statePath(),'utf8')) as State;}catch{return {};}
}
/** Read-modify-write under the state lock. */
export async function mutate(change:(s:State)=>void){
 return withLock('state',10,async()=>{
  const s=load();change(s);
  await fsp.mkdir(reachRoot(),{recursive:true});
  const tmp=statePath()+'.'+process.pid+'.tmp';
  await fsp.writeFile(tmp,JSON.stringify(s,null,1),{mode:0o600});
  await fsp.rename(tmp,statePath());
  return s;
 });
}

// ---------- locks ----------
const lockDir=()=>path.join(reachRoot(),'locks');
const lockFile=(name:string)=>path.join(lockDir(),createHash('sha256').update(name).digest('hex').slice(0,24)+'.lock');
const STALE_MS=15*60*1000;
const alive=(pid:number)=>{try{process.kill(pid,0);return true;}catch(e){return (e as {code?:string}).code==='EPERM';}};

/** Takes the lock now or returns null. Stale locks (dead process, or older than 15 minutes) are taken over. */
export function tryLock(name:string):(()=>void)|null{
 fs.mkdirSync(lockDir(),{recursive:true});
 const file=lockFile(name);
 for(let i=0;i<2;i++){
  try{
   const fd=fs.openSync(file,'wx',0o600);fs.writeSync(fd,JSON.stringify({pid:process.pid,at:Date.now(),name}));fs.closeSync(fd);
   let released=false;
   return ()=>{if(!released){released=true;try{fs.unlinkSync(file);}catch{/* gone */}}};
  }catch(e){
   if((e as {code?:string}).code!=='EEXIST')throw e;
   try{const held=JSON.parse(fs.readFileSync(file,'utf8')) as {pid:number;at:number};
    if(!alive(held.pid)||Date.now()-held.at>STALE_MS){fs.unlinkSync(file);continue;}}catch{try{fs.unlinkSync(file);}catch{/* raced */}continue;}
   return null;
  }
 }
 return null;
}
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

/** Waits up to `waitSeconds` for any one of `names`; BUSY after that. */
export async function acquireAny(names:string[],waitSeconds:number,message:string){
 const deadline=Date.now()+waitSeconds*1000;
 for(;;){
  for(const n of names){const r=tryLock(n);if(r)return r;}
  if(Date.now()>=deadline)throw new ReachError('BUSY',message,'The shared browser stayed full while this command waited in line; retry in a minute. Do not switch accounts or browsers.');
  await sleep(200);
 }
}
export async function withLock<T>(name:string,waitSeconds:number,fn:()=>Promise<T>):Promise<T>{
 const release=await acquireAny([name],waitSeconds,'Waited too long for '+name);
 try{return await fn();}finally{release();}
}

export const SITE_SLOTS=2,BROWSER_SLOTS=4,QUEUE_WAIT=120;
/** At most 2 browser commands per site and 4 overall run at once; others queue up to 2 minutes. */
export async function querySlot(channel:string,waitSeconds=QUEUE_WAIT){
 const site=await acquireAny(Array.from({length:SITE_SLOTS},(_,i)=>`site:${channel}:${i}`),waitSeconds,`Too many ${channel} requests are running`);
 try{
  const all=await acquireAny(Array.from({length:BROWSER_SLOTS},(_,i)=>`browser:${i}`),waitSeconds,'The shared browser is full');
  return ()=>{all();site();};
 }catch(e){site();throw e;}
}
