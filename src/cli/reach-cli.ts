// `pnpm tempoloom reach`: read-only access to YouTube, Instagram, TikTok, X, Facebook,
// Pinterest, Dribbble, Behance, Reddit, LinkedIn and the web, built on Agent Reach's design
// with its tools (OpenCLI, yt-dlp, Jina Reader, Exa). Every command prints one JSON object.
import {channels,channelByName,routeUrl} from '../reach/channels.js';
import * as manage from '../reach/manage.js';
import * as browser from '../reach/browser.js';
import * as sessions from '../reach/sessions.js';
import {classify,envelope} from '../reach/result.js';

const usage=`Usage: tempoloom reach <command>

  channels                         Every channel, its actions, and whether it is set up and logged in
  <channel> <action> [ARGS] [--name value]
                                   e.g. reach tiktok search "saas promo" --limit 10
                                        reach youtube transcript URL
                                        reach instagram posts nasa --limit 6
  read URL                         Any link: picks the right channel and action by itself
  download URL [--confirm] [--section START-END]
                                   Reference video, study only: info first, downloads with --confirm
  add CHANNEL...                   Set up channels (installs tools, opens the hidden browser, copies the login)
  remove CHANNEL                   Remove a channel and its login
  login CHANNEL [--import]         Open a window for the user to log in (or copy the login from their Chrome)
  logout CHANNEL                   Clear that site's login
  browser status|stop|profiles|use ID|engine chromium|cloak
  doctor                           What works and what is missing
  check [CHANNEL...]               One live test per action
  update                           Refresh the extension and yt-dlp, reset paused backends
  uninstall [--confirm]            Delete the Tempoloom browser profile and Reach state

Options: --timeout SECONDS, --backend NAME (opencli, yt-dlp, exa, jina, public-web, ...).
Read-only: nothing is ever posted, liked, followed or sent.
Channels: ${channels.map(c=>c.name).join(', ')}`;

function parse(argv:string[]){
 const pos:string[]=[],opts:Record<string,string|boolean>={};
 for(let i=0;i<argv.length;i++){
  const a=argv[i]!;
  if(a.startsWith('--')){const [k,inline]=a.slice(2).split(/=(.*)/s);const key=k!.replace(/-/g,'_');
   if(inline!==undefined)opts[key]=inline;else if(argv[i+1]!==undefined&&!argv[i+1]!.startsWith('--'))opts[key]=argv[++i]!;else opts[key]=true;}
  else pos.push(a);
 }
 return {pos,opts};
}
const print=(v:unknown)=>console.log(JSON.stringify(v,null,2));

async function main(){
 const {pos,opts}=parse(process.argv.slice(2));
 const [cmd,...rest]=pos;
 const timeout=opts.timeout?Number(opts.timeout):undefined,backend=typeof opts.backend==='string'?opts.backend:undefined;
 delete opts.timeout;delete opts.backend;
 if(!cmd||cmd==='help'||opts.help)return console.log(usage);
 switch(cmd){
  case 'channels':return print(await manage.list());
  case 'read':{if(!rest[0])throw new Error('read needs a link');const r=routeUrl(rest[0]);
   const env=await manage.run(r.channel.name,r.action,{...r.params,...opts},timeout,backend);
   if(!env.ok&&r.channel.name!=='web'&&['NOT_FOUND','UPSTREAM_BROKEN','NEED_SETUP'].includes(env.error!.code)){
    const web=await manage.run('web','read',{target:rest[0]},timeout);if(web.ok)return print({...web,meta:{...web.meta,note:`${r.channel.name} ${r.action} failed (${env.error!.code}); this is the public page text`}});
   }
   process.exitCode=env.ok?0:1;return print(env);}
  case 'download':if(!rest[0])throw new Error('download needs a link');return print(await manage.download(rest[0],{confirm:opts.confirm===true,section:typeof opts.section==='string'?opts.section:undefined}));
  case 'add':if(!rest.length)throw new Error('Name the channels: reach add instagram tiktok x');return print(await manage.add(rest));
  case 'remove':return print(await manage.remove(rest[0]??''));
  case 'login':return print(await manage.login(rest[0]??'',{importExisting:opts.import===true}));
  case 'logout':return print(await manage.logout(rest[0]??''));
  case 'doctor':return print(await manage.doctor());
  case 'check':{const r=await manage.check(rest);process.exitCode=r.failed?1:0;return print(r);}
  case 'update':return print(await manage.update());
  case 'uninstall':return print(await manage.uninstall(opts.confirm===true));
  case 'browser':{
   const [sub,arg]=rest;
   if(sub==='status'||!sub)return print(await browser.status());
   if(sub==='stop')return print({stopped:await browser.stop()});
   if(sub==='start')return print(await browser.ensureRunning());
   if(sub==='profiles')return print({yourBrowsers:await sessions.sourceProfiles(),note:'Browsers with the OpenCLI extension that a site login can be copied from (that site only).'});
   if(sub==='use')return print(await sessions.useProfile(arg??''));
   if(sub==='engine'){
    if(arg==='cloak'){const r=await browser.installCloak();await browser.stop();browser.updateBrowserState({engine:'cloak',cloakExecutable:r.executable});return print({engine:'cloak',...r});}
    if(arg==='chromium'){await browser.stop();browser.updateBrowserState({engine:'chromium'});return print({engine:'chromium'});}
    return print({engine:browser.loadBrowserState().engine??'chromium',choices:['chromium','cloak']});
   }
   throw new Error('browser status|start|stop|profiles|use ID|engine chromium|cloak');
  }
  default:{
   const channel=channelByName(cmd);
   const actionName=rest[0];
   const action=channel.actions.find(a=>a.name===actionName);
   if(!action){print(envelope({channel:channel.name,action:actionName??null,elapsedMs:0,error:classify(new Error(`Actions for ${channel.name}: ${channel.actions.map(a=>a.name).join(', ')}`))}));process.exitCode=1;return;}
   const params:Record<string,unknown>={...opts};
   const required=action.params.filter(p=>p.required);
   rest.slice(1).forEach((v,i)=>{const p=required[i]??action.params.find(x=>!(x.name in params)&&!x.required);if(p&&params[p.name]===undefined)params[p.name]=v;});
   const env=await manage.run(channel.name,action.name,params,timeout,backend);
   process.exitCode=env.ok?0:1;return print(env);
  }
 }
}
main().catch(e=>{const err=classify(e);console.log(JSON.stringify({ok:false,error:{code:err.code,message:err.message,hint:err.hint}},null,2));process.exitCode=1;});
