// Managing Reach (Agent Reach runtime/manage.py): add/remove channels, logins, doctor, live
// checks, update, uninstall, and study-only reference downloads. Everything installs itself;
// the only human steps are logging in and confirming downloads or deletions.
import fs from 'node:fs/promises';
import path from 'node:path';
import {ReachError,classify} from './result.js';
import {load,mutate,now,reachRoot} from './state.js';
import {channels,channelByName,routeUrl,type Channel} from './channels.js';
import {runAction,isAdded} from './dispatch.js';
import * as browser from './browser.js';
import * as sessions from './sessions.js';
import {OPENCLI_VERSION,opencliVersion,ensureYtdlp,ytdlpVersion,EXTENSION,YTDLP_VERSION} from './tools.js';
import {videoInfo,downloadVideo} from './backends/ytdlp.js';
import {callOpencli} from './backends/opencli.js';
import {downloadsRoot} from '../engine/sourcing/core.js';

export const prepareSession=(c:Channel)=>sessions.prepare(c.name,c.domains);
export const loggedOut=async(c:Channel)=>!await browser.hasLoginCookie(c.domains,c.loginCookies??[]);
export const run=(channel:string,action:string,params:Record<string,unknown>,timeout?:number,onlyBackend?:string)=>
 runAction(channel,action,params,{timeout,onlyBackend,prepareSession,loggedOut});

export async function list(){
 const saved=browser.savedCookies();
 return channels.map(c=>({channel:c.name,level:c.level,description:c.description,added:isAdded(c),
  login:c.loginUrl?(saved.some(k=>c.domains.some(d=>k.domain.replace(/^\./,'').endsWith(d))&&(!c.loginCookies?.length||c.loginCookies.includes(k.name)))?'logged in':'not logged in'):'not needed',
  actions:c.actions.map(a=>`${a.name}${a.params.map(p=>p.required?` <${p.name}>`:` [--${p.name}${p.default!==undefined&&p.default!==''?' '+p.default:''}]`).join('')}: ${a.help}`)}));
}

/** Installs what a channel needs, opens the browser, and copies the site's login if found. */
export async function add(names:string[]){
 const out=[];
 for(const name of names){
  const c=channelByName(name);
  try{
   if(c.actions.some(a=>a.backends.some(([l])=>l==='yt-dlp')))await ensureYtdlp();
   if(c.loginUrl){
    await browser.ensureRunning();
    const s=await sessions.prepare(c.name,c.domains).catch(e=>({source:'error',copied:0,message:classify(e).message}));
    await mutate(st=>{(st.added??={})[c.name]={at:now()};if(st.removed)delete st.removed[c.name];});
    const logged=await browser.hasLoginCookie(c.domains,c.loginCookies??[]);
    out.push({channel:c.name,added:true,login:logged?'logged in':'not logged in',copiedFromYourBrowser:s.copied??0,
     next:logged?`Test it: pnpm tempoloom reach check ${c.name}`:`Log in once: pnpm tempoloom reach login ${c.name} (the user logs in in the window; use a second account if possible)`});
   }else{await mutate(st=>{(st.added??={})[c.name]={at:now()};});out.push({channel:c.name,added:true,login:'not needed'});}
  }catch(e){out.push({channel:c.name,added:false,error:classify(e).message});}
 }
 return out;
}
export async function remove(name:string){
 const c=channelByName(name);
 const cleared=c.loginUrl?await browser.clearSite(c.domains):0;
 if(c.loginUrl)await sessions.markLoggedOut(c.name);
 await mutate(s=>{delete s.added?.[c.name];(s.removed??={})[c.name]=now();});
 return {channel:c.name,removed:true,loginCleared:cleared>0};
}
export async function login(name:string,{importExisting=false}:{importExisting?:boolean}={}){
 const c=channelByName(name);
 if(!c.loginUrl)return {channel:c.name,login:'not needed'};
 if(importExisting){const r=await sessions.prepare(c.name,c.domains,{force:true});return {channel:c.name,copied:r.copied,source:r.source};}
 await browser.ensureRunning({headed:true,url:c.loginUrl});
 await sessions.markManual(c.name);
 await mutate(s=>{(s.added??={})[c.name]??={at:now()};});
 return {channel:c.name,window:'open',next:`Ask the user to log in to ${c.domains[0]} in the Tempoloom window and say when done (never ask for the password). Then: pnpm tempoloom reach check ${c.name}. The window closes by itself after 30 minutes unused, or when closed.`};
}
export async function logout(name:string){
 const c=channelByName(name);
 const cleared=await browser.clearSite(c.domains);
 await sessions.markLoggedOut(c.name);
 return {channel:c.name,loggedOut:true,cookiesRemoved:cleared};
}

export async function doctor(){
 const st=await browser.status().catch(e=>({error:classify(e).message}));
 const bridge=await browser.bridgeStatus();
 const yt=await ytdlpVersion();
 const problems:string[]=[];
 if(!opencliVersion())problems.push('OpenCLI is missing: run pnpm install');
 if('error' in st&&st.error)problems.push(st.error as string);
 if(!browser.fullChromium())problems.push('Full Chromium is missing: pnpm exec playwright install chromium');
 if(!yt)problems.push('yt-dlp is missing: it installs itself on first use, or run pnpm media:setup');
 if(bridge.ok&&bridge.daemonVersion!==opencliVersion())problems.push(`Another OpenCLI bridge (${bridge.daemonVersion}) is running; close it so Tempoloom can use ${opencliVersion()}`);
 const ch=await list();
 return {ok:!problems.length,problems,
  tools:{node:process.version,opencli:opencliVersion()??'missing',opencliTested:OPENCLI_VERSION,extension:browser.extensionVersion()??`not downloaded yet (${EXTENSION.version} downloads on first use)`,
   ytDlp:yt??'missing',ytDlpTested:YTDLP_VERSION,elevenlabs:process.env.ELEVENLABS_API_KEY?.trim()?'key set (transcripts only with --allow-upload)':'no key (subtitles only)'},
  browser:st,bridge:bridge.ok?{running:true,version:bridge.daemonVersion,browsers:(bridge.profiles??[]).length}:{running:false,note:'starts by itself when needed'},
  channels:ch.map(c=>({channel:c.channel,level:c.level,added:c.added,login:c.login})),
  next:problems.length?problems:['pnpm tempoloom reach check  (one live test per channel)']};
}

/** One live test per action that has one (only channels that are set up). */
export async function check(names:string[]=[]){
 const list=(names.length?names.map(channelByName):channels.filter(c=>isAdded(c)));
 const results=[];
 for(const c of list)for(const a of c.actions){
  if(!a.liveTest)continue;
  const r=await run(c.name,a.name,a.liveTest,90);
  results.push({channel:c.name,action:a.name,ok:r.ok,backend:r.backend,items:r.items.length,error:r.error?.code??null,message:r.error?.message??null,
   tried:r.meta.attempts.map(x=>`${x.backend}: ${x.result}${x.message?' ('+x.message.slice(0,140)+')':''}`)});
 }
 const failed=results.filter(r=>!r.ok);
 return {passed:results.length-failed.length,failed:failed.length,results};
}

export async function update(){
 await browser.stop();
 const ext=await browser.ensureExtension();
 const yt=await ensureYtdlp();
 await mutate(s=>{delete s.backendHealth;});
 return {opencli:opencliVersion(),extension:ext.version,ytDlp:yt,note:'OpenCLI updates with Tempoloom itself (git pull, then pnpm install). Paused backends were reset.'};
}
export async function uninstall(confirm:boolean){
 const root=reachRoot();
 const what=['the Tempoloom browser profile and every saved login in it','the OpenCLI extension copy','Reach state, locks and pauses'];
 if(!confirm)return {wouldDelete:root,contents:what,next:'Ask the user, then run: pnpm tempoloom reach uninstall --confirm. Downloads in workspace/downloads stay.'};
 await browser.stop();
 await fs.rm(root,{recursive:true,force:true});
 return {deleted:root,kept:'workspace/downloads (your downloads), OpenCLI package (part of Tempoloom)'};
}

// ---------- study-only downloads ----------
const opencliDownload:Record<string,{site:string;command:string;args:(url:string,dir:string)=>Record<string,unknown>}>={
 instagram:{site:'instagram',command:'download',args:(url,dir)=>({url,path:dir})},
 x:{site:'twitter',command:'download',args:(url,dir)=>({'tweet-url':url,output:dir})},
 pinterest:{site:'pinterest',command:'download',args:(url,dir)=>({pin:url,output:dir})},
};
/** Info first; with confirm, downloads the video for study (never for a final video). */
export async function download(url:string,{confirm=false,section,item}:{confirm?:boolean;section?:string;item?:number}={}){
 const {channel}=routeUrl(url);
 if(channel.name==='instagram'){
  const {referenceInfo,downloadReference}=await import('../engine/sourcing/reference-video.js');
  if(!confirm)return {...await referenceInfo(url,item?{item}:{}),next:'Preview the selected post. Download with --confirm and --item NUMBER for a carousel.'};
  return downloadReference(url,{...(section?{section}:{}),...(item?{item}:{})});
 }
 const domains=channel.domains;
 let info=null,candidates:Awaited<ReturnType<typeof videoInfo>>=[];
 try{
  candidates=await videoInfo({target:url,timeout:90,domains});
  const index=item??Number(new URL(url).searchParams.get('img_index')||0);
  info=index?candidates.find(v=>(v.raw as {item?:number}).item===index)??null:candidates[0]??null;
  if(index&&!info)throw new ReachError('BAD_INPUT','No video at that position in the post');
 }catch(e){if(!opencliDownload[channel.name]||classify(e).code==='BAD_INPUT')throw e;}
 if(confirm&&candidates.length>1&&!item&&!new URL(url).searchParams.has('img_index'))throw new ReachError('BAD_INPUT','Choose a video with --item NUMBER before downloading');
 const raw=(info?.raw??{}) as Record<string,unknown>;
 const summary={site:channel.name,title:info?.title??null,author:info?.author??null,duration:raw.duration??null,approxMB:raw.approxMB??null,page:info?.url??url,choices:candidates.map(v=>({title:v.title,...v.raw as Record<string,unknown>})),usage:'study'};
 if(!confirm)return {...summary,next:'Tell the user the title, length and size, ask, then add --confirm. Study only: never in a final video.'};
 const id=String(raw.id??Buffer.from(url).toString('base64url').slice(-16)).replace(/[^\w.-]+/g,'-').slice(0,60);
 const folder=path.join(downloadsRoot(),'reference',`${channel.name}-${id}`);
 const record=path.join(folder,'source.json');
 try{
  const saved=JSON.parse(await fs.readFile(record,'utf8')) as {files:string[];section?:string};
  const video=path.resolve(folder,saved.files[0]??'');
  if(saved.files.length===1&&saved.section===(section??null)&&video.startsWith(path.resolve(folder)+path.sep)){await fs.access(video);return {...saved,folder,video,cached:true};}
 }catch{/* Download when the cached file is absent. */}
 let files:string[]=[];let backend='yt-dlp';
 try{files=await downloadVideo({target:url,folder,section,timeout:1800,domains,...(item?{item}:{})});}
 catch(e){
  const alt=opencliDownload[channel.name];const err=classify(e);
  if(!alt||['PLATFORM_BLOCKED','RATE_LIMITED','BAD_INPUT'].includes(err.code))throw err;
  backend='opencli';await fs.mkdir(folder,{recursive:true});const fresh=await fs.mkdtemp(path.join(folder,'browser-'));await callOpencli(alt.site,alt.command,alt.args(url,fresh),{timeout:600,loginHint:`pnpm tempoloom reach login ${channel.name}`});
  files=(await fs.readdir(fresh)).filter(f=>/\.(mp4|webm|mkv|mov)$/i.test(f)).map(f=>path.join(fresh,f));
  if(files.length>1)throw new ReachError('BAD_INPUT','This post returned multiple videos. Choose a single video link.');
  if(!files.length)throw new ReachError('UPSTREAM_BROKEN','Nothing was downloaded');
 }
 const entry={version:1,provider:backend,...summary,url,section:section??null,files:files.map(f=>path.relative(folder,f)),downloadedAt:new Date().toISOString(),
  license:{usage:'study',reason:'Reference download; study only'},usage:'Study and reference only; never in a final video'};
 await fs.writeFile(record,JSON.stringify(entry,null,1)+'\n');
 return {...entry,folder,video:files[0],cached:false,next:'Measure it: pnpm tempoloom media style FILE or media scenes FILE'};
}
