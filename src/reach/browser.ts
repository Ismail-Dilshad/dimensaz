// The Tempoloom browser (Agent Reach runtime/browser.py + bridge.py): one dedicated profile in
// .tempoloom/reach/browser shared by all browser channels, separate from the user's own Chrome.
// Engine: Playwright Chromium (loads the OpenCLI extension on every OS), or CloakBrowser when
// chosen. Runs hidden, closes itself after 10 minutes unused, shows a window only to log in.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {unzipSync} from 'fflate';
import {chromium} from 'playwright';
import {ROOT} from '../engine/config.js';
import {ReachError} from './result.js';
import {reachRoot,withLock} from './state.js';
import {EXTENSION,BRIDGE_PORT,opencliMain,opencliVersion,opencliRoot,run,pythonPath} from './tools.js';
import {cdpJson,getCookies,setCookies,domainMatches,type Cookie} from './cdp.js';

export const IDLE_SECONDS=Number(process.env.TEMPOLOOM_REACH_IDLE||600);
export const START_WAIT=90;
export const browserRoot=()=>path.join(reachRoot(),'browser');
export const profileDir=()=>path.join(browserRoot(),'profile');
export const extensionDir=()=>path.join(browserRoot(),'extension');
const statePath=()=>path.join(browserRoot(),'state.json');
const lastUsedPath=()=>path.join(browserRoot(),'last_used');
export const sessionPath=()=>path.join(browserRoot(),'session.json');
export const stopRequestPath=()=>path.join(browserRoot(),'stop.request');
export const hostLogPath=()=>path.join(browserRoot(),'host.log');
export const port=()=>{const p=Number(process.env.TEMPOLOOM_REACH_PORT||loadBrowserState().port||9333);return p>=1024&&p<=65535?p:9333;};

export type BrowserState={pid?:number;port?:number;headless?:boolean;engine?:'chromium'|'cloak';executable?:string;contextId?:string;startedAt?:number;cloakExecutable?:string;sessionSaved?:string};
export function loadBrowserState():BrowserState{try{return JSON.parse(fs.readFileSync(statePath(),'utf8'));}catch{return {};}}
export function updateBrowserState(changes:Partial<Record<keyof BrowserState,unknown>>){
 const s={...loadBrowserState()} as Record<string,unknown>;
 for(const [k,v] of Object.entries(changes)){if(v===null||v===undefined)delete s[k];else s[k]=v;}
 fs.mkdirSync(browserRoot(),{recursive:true});
 const tmp=statePath()+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(s,null,1),{mode:0o600});fs.renameSync(tmp,statePath());
}
export function touch(){fs.mkdirSync(browserRoot(),{recursive:true});const f=lastUsedPath();try{fs.utimesSync(f,new Date(),new Date());}catch{fs.writeFileSync(f,'',{mode:0o600});}}
export function lastUsed(){try{return fs.statSync(lastUsedPath()).mtimeMs;}catch{return 0;}}

const alive=(pid?:number)=>{if(!pid)return false;try{process.kill(pid,0);return true;}catch(e){return (e as {code?:string}).code==='EPERM';}};
const portOpen=(p:number)=>new Promise<boolean>(res=>{const s=net.connect(p,'127.0.0.1');s.setTimeout(800);s.once('connect',()=>{s.destroy();res(true);});s.once('error',()=>res(false));s.once('timeout',()=>{s.destroy();res(false);});});
export async function isRunning(){const s=loadBrowserState();return alive(s.pid)&&await portOpen(port());}
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function waitFor(check:()=>Promise<boolean>|boolean,seconds:number,interval=300){
 const end=Date.now()+seconds*1000;for(;;){if(await check())return true;if(Date.now()>=end)return false;await sleep(interval);}
}

// ---------- engine ----------
/** A full Playwright Chromium build (not the headless shell, which cannot load extensions). */
export function fullChromium(){
 if(process.env.TEMPOLOOM_REACH_CHROMIUM&&fs.existsSync(process.env.TEMPOLOOM_REACH_CHROMIUM))return process.env.TEMPOLOOM_REACH_CHROMIUM;
 const expected=chromium.executablePath();
 if(fs.existsSync(expected)&&!/headless/i.test(expected))return expected;
 const bases=[process.env.PLAYWRIGHT_BROWSERS_PATH,path.dirname(path.dirname(path.dirname(expected))),
  process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'ms-playwright'),path.join(os.homedir(),'AppData','Local','ms-playwright'),
  path.join(os.homedir(),'.cache','ms-playwright'),path.join(os.homedir(),'Library','Caches','ms-playwright')].filter((p):p is string=>!!p&&p!=='0');
 for(const base of new Set(bases)){
  if(!fs.existsSync(base))continue;
  const builds=fs.readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]));
  for(const b of builds)for(const rel of ['chrome-win64/chrome.exe','chrome-win/chrome.exe','chrome-linux64/chrome','chrome-linux/chrome',
   'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium','chrome-mac/Chromium.app/Contents/MacOS/Chromium',
   'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing','chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing']){
   const f=path.join(base,b,rel);if(fs.existsSync(f))return f;
  }
 }
 return null;
}
/** Chosen engine executable: CloakBrowser when selected and installed, else Playwright Chromium. */
export function engineExecutable(){
 const s=loadBrowserState();
 if(s.engine==='cloak'&&s.cloakExecutable&&fs.existsSync(s.cloakExecutable))return {engine:'cloak' as const,executable:s.cloakExecutable};
 const c=fullChromium();
 if(!c)throw new ReachError('NEED_SETUP','The full Chromium browser is not installed','Run: pnpm exec playwright install chromium (about 150 MB, once).');
 return {engine:'chromium' as const,executable:c};
}
/** Optional CloakBrowser engine (Agent Reach's preferred engine), installed into .venv. */
export async function installCloak(){
 await run(pythonPath(),['-m','pip','install','--disable-pip-version-check','cloakbrowser==0.6.3'],{timeout:600,label:'pip'});
 const env={CLOAKBROWSER_AUTO_UPDATE:'false',CLOAKBROWSER_CACHE_DIR:path.join(reachRoot(),'cloak-binaries')};
 await run(pythonPath(),['-m','cloakbrowser','install'],{timeout:900,env,label:'cloakbrowser'}).catch(()=>undefined);
 const out=await run(pythonPath(),['-c','import json;from cloakbrowser.config import get_binary_path;print(json.dumps({"executable":str(get_binary_path()),"version":"0.6.3"}))'],{timeout:60,env,label:'cloakbrowser'});
 const r=JSON.parse(out) as {executable:string;version:string};
 if(!fs.existsSync(r.executable))throw new ReachError('NEED_SETUP','CloakBrowser downloaded no browser; Playwright Chromium stays in use');
 return r;
}

// ---------- OpenCLI extension ----------
export function extensionVersion(){try{return JSON.parse(fs.readFileSync(path.join(extensionDir(),'manifest.json'),'utf8')).version as string;}catch{return null;}}
/** Downloads the pinned OpenCLI extension once and checks its hash. */
export async function ensureExtension({fetcher=fetch}:{fetcher?:typeof fetch}={}){
 if(extensionVersion()===EXTENSION.version)return {version:EXTENSION.version,updated:false};
 const r=await fetcher(EXTENSION.url,{redirect:'follow',signal:AbortSignal.timeout(60000)}).catch(e=>{throw new ReachError('NEED_SETUP','Could not download the OpenCLI extension: '+(e as Error).message);});
 if(!r.ok)throw new ReachError('NEED_SETUP',`Could not download the OpenCLI extension (HTTP ${r.status})`);
 const bytes=new Uint8Array(await r.arrayBuffer());
 if(createHash('sha256').update(bytes).digest('hex')!==EXTENSION.sha256)throw new ReachError('NEED_SETUP','The downloaded OpenCLI extension does not match the tested file; nothing was installed');
 const files=unzipSync(bytes);
 const tmp=extensionDir()+'.new';await fsp.rm(tmp,{recursive:true,force:true});
 for(const [name,data] of Object.entries(files)){
  if(name.endsWith('/'))continue;
  const target=path.resolve(tmp,name);
  if(!target.startsWith(path.resolve(tmp)+path.sep))throw new ReachError('NEED_SETUP','Unsafe path in the extension archive');
  await fsp.mkdir(path.dirname(target),{recursive:true});await fsp.writeFile(target,data);
 }
 if(!fs.existsSync(path.join(tmp,'manifest.json')))throw new ReachError('NEED_SETUP','The extension archive has no manifest.json');
 if(await isRunning())await stop();
 await fsp.rm(extensionDir(),{recursive:true,force:true});await fsp.rename(tmp,extensionDir());
 return {version:extensionVersion(),updated:true};
}

// ---------- OpenCLI bridge (daemon) ----------
export type BridgeStatus={ok?:boolean;daemonVersion?:string;pid?:number;profiles?:{contextId:string;extensionConnected:boolean}[]};
export async function bridgeStatus():Promise<BridgeStatus>{
 try{const r=await fetch(`http://127.0.0.1:${BRIDGE_PORT}/status`,{headers:{'X-OpenCLI':'1'},signal:AbortSignal.timeout(1500)});const v=await r.json() as BridgeStatus;return v?.ok?v:{};}catch{return {};}
}
/** Starts the OpenCLI bridge if none runs; never touches a bridge of another version. */
export async function ensureBridge(){
 let s=await bridgeStatus();
 const version=opencliVersion();
 if(s.ok&&s.daemonVersion&&version&&s.daemonVersion!==version)throw new ReachError('NEED_SETUP',`An OpenCLI bridge of version ${s.daemonVersion} is running (Tempoloom uses ${version}); it was left unchanged`,'Close that OpenCLI (opencli daemon stop, or quit OpenCLIApp), then retry.');
 if(s.ok)return s;
 opencliMain();
 const daemon=path.join(opencliRoot()!,'dist','src','daemon.js');
 const child=spawn(process.execPath,[daemon],{detached:true,stdio:'ignore',windowsHide:true,env:{...process.env,OPENCLI_DAEMON_PORT:String(BRIDGE_PORT)}});child.unref();
 if(!await waitFor(async()=>!!(s=await bridgeStatus()).ok,15))throw new ReachError('NEED_SETUP','The OpenCLI bridge did not start');
 return s;
}
export async function connectedContexts(){return ((await bridgeStatus()).profiles??[]).filter(p=>p.extensionConnected).map(p=>p.contextId);}

// ---------- lifecycle ----------
const hostScript=()=>path.join(path.dirname(fileURLToPath(import.meta.url)),'browser-host.ts');

async function launch(headless:boolean,url:string){
 const {engine,executable}=engineExecutable();
 await ensureExtension();
 await fsp.rm(stopRequestPath(),{force:true});
 updateBrowserState({headless,engine,executable,contextId:null,pid:null,port:port(),startedAt:Date.now()});
 fs.mkdirSync(browserRoot(),{recursive:true});
 const log=fs.openSync(hostLogPath(),'w');
 const child=spawn(process.execPath,['--import','tsx',hostScript(),'--port',String(port()),'--executable',executable,'--url',url,...(headless?[]:['--headed'])],
  {cwd:ROOT,detached:true,stdio:['ignore',log,log],windowsHide:true,env:{...process.env,TEMPOLOOM_REACH_HOME:reachRoot()}});
 child.unref();fs.closeSync(log);
 if(!await waitFor(async()=>(await isRunning())||child.exitCode!==null,START_WAIT)||!await isRunning()){
  const tail=(()=>{try{return fs.readFileSync(hostLogPath(),'utf8').trim().split('\n').slice(-2).join(' ').slice(0,300);}catch{return '';}})();
  throw new ReachError('UPSTREAM_BROKEN','The Tempoloom browser did not open'+(tail?': '+tail:''));
 }
}

/** Opens (or reuses) the hidden browser and waits until OpenCLI is connected to it. */
export async function ensureRunning({headed=false,url='about:blank'}:{headed?:boolean;url?:string}={}){
 touch();
 await ensureBridge();
 await withLock('browser-start',START_WAIT+30,async()=>{
  const s=loadBrowserState();
  if(await isRunning()){
   if(headed&&s.headless){await stop();await launch(false,url);}
   else if(headed)await cdpJson(port(),'/json/new?'+encodeURIComponent(url)).catch(()=>null);
  }else await launch(!headed,url);
 });
 const ok=await waitFor(async()=>{const id=loadBrowserState().contextId;return !!id&&(await connectedContexts()).includes(id);},START_WAIT);
 if(!ok)throw new ReachError('UPSTREAM_BROKEN','The OpenCLI extension did not connect in the Tempoloom browser',`Details: ${hostLogPath()}. Run pnpm tempoloom reach doctor.`);
 touch();
 return loadBrowserState();
}

/** Closes the browser (its login is saved first). */
export async function stop(){
 if(!await isRunning())return true;
 await saveSession().catch(()=>undefined);
 fs.mkdirSync(browserRoot(),{recursive:true});fs.writeFileSync(stopRequestPath(),String(Date.now()));
 if(await waitFor(async()=>!await isRunning(),20))return true;
 const pid=loadBrowserState().pid;if(pid)try{process.kill(pid);}catch{/* gone */}
 return waitFor(async()=>!await isRunning(),5);
}

// ---------- saved login (cookies) ----------
export async function saveSession(){
 const cookies=await getCookies(port());
 fs.mkdirSync(browserRoot(),{recursive:true});
 const tmp=sessionPath()+'.tmp';fs.writeFileSync(tmp,JSON.stringify({cookies}),{mode:0o600});fs.renameSync(tmp,sessionPath());
 return cookies.length;
}
export function savedCookies():Cookie[]{try{return (JSON.parse(fs.readFileSync(sessionPath(),'utf8')).cookies??[]) as Cookie[];}catch{return [];}}
/** Removes one site's login from the dedicated browser and from the saved copy. */
export async function clearSite(domains:string[]){
 let removed=0;
 if(await isRunning()){
  const doomed=(await getCookies(port())).filter(c=>domains.some(d=>domainMatches(c.domain,d)));
  await setCookies(port(),doomed.map(c=>({name:c.name,value:'',domain:c.domain,path:c.path,secure:c.secure,httpOnly:c.httpOnly,sameSite:c.sameSite,expires:1})));
  removed=doomed.length;await saveSession();
 }else{
  const all=savedCookies(),keep=all.filter(c=>!domains.some(d=>domainMatches(c.domain,d)));removed=all.length-keep.length;
  if(fs.existsSync(sessionPath()))fs.writeFileSync(sessionPath(),JSON.stringify({cookies:keep}),{mode:0o600});
 }
 return removed;
}
export async function hasLoginCookie(domains:string[],names:string[]){
 const cookies=await isRunning()?await getCookies(port()):savedCookies();
 return cookies.some(c=>domains.some(d=>domainMatches(c.domain,d))&&(!names.length||names.includes(c.name))&&(c.expires===undefined||c.expires<=0||c.expires*1000>Date.now()));
}

export async function status(){
 const s=loadBrowserState(),running=await isRunning();
 let engine:{engine:string;executable:string}|{error:string};try{engine=engineExecutable();}catch(e){engine={error:(e as Error).message};}
 const contexts=running?await connectedContexts():[];
 return {profile:profileDir(),...engine,extension:extensionVersion(),running,headless:running?s.headless:null,
  opencliConnected:running&&!!s.contextId&&contexts.includes(s.contextId),idleCloseAfterSeconds:IDLE_SECONDS,port:port(),savedLogins:new Set(savedCookies().map(c=>c.domain.replace(/^\./,'').split('.').slice(-2).join('.'))).size};
}
