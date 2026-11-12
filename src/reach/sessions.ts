// Site-scoped login reuse (Agent Reach runtime/session_reuse.py). The first time a site is
// used, its cookies (that site only) are copied once from the user's own Chrome, when that
// Chrome runs the OpenCLI extension. Passwords, other sites and the source browser are never
// read or changed. A login the user made in the Tempoloom window, or a logout, stops copying.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {ReachError} from './result.js';
import {load,mutate,now,withLock} from './state.js';
import {connectedContexts,loadBrowserState,ensureRunning,port,saveSession,ensureBridge} from './browser.js';
import {getCookies,setCookies,domainMatches,type Cookie} from './cdp.js';
import {opencliRoot,run} from './tools.js';

const sameSite:Record<string,Cookie['sameSite']>={no_restriction:'None',lax:'Lax',strict:'Strict',None:'None',Lax:'Lax',Strict:'Strict',unspecified:undefined as never};
export function normalizeCookies(rows:unknown[],domains:string[]):Cookie[]{
 const out:Cookie[]=[];
 for(const r of rows as Record<string,unknown>[]){
  if(!r||typeof r.name!=='string'||typeof r.value!=='string'||typeof r.domain!=='string')continue;
  if(!domains.some(d=>domainMatches(r.domain as string,d)))continue;
  const expires=Number(r.expires??r.expirationDate??-1);
  if(!Number.isFinite(expires)||(expires>0&&expires*1000<=Date.now()))continue;
  const c:Cookie={name:r.name,value:r.value,domain:r.domain,path:typeof r.path==='string'?r.path:'/',secure:!!r.secure,httpOnly:!!r.httpOnly,expires};
  const s=sameSite[String(r.sameSite)];if(s)c.sameSite=s;
  out.push(c);
 }
 return out;
}

/** The user's other browsers that run the OpenCLI extension (never the Tempoloom browser). */
export async function sourceProfiles(){
 const own=loadBrowserState().contextId;
 return (await connectedContexts()).filter(c=>c!==own);
}

async function exportSiteCookies(context:string,domain:string){
 const page=pathToFileURL(path.join(opencliRoot()!,'dist','src','browser','page.js')).href;
 const script=`import {Page} from ${JSON.stringify(page)};const p=new Page('tempoloom-site-session',undefined,process.argv[1]);console.log(JSON.stringify(await p.getCookies({domain:process.argv[2]})));`;
 try{return JSON.parse(await run(process.execPath,['--input-type=module','-e',script,context,domain],{timeout:20,label:'OpenCLI'})) as unknown[];}
 catch{throw new ReachError('NEED_SETUP','Your browser could not share this site\'s login');} // never echo upstream output: it may hold cookies
}

/** Copies one site's login from the user's Chrome into the Tempoloom browser, once. */
export async function prepare(channel:string,domains:string[],{force=false}:{force?:boolean}={}){
 return withLock('session:'+channel,120,async()=>{
  const record=load().sessions?.[channel];
  if(!force&&record&&(record.manual||record.blocked||record.copied>0))return record;
  await ensureBridge();
  const preferred=load().sourceProfile as string|undefined;
  let sources=await sourceProfiles().catch(()=>[] as string[]);
  if(preferred)sources=sources.filter(s=>s===preferred);
  const found:{context:string;cookies:Cookie[]}[]=[];
  for(const context of sources){
   try{const rows:unknown[]=[];for(const d of domains)rows.push(...await exportSiteCookies(context,d));const cookies=normalizeCookies(rows,domains);if(cookies.length)found.push({context,cookies});}
   catch{/* a disconnected source never blocks the saved Tempoloom login */}
  }
  if(found.length>1)throw new ReachError('NEED_SETUP','Several of your browsers are logged in to this site; choose which account to use',
   'Run pnpm tempoloom reach browser profiles, then pnpm tempoloom reach browser use ID. Nothing was copied.');
  if(!found.length){
   if(force)throw new ReachError('NEED_SETUP','No login for this site was found in your browser; nothing was copied',`Log in yourself: pnpm tempoloom reach login ${channel}`);
   const r={source:'none',copied:0,at:now()};await mutate(s=>{(s.sessions??={})[channel]=r;});return r;
  }
  await ensureRunning();
  const incoming=found[0]!.cookies;const key=(c:Cookie)=>`${c.name}|${c.domain}|${c.path??'/'}`;const keys=new Set(incoming.map(key));
  const stale=(await getCookies(port())).filter(c=>domains.some(d=>domainMatches(c.domain,d))&&!keys.has(key(c))).map(c=>({...c,value:'',expires:1}));
  await setCookies(port(),[...stale,...incoming]);
  await saveSession();
  const r={source:'your-browser',copied:incoming.length,at:now()};
  await mutate(s=>{(s.sessions??={})[channel]=r;});
  return r;
 });
}
export async function markManual(channel:string){await mutate(s=>{(s.sessions??={})[channel]={source:'manual',copied:0,at:now(),manual:true};});}
export async function markLoggedOut(channel:string){await mutate(s=>{(s.sessions??={})[channel]={source:'logged-out',copied:0,at:now(),blocked:true};});}
export async function useProfile(id:string){
 if(!(await sourceProfiles()).includes(id))throw new ReachError('BAD_INPUT','Choose a connected browser from: pnpm tempoloom reach browser profiles');
 await mutate(s=>{s.sourceProfile=id;for(const [k,v] of Object.entries(s.sessions??{}))if(!v.manual&&!v.blocked)delete s.sessions![k];});
 return {sourceProfile:id,scope:'each site only, when first used'};
}
