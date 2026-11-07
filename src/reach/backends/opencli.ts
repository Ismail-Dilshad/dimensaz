// OpenCLI backend (Agent Reach backends/opencli.py): runs `opencli <site> <command>` inside
// the Dimensaz browser profile and maps rows to unified items. Only read commands are allowed.
import {ReachError,makeItem,unixToIso,type Item} from '../result.js';
import {readCommand,opencliMain,run,CommandFailed,type ManifestCommand} from '../tools.js';
import {ensureRunning,touch,saveSession,loadBrowserState} from '../browser.js';

/** Builds argv from the manifest: positional arguments in order, the rest as --name value. */
export function buildArgs(cmd:ManifestCommand,params:Record<string,unknown>){
 const args:string[]=[];
 for(const a of cmd.args??[])if(a.positional&&params[a.name]!==undefined&&params[a.name]!==null&&params[a.name]!=='')args.push(String(params[a.name]));
 for(const a of cmd.args??[]){
  if(a.positional)continue;const v=params[a.name];if(v===undefined||v===null||v==='')continue;
  args.push('--'+a.name,typeof v==='boolean'?String(v):String(v));
 }
 const known=new Set((cmd.args??[]).map(a=>a.name));
 const unknown=Object.keys(params).filter(k=>!known.has(k)&&params[k]!==undefined);
 if(unknown.length)throw new ReachError('BAD_INPUT',`${cmd.site} ${cmd.name} does not take: ${unknown.join(', ')}`);
 return args;
}

/** Turns OpenCLI's error envelope (YAML or JSON on stdout) into a ReachError. */
export function opencliError(text:string,loginHint:string):ReachError{
 let code='',message='',hint='';
 const json=text.match(/\{[\s\S]*"ok"\s*:\s*false[\s\S]*\}/);
 if(json){try{const d=JSON.parse(json[0]);code=String(d.error?.code??'').toUpperCase();message=String(d.error?.message??'');hint=String(d.error?.hint??d.error?.help??'');}catch{/* fall through */}}
 if(!message){const start=text.search(/^ok: false\s*$/m);const block=start>=0?text.slice(start):text;
  code=(block.match(/^\s*code:\s*["']?([\w-]+)/m)?.[1]??'').toUpperCase();message=block.match(/^\s*message:\s*["']?(.+?)["']?\s*$/m)?.[1]??text.trim();hint=block.match(/^\s*(?:help|hint):\s*["']?(.+?)["']?\s*$/m)?.[1]??'';}
 message=(message||'OpenCLI failed').slice(0,500);const low=message.toLowerCase();
 if(['ACCOUNT_RISK','CAPTCHA_REQUIRED'].includes(code)||/captcha|browser environment|verify you are human|unusual activity|checkpoint|challenge_required|suspicious/.test(low))return new ReachError('PLATFORM_BLOCKED',message,hint||undefined);
 if(['RATE_LIMITED','RATE_LIMIT'].includes(code)||/http 429|too many requests|rate limit|try again later/.test(low))return new ReachError('RATE_LIMITED',message);
 if(code==='BROWSER_CONNECT'||code==='DAEMON'||/extension not connected|bridge/.test(low))return new ReachError('NEED_SETUP',message,'Run pnpm dimensaz reach doctor.');
 if(!/\bhttp 404\b/i.test(message)&&(/AUTH|LOGIN/.test(code)||/\b(login|log in|logged in|sign in|signed in|http 401)\b/.test(low)))return new ReachError('NEED_LOGIN',message,loginHint);
 if(code==='NOT_FOUND'||/not found|doesn't exist|does not exist|no such|http 404/.test(low))return new ReachError('NOT_FOUND',message);
 if(code==='ARGUMENT'||code==='BAD_ARGUMENT')return new ReachError('BAD_INPUT',message);
 return new ReachError('UPSTREAM_BROKEN',message,hint||undefined);
}

export function toItems(rows:unknown):Item[]{
 let list:unknown=rows;
 if(list&&typeof list==='object'&&!Array.isArray(list)){const o=list as Record<string,unknown>;list=Array.isArray(o.data)?o.data:Array.isArray(o.items)?o.items:o.data??[o];}
 if(!Array.isArray(list))list=list?[list]:[];
 const pick=(r:Record<string,unknown>,...keys:string[])=>{for(const k of keys){let v=r[k];if(v&&typeof v==='object'&&!Array.isArray(v)){const o=v as Record<string,unknown>;v=o.name??o.username??o.nickname;}if(v!==undefined&&v!==null&&v!=='')return String(v);}return null;};
 return (list as unknown[]).filter(r=>r&&typeof r==='object').map(x=>{const r=x as Record<string,unknown>;
  return makeItem({title:pick(r,'title','name','full_name','caption','headline'),url:pick(r,'url','link','permalink','note_url','profile_url'),
   author:pick(r,'author','user','username','handle','channel','nickname','owner'),
   published_at:typeof r.created_utc==='number'?unixToIso(r.created_utc):pick(r,'published_at','created_at','publishedAt','time','date','timestamp'),
   text:pick(r,'content','text','desc','description','body','caption','summary','transcript'),raw:r});});
}

export type OpencliCall=(site:string,command:string,params:Record<string,unknown>,o:{timeout:number;loginHint:string})=>Promise<unknown>;
/** The real call: needs the Dimensaz browser running with OpenCLI connected. */
export const opencliCall:OpencliCall=async(site,command,params,{timeout,loginHint})=>{
 const cmd=readCommand(site,command);
 const args=buildArgs(cmd,params);
 const env:Record<string,string>={OPENCLI_WINDOW:'background',OPENCLI_CDP_ENDPOINT:'',OPENCLI_CDP_TARGET:'',OPENCLI_SITE_SESSION:'ephemeral',OPENCLI_CLOSE_OWNED_TAB:'1'};
 if(cmd.browser!==false){await ensureRunning();env.OPENCLI_PROFILE=loadBrowserState().contextId??'';}
 touch();
 let out:string;
 try{out=await run(process.execPath,[opencliMain(),site,command,...args,'-f','json'],{timeout,env,label:'OpenCLI'});}
 catch(e){if(e instanceof CommandFailed)throw opencliError(e.stdout||e.stderr,loginHint);throw e;}
 finally{touch();}
 let data:unknown;
 try{data=JSON.parse(out.slice(out.search(/[[{]/)));}
 catch{if(!out.trim()||/^ok: false\s*$/m.test(out))throw opencliError(out,loginHint);data={data:[{text:out.trim()}]};} // markdown output (web read, transcripts)
 if(data&&typeof data==='object'&&(data as {ok?:boolean}).ok===false)throw opencliError(out,loginHint);
 if(cmd.browser!==false)await saveSession().catch(()=>undefined);
 return data;
};
let current:OpencliCall=opencliCall;
export const setOpencliCall=(f:OpencliCall|null)=>{current=f??opencliCall;}; // tests
export const callOpencli:OpencliCall=(...a)=>current(...a);
