// Runs one unified action (Agent Reach runtime/dispatch.py): validates arguments, honours
// rate-limit pauses, tries the public web first for sites not set up yet, waits for a browser
// slot, paces searches, then tries backends in order with fallback on recoverable errors.
import {ReachError,FINAL_CODES,classify,envelope,type Attempt,type Code,type Item,type Envelope} from './result.js';
import {load,mutate,ageSeconds,now,querySlot,withLock} from './state.js';
import {channelByName,type Action,type Channel} from './channels.js';
import {exaSearch,jinaRead} from './backends/web.js';
import {opencliVersion} from './tools.js';

export const DEFAULT_TIMEOUT=45;
export const SEARCH_INTERVAL=Number(process.env.DIMENSAZ_REACH_SEARCH_INTERVAL??10);
export const BACKEND_PAUSE:Partial<Record<Code,number>>={TIMEOUT:60,UPSTREAM_BROKEN:120,NEED_SETUP:60};
export const RATE_LIMIT_SECONDS=3600;
const PUBLIC_MAX=20;

export function validate(action:Action,params:Record<string,unknown>){
 const clean:Record<string,unknown>={};
 for(const p of action.params){
  let v=params[p.name];if(typeof v==='string')v=v.trim();
  if(v===undefined||v===null||v===''){if(p.required)throw new ReachError('BAD_INPUT','missing required argument: '+p.name);v=p.default;}
  else if(p.type==='int'){const n=Number(v);if(!Number.isInteger(n))throw new ReachError('BAD_INPUT',`${p.name} must be a whole number`);v=n;
   if(p.name==='limit'&&(n<1||n>100))throw new ReachError('BAD_INPUT','limit must be between 1 and 100');}
  else if(p.type==='bool')v=v===true||v==='true'||v==='1';
  else v=String(v);
  clean[p.name]=v;
 }
 const unknown=Object.keys(params).filter(k=>!action.params.some(p=>p.name===k));
 if(unknown.length)throw new ReachError('BAD_INPUT','unknown argument(s): '+unknown.join(', '));
 return clean;
}

export function cooldown(channel:string){
 const f=load().cooldowns?.[channel];if(!f)return null;
 const left=RATE_LIMIT_SECONDS-ageSeconds(f.at);
 return left>0?{message:f.message??'Rate limited',retryAfter:Math.max(1,Math.round(left))}:null;
}
const fingerprint=()=>opencliVersion()??'none';
function backendPause(channel:string,action:string,backend:string){
 const h=load().backendHealth?.[channel]?.[action]?.[backend] as {code:Code;at:string;fingerprint?:string}|undefined;
 if(!h||h.fingerprint!==fingerprint())return null;
 const left=(BACKEND_PAUSE[h.code]??0)-ageSeconds(h.at);
 return left>0?{code:h.code,retryAfter:Math.max(1,Math.round(left))}:null;
}
async function remember(channel:string,action:string,backend:string,error:ReachError|null){
 await mutate(s=>{
  const h=((s.backendHealth??={})[channel]??={})[action]??={};
  if(!error)delete h[backend];
  else if(BACKEND_PAUSE[error.code])(h as Record<string,unknown>)[backend]={code:error.code,at:now(),fingerprint:fingerprint()}; // diagnostics only: no query, result or cookie
  if(error?.code==='RATE_LIMITED')(s.cooldowns??={})[channel]={code:'RATE_LIMITED',at:now(),message:'Platform reported a rate limit'};
 });
}
async function pace(channel:string,action:string,budget:()=>number){
 if(!['search','explore','trending'].includes(action)||SEARCH_INTERVAL<=0)return;
 await withLock('pace:'+channel,Math.max(1,budget()),async()=>{
  const last=load().requestStarts?.[channel];const wait=SEARCH_INTERVAL-(last?(Date.now()-last)/1000:Infinity);
  if(wait>0){if(wait>=budget())throw new ReachError('TIMEOUT','Search spacing is longer than the time left; retry shortly');await new Promise(r=>setTimeout(r,wait*1000));}
  await mutate(s=>{(s.requestStarts??={})[channel]=Date.now();});
 });
}
async function withDeadline<T>(fn:()=>Promise<T>,seconds:number){
 let timer:NodeJS.Timeout|undefined;
 try{return await Promise.race([fn(),new Promise<never>((_,rej)=>{timer=setTimeout(()=>rej(new ReachError('TIMEOUT',`did not answer within ${Math.round(seconds)} s`)),Math.max(1,seconds)*1000);})]);}
 finally{clearTimeout(timer);}
}
export const isAdded=(c:Channel)=>!c.loginUrl||!!load().added?.[c.name];

/** Public route: a scoped web search for searches, or the page text for links. */
async function publicAttempt(c:Channel,a:Action,p:Record<string,any>,timeout:number):Promise<{items:Item[];attempt:Attempt}|{error:ReachError;attempt:Attempt}|null>{
 if(!a.publicWeb?.length)return null;
 try{
  let items:Item[];
  if(typeof p.query==='string')items=await exaSearch({query:`(${p.query}) (${a.publicWeb.map(s=>'site:'+s).join(' OR ')})`,limit:p.limit??5,timeout});
  else if(typeof p.target==='string')items=await jinaRead({target:p.target,timeout});
  else return null;
  items=items.filter(i=>(i.text??'').trim().length>=40||i.url);
  if(!items.length)throw new ReachError('NOT_FOUND','The public web had nothing usable');
  return {items,attempt:{backend:'public-web',result:'ok'}};
 }catch(e){const err=classify(e);return {error:err,attempt:{backend:'public-web',result:err.code,message:err.message}};}
}

export type RunOptions={timeout?:number;onlyBackend?:string;prepareSession?:(c:Channel)=>Promise<unknown>;loggedOut?:(c:Channel)=>Promise<boolean>};
export async function runAction(channelName:string,actionName:string,params:Record<string,unknown>,o:RunOptions={}):Promise<Envelope>{
 const started=Date.now();const elapsed=()=>Date.now()-started;
 let channel:Channel,action:Action,clean:Record<string,unknown>;
 try{
  channel=channelByName(channelName);
  const a=channel.actions.find(x=>x.name===actionName);
  if(!a)throw new ReachError('BAD_INPUT',`unknown action "${actionName}" for ${channel.name}; valid: ${channel.actions.map(x=>x.name).join(', ')}`);
  action=a;clean=validate(action,params);
 }catch(e){return envelope({channel:channelName,action:actionName,elapsedMs:elapsed(),error:classify(e)});}
 const total=o.timeout??action.timeout??DEFAULT_TIMEOUT;
 const left=()=>total-(Date.now()-started)/1000;
 const attempts:Attempt[]=[],errors:ReachError[]=[];
 const publicNote='Public web result: page text or search hits, not data from a logged-in account; completeness is not verified.';
 const backends=action.backends.filter(([label])=>!o.onlyBackend||o.onlyBackend===label);
 if(!backends.length&&o.onlyBackend!=='public-web')return envelope({channel:channel.name,action:action.name,elapsedMs:elapsed(),error:new ReachError('BAD_INPUT',`no backend named "${o.onlyBackend}"`)});
 try{
  const limited=cooldown(channel.name);
  if(limited)throw new ReachError('RATE_LIMITED',limited.message,`Wait ${limited.retryAfter} seconds before using ${channel.name} again.`,limited.retryAfter);
  if(action.publicWeb&&((!o.onlyBackend&&!isAdded(channel))||o.onlyBackend==='public-web')){
   const r=await publicAttempt(channel,action,clean,o.onlyBackend?left():Math.min(PUBLIC_MAX,left()/2));
   if(r){attempts.push(r.attempt);
    if('items' in r)return envelope({channel:channel.name,action:action.name,backend:'public-web',items:r.items,elapsedMs:elapsed(),attempts,note:publicNote});
    if(o.onlyBackend)throw r.error;}
  }
  const release=action.browser?await querySlot(channel.name,Math.min(120,Math.max(1,left()))):()=>{};
  try{
   if(action.browser&&o.prepareSession&&channel.loginUrl)await o.prepareSession(channel).catch(e=>{const err=classify(e);if(err.code!=='NEED_SETUP')throw err;attempts.push({backend:'session',result:err.code,message:err.message});});
   let paced=false;
   for(const [label,fn] of backends){
    const paused=o.onlyBackend?null:backendPause(channel.name,action.name,label);
    if(paused){attempts.push({backend:label,result:paused.code,skipped:true,retry_after_seconds:paused.retryAfter});errors.push(new ReachError(paused.code,`${label} is paused after ${paused.code}; retry later`));continue;}
    if(left()<=0){attempts.push({backend:label,result:'TIMEOUT'});errors.push(new ReachError('TIMEOUT','no time left for this backend'));break;}
    if(action.browser&&label==='opencli'&&!paced){await pace(channel.name,action.name,left);paced=true;}
    try{
     const items=await withDeadline(()=>fn(clean,{timeout:Math.max(1,left()),channel}),left()+1);
     attempts.push({backend:label,result:'ok'});await remember(channel.name,action.name,label,null);
     return envelope({channel:channel.name,action:action.name,backend:label,items,elapsedMs:elapsed(),attempts});
    }catch(e){
     let err=classify(e);
     if(label==='opencli'&&channel.loginUrl&&['UPSTREAM_BROKEN','NOT_FOUND'].includes(err.code)&&o.loggedOut&&await o.loggedOut(channel).catch(()=>false))
      err=new ReachError('NEED_LOGIN',`Not logged in to ${channel.domains[0]}`,`Run pnpm dimensaz reach login ${channel.name} and ask the user to log in in the window it opens. Never log in for them.`);
     if(label==='opencli'&&channel.loginUrl&&err.code==='UPSTREAM_BROKEN'&&!err.hint)err.hint=`If this repeats, log in again inside the Dimensaz window: pnpm dimensaz reach login ${channel.name} (sites can reject a login copied from another browser).`;
     attempts.push({backend:label,result:err.code,message:err.message});errors.push(err);
     await remember(channel.name,action.name,label,err);
     if(FINAL_CODES.has(err.code))break;
    }
   }
  }finally{release();}
  // Last resort for transient failures: the public web route, once.
  if(action.publicWeb&&!o.onlyBackend&&errors.length&&!errors.some(e=>FINAL_CODES.has(e.code))&&errors.some(e=>['UPSTREAM_BROKEN','TIMEOUT'].includes(e.code))&&left()>0){
   const r=await publicAttempt(channel,action,clean,left());
   if(r){attempts.push(r.attempt);if('items' in r)return envelope({channel:channel.name,action:action.name,backend:'public-web',items:r.items,elapsedMs:elapsed(),attempts,note:publicNote});}
  }
 }catch(e){errors.push(classify(e));}
 const final=errors.find(e=>FINAL_CODES.has(e.code))??errors.find(e=>e.code!=='NEED_SETUP')??errors[0]??new ReachError('UPSTREAM_BROKEN','no backend answered');
 return envelope({channel:channel.name,action:action.name,elapsedMs:elapsed(),attempts,error:final});
}
