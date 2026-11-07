// `pnpm dimensaz browse`: drive the Dimensaz browser (OpenCLI browser commands) to open any
// page, read it, scroll, find and extract content and take screenshots. It runs in the
// dedicated profile with the user's saved logins, never in the user's own Chrome.
import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT} from '../engine/config.js';
import {ensureRunning,loadBrowserState,touch} from '../reach/browser.js';
import {opencliMain,run,CommandFailed} from '../reach/tools.js';
import {publicUrl,BROWSE_ACTIONS_NEEDING_CONFIRM} from '../reach/safety.js';
import {classify} from '../reach/result.js';

const allowed=new Set(['open','back','scroll','state','frames','screenshot','console','find','get','click','type','hover','focus','dblclick','check','uncheck','drag','fill','select','keys','wait','extract','network','tab','close','dialog','eval','upload']);
const usage=`Usage: dimensaz browse <command> [args] [--session NAME]

  open URL            Open a page (in the hidden Dimensaz browser, with saved logins)
  state               Title, URL and the page's interactive elements with [N] numbers
  extract             Page content as markdown
  screenshot [FILE]   Screenshot (default workspace/research/screenshots/)
  scroll down|up      Scroll;  find --css SELECTOR;  get title|url|text|html
  click N  type N TEXT  fill N TEXT  select N OPTION  keys KEY  hover N  wait text "..."
  back  tab list|new|select|close  close

Never use it to post, send, buy, sign up or submit anything without asking the user first.
eval and upload need --confirm. Default session: dimensaz.`;

async function main(){
 const argv=process.argv.slice(2);
 const [cmd]=argv;
 if(!cmd||cmd==='help'||cmd==='--help')return console.log(usage);
 if(!allowed.has(cmd))throw new Error(`browse ${cmd} is not available. Commands: ${[...allowed].join(', ')}`);
 const confirmAt=argv.indexOf('--confirm');
 if(BROWSE_ACTIONS_NEEDING_CONFIRM.has(cmd)&&confirmAt<0)throw new Error(`browse ${cmd} needs --confirm (ask the user first)`);
 const args=argv.filter((_,i)=>i!==confirmAt);
 if(!args.includes('--session'))args.splice(1,0,'--session','dimensaz');
 if(cmd==='open'){const i=args.findIndex((a,j)=>j>0&&!a.startsWith('--')&&args[j-1]!=='--session');if(i>0)args[i]=publicUrl(args[i]!);}
 if(cmd==='screenshot'&&!args.slice(1).some((a,j)=>!a.startsWith('--')&&args[j]!=='--session')){
  const dir=path.join(ROOT,process.env.VIDEO_WORKSPACE||'workspace','research','screenshots');await fs.mkdir(dir,{recursive:true});
  args.push(path.join(dir,`screen-${new Date().toISOString().replace(/[:.]/g,'-')}.png`));
 }
 await ensureRunning();
 const env={OPENCLI_PROFILE:loadBrowserState().contextId??'',OPENCLI_CDP_ENDPOINT:'',OPENCLI_CDP_TARGET:''};
 try{process.stdout.write(await run(process.execPath,[opencliMain(),'browser',...args],{timeout:120,env,label:'OpenCLI browser'}));}
 catch(e){if(e instanceof CommandFailed){process.stdout.write(e.stdout||e.stderr);process.exitCode=1;return;}throw e;}
 finally{touch();}
}
main().catch(e=>{const err=classify(e);console.log(JSON.stringify({ok:false,error:{code:err.code,message:err.message}},null,2));process.exitCode=1;});
