// Detached process that owns the Tempoloom browser (Agent Reach runtime/browser_watcher.py):
// launches it with the OpenCLI extension, restores the saved login, records the OpenCLI
// profile id, saves the login regularly, and closes after 10 minutes unused, on a stop
// request, or when the user closes the login window.
import fs from 'node:fs';
import {parseArgs} from 'node:util';
import {chromium,type BrowserContext} from 'playwright';
import {profileDir,extensionDir,updateBrowserState,lastUsed,touch,sessionPath,stopRequestPath,IDLE_SECONDS,savedCookies} from './browser.js';
import type {Cookie} from './cdp.js';

const {values:v}=parseArgs({options:{port:{type:'string'},executable:{type:'string'},url:{type:'string'},headed:{type:'boolean'}}});
const headless=!v.headed;
const log=(m:string)=>console.log(new Date().toISOString()+' '+m);

async function saveCookies(ctx:BrowserContext){
 const cookies=await ctx.cookies();
 const tmp=sessionPath()+'.tmp';fs.writeFileSync(tmp,JSON.stringify({cookies:cookies.map(c=>({...c}))}),{mode:0o600});fs.renameSync(tmp,sessionPath());
}

async function main(){
 const ext=extensionDir();
 fs.mkdirSync(profileDir(),{recursive:true});
 const ctx=await chromium.launchPersistentContext(profileDir(),{executablePath:v.executable,headless,channel:'chromium',
  viewport:headless?{width:1366,height:900}:null,
  args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`,'--remote-debugging-address=127.0.0.1',`--remote-debugging-port=${v.port}`,
   '--no-first-run','--no-default-browser-check']});
 updateBrowserState({pid:process.pid,port:Number(v.port),headless});
 log(`browser open (${headless?'hidden':'window'})`);
 // Restore the saved login (cookies missing from the profile only).
 const saved=savedCookies().filter(c=>c.name&&c.domain&&(c.expires===undefined||c.expires<=0||c.expires*1000>Date.now()));
 if(saved.length){
  const have=new Set((await ctx.cookies()).map(c=>`${c.name}|${c.domain}|${c.path}`));
  const missing=saved.filter(c=>!have.has(`${c.name}|${c.domain}|${c.path??'/'}`)).map(c=>({...c,path:c.path??'/',expires:c.expires??-1})) as (Cookie&{path:string;expires:number})[];
  if(missing.length)await ctx.addCookies(missing).catch(e=>log('restore failed: '+e));
  log(`restored ${missing.length} saved cookies`);
 }
 // The OpenCLI extension stores its profile id in chrome.storage.local.
 let worker=ctx.serviceWorkers().find(w=>w.url().startsWith('chrome-extension://'));
 if(!worker)worker=await ctx.waitForEvent('serviceworker',{timeout:30000}).catch(()=>undefined);
 for(let i=0;i<60&&worker;i++){
  const id=await worker.evaluate(()=>(globalThis as unknown as {chrome:{storage:{local:{get:(k:string)=>Promise<Record<string,string>>}}}}).chrome.storage.local.get('opencli_context_id_v1').then(r=>r.opencli_context_id_v1||null)).catch(()=>null);
  if(id){updateBrowserState({contextId:id});log('opencli profile '+id);break;}
  await new Promise(r=>setTimeout(r,500));
 }
 if(v.url&&v.url!=='about:blank'){const page=ctx.pages()[0]??await ctx.newPage();await page.goto(v.url).catch(e=>log('open failed: '+e));}
 touch();
 let closing=false;
 const close=async(reason:string)=>{
  if(closing)return;closing=true;log('closing: '+reason);
  await saveCookies(ctx).catch(()=>undefined);
  await ctx.close().catch(()=>undefined);
  updateBrowserState({pid:null,contextId:null});
  fs.rmSync(stopRequestPath(),{force:true});
  process.exit(0);
 };
 ctx.on('close',()=>{if(!closing){closing=true;updateBrowserState({pid:null,contextId:null});process.exit(0);}});
 let ticks=0;
 setInterval(async()=>{
  ticks++;
  if(fs.existsSync(stopRequestPath()))return close('stop requested');
  if(!headless&&ctx.pages().length===0)return close('login window closed');
  const limit=headless?IDLE_SECONDS:Math.max(IDLE_SECONDS,1800); // a login window gets 30 minutes
  if(Date.now()-lastUsed()>limit*1000)return close('unused for '+limit+' s');
  if(ticks%30===0)await saveCookies(ctx).catch(()=>undefined);
 },1000);
 for(const sig of ['SIGTERM','SIGINT'] as const)process.on(sig,()=>void close(sig));
}
main().catch(e=>{log('failed: '+(e as Error).message);updateBrowserState({pid:null,contextId:null});process.exit(1);});
