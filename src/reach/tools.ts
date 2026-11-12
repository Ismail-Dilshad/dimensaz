// The upstream tools Reach drives, at tested versions (Agent Reach runtime/tools.py):
// OpenCLI (npm dependency of the project), its browser extension (downloaded once, hash
// checked), yt-dlp (project .venv) and an optional CloakBrowser engine.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {projectPython} from '../engine/audio-analysis.js';
import {ReachError} from './result.js';
import {scrubSecrets} from './safety.js';

const require=createRequire(import.meta.url);
export const OPENCLI_VERSION='2.0.2';
export const EXTENSION={version:'1.0.26',url:'https://github.com/jackwener/opencli/releases/download/v2.0.2/opencli-extension-v1.0.26.zip',
 sha256:'2b2eff46fe4a21a0b02516e743005066e6317b48f15455c1c7b07f69ad7af211',storeUrl:'https://chromewebstore.google.com/detail/opencli/ildkmabpimmkaediidaifkhjpohdnifk'};
export const YTDLP_VERSION='2026.8.19';
export const BRIDGE_PORT=Number(process.env.OPENCLI_DAEMON_PORT||19825);

export function opencliRoot(){
 try{return path.dirname(require.resolve('@jackwener/opencli/package.json'));}
 catch{try{return path.resolve(path.dirname(require.resolve('@jackwener/opencli')),'..','..');}catch{return null;}}
}
export function opencliMain(){
 const root=opencliRoot();const main=root&&path.join(root,'dist','src','main.js');
 if(!main||!fs.existsSync(main))throw new ReachError('NEED_SETUP','OpenCLI is not installed','Run pnpm install in the Tempoloom folder.');
 return main;
}
export function opencliVersion(){try{return JSON.parse(fs.readFileSync(path.join(opencliRoot()!,'package.json'),'utf8')).version as string;}catch{return null;}}

export type ManifestArg={name:string;positional?:boolean;required?:boolean;type?:string;default?:unknown;help?:string};
export type ManifestCommand={site:string;name:string;access:'read'|'write';browser?:boolean;strategy?:string;description?:string;args?:ManifestArg[]};
let manifestCache:ManifestCommand[]|null=null;
export function manifest(){
 if(manifestCache)return manifestCache;
 const root=opencliRoot();if(!root)throw new ReachError('NEED_SETUP','OpenCLI is not installed','Run pnpm install.');
 manifestCache=JSON.parse(fs.readFileSync(path.join(root,'cli-manifest.json'),'utf8')) as ManifestCommand[];
 return manifestCache;
}
/** The manifest entry of a read command; write commands and unknown commands are refused. */
export function readCommand(site:string,name:string){
 const c=manifest().find(x=>x.site===site&&x.name===name);
 if(!c)throw new ReachError('NEED_SETUP',`OpenCLI ${OPENCLI_VERSION} has no "${site} ${name}" command`,'Run pnpm tempoloom reach update.');
 if(c.access!=='read')throw new ReachError('BAD_INPUT',`"${site} ${name}" changes data on the site; Tempoloom only reads`);
 return c;
}

export class CommandFailed extends Error{constructor(public stdout:string,public stderr:string,public exitCode:number|null,message:string){super(message);}}
/** Runs a command with a hard timeout; rejects with CommandFailed on a non-zero exit. */
export function run(cmd:string,args:string[],{timeout=60,env={},cwd,label=path.basename(cmd)}:{timeout?:number;env?:Record<string,string>;cwd?:string;label?:string}={}){
 return new Promise<string>((resolve,reject)=>{
  const child=spawn(cmd,args,{cwd,env:{...process.env,...env},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let out='',err='';const max=20*1024*1024;
  child.stdout.on('data',d=>{if(out.length<max)out+=d;});child.stderr.on('data',d=>{err=(err+d).slice(-20000);});
  const timer=setTimeout(()=>{child.kill();reject(new ReachError('TIMEOUT',`${label} did not answer within ${Math.round(timeout)} s`));},Math.max(1,timeout)*1000);
  child.once('error',e=>{clearTimeout(timer);reject((e as {code?:string}).code==='ENOENT'?new ReachError('NEED_SETUP',`${label} is not installed`):e);});
  child.once('close',code=>{clearTimeout(timer);code===0?resolve(out):reject(new CommandFailed(out,err,code,scrubSecrets(`${label} failed: `+(err.trim().split('\n').slice(-3).join(' ')||out.trim().slice(0,300)))));});
 });
}

export const pythonPath=()=>projectPython();
export async function ytdlpVersion(){try{return (await run(pythonPath(),['-m','yt_dlp','--version'],{timeout:30,label:'yt-dlp'})).trim();}catch{return null;}}
export const older=(a:string,b:string)=>{const pa=a.split('.').map(Number),pb=b.split('.').map(Number);for(let i=0;i<3;i++){if((pa[i]??0)!==(pb[i]??0))return (pa[i]??0)<(pb[i]??0);}return false;};
/** Installs the tested yt-dlp into .venv when it is missing (automatic, about 3 MB). */
export async function ensureYtdlp(){
 const v=await ytdlpVersion();if(v&&!older(v,YTDLP_VERSION))return v;
 if(!fs.existsSync(pythonPath()))throw new ReachError('NEED_SETUP','The project .venv is missing','Run pnpm audio:setup or pnpm media:setup first.');
 await run(pythonPath(),['-m','pip','install','--disable-pip-version-check','--only-binary=:all:',`yt-dlp==${YTDLP_VERSION}`],{timeout:300,label:'pip'});
 const after=await ytdlpVersion();if(!after)throw new ReachError('NEED_SETUP','yt-dlp could not be installed into .venv');
 return after;
}
/** yt-dlp needs a JavaScript runtime for YouTube; Node is always there. */
export const ytdlpBase=()=>['-m','yt_dlp','--no-warnings','--js-runtimes','node'];
