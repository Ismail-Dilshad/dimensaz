// Channels: one per platform, each with unified actions and an ordered list of backends
// (Agent Reach channels/*.py). The dispatcher tries backends in order and falls back on
// recoverable errors. Dimensaz's set is chosen for video research: the platforms where
// brands, trends and reference videos live.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ReachError,makeItem,type Item} from './result.js';
import {hostMatches,publicUrl} from './safety.js';
import {callOpencli,toItems} from './backends/opencli.js';
import {jinaRead,exaRead,exaSearch} from './backends/web.js';
import {videoInfo,youtubeSearch,subtitles,downloadVideo} from './backends/ytdlp.js';

export type Param={name:string;help:string;required?:boolean;type?:'string'|'int'|'bool';default?:unknown};
export type Ctx={timeout:number;channel:Channel};
export type Backend=[label:string,run:(p:Record<string,any>,c:Ctx)=>Promise<Item[]>];
export type Action={name:string;help:string;params:Param[];backends:Backend[];liveTest?:Record<string,unknown>;timeout?:number;
 /** Public URL scopes searched or read through the web channel while the site is not logged in. */
 publicWeb?:string[];browser?:boolean};
export type Channel={name:string;description:string;level:'default'|'optional'|'experimental';domains:string[];actions:Action[];
 loginUrl?:string;loginCookies?:string[];readAction?:string;notes?:string};

const q:Param={name:'query',help:'what to search for',required:true};
const limit=(d=5):Param=>({name:'limit',help:'max results',type:'int',default:d});
const target:Param={name:'target',help:'link',required:true};
const user:Param={name:'username',help:'user name without @',required:true};

/** An OpenCLI read command; `map` renames Dimensaz params to OpenCLI argument names. */
const oc=(site:string,command:string,map:Record<string,string>={},drop:string[]=[]):Backend=>['opencli',async(p,c)=>{
 const params:Record<string,unknown>={};
 for(const [k,v] of Object.entries(p))if(!drop.includes(k)&&v!==undefined)params[map[k]??k]=v;
 const hint=`Run pnpm dimensaz reach login ${c.channel.name} and ask the user to log in to ${c.channel.domains[0]} in the window it opens. Never log in for them.`;
 const items=toItems(await callOpencli(site,command,params,{timeout:c.timeout,loginHint:hint}));
 const lim=typeof p.limit==='number'?p.limit:undefined;
 if(!items.length)throw new ReachError('NOT_FOUND','nothing found');
 return lim?items.slice(0,lim):items;
}];
const ytInfo:Backend=['yt-dlp',(p,c)=>videoInfo({target:p.target,timeout:c.timeout,domains:c.channel.domains})];
const siteSearch=(scopes:string[]):Backend=>['exa',(p,c)=>exaSearch({query:`(${p.query}) (${scopes.map(s=>'site:'+s).join(' OR ')})`,limit:p.limit,timeout:c.timeout})];
const webRead:Backend[]=[['jina',(p,c)=>jinaRead({target:p.target,timeout:c.timeout})],['exa',(p,c)=>exaRead({target:p.target,timeout:c.timeout})]];
const videoAction=(test?:string):Action=>({name:'video',help:'A video or post: title, author, date, length, views (yt-dlp)',params:[target],backends:[ytInfo],liveTest:test?{target:test}:undefined});

/** ElevenLabs transcription: only with --allow-upload and a key (the audio is uploaded). */
const elevenlabs:Backend=['elevenlabs',async(p,c)=>{
 if(!p.allow_upload)throw new ReachError('NOT_FOUND','No subtitles; transcription needs --allow-upload (sends the audio to ElevenLabs)');
 const {hasApiKey,transcribe}=await import('../engine/transcribe.js');
 if(!hasApiKey())throw new ReachError('NEED_SETUP','No ELEVENLABS_API_KEY in .env');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dz-stt-'));
 try{
  const [audio]=await downloadVideo({target:p.target,folder:dir,timeout:c.timeout,domains:c.channel.domains,audioOnly:true});
  const t=await transcribe(audio!,{language:'auto'});
  return [makeItem({url:p.target,text:t.text,raw:{language:t.language,words:t.words.length,transcript:t.file}})];
 }finally{await fs.rm(dir,{recursive:true,force:true});}
}];

export const channels:Channel[]=[
 {name:'web',description:'Search the web and read any page as clean text',level:'default',domains:[],readAction:'read',actions:[
  {name:'search',help:'Web search (Exa, free)',params:[q,limit()],backends:[['exa',(p,c)=>exaSearch({query:p.query,limit:p.limit,timeout:c.timeout})]],liveTest:{query:'motion design trends',limit:2}},
  {name:'read',help:'Read a page as clean text (Jina Reader, then Exa)',params:[target],backends:webRead,liveTest:{target:'https://example.com'}},
 ]},
 {name:'youtube',description:'YouTube search, video info, transcripts, comments, channels',level:'default',domains:['youtube.com','youtu.be'],readAction:'video',actions:[
  {name:'search',help:'Search videos',params:[q,limit()],backends:[['yt-dlp',(p,c)=>youtubeSearch({query:p.query,limit:p.limit,timeout:c.timeout})],oc('youtube','search')],liveTest:{query:'saas promo video',limit:2},publicWeb:['youtube.com/']},
  videoAction('https://www.youtube.com/watch?v=jNQXAC9IVRw'),
  {name:'transcript',help:'What is said in a video (subtitles; ElevenLabs only with --allow-upload)',params:[target,{name:'lang',help:'language',default:'en'},{name:'allow_upload',help:'transcribe with ElevenLabs if there are no subtitles',type:'bool',default:false}],
   backends:[['yt-dlp',(p,c)=>subtitles({target:p.target,lang:p.lang,timeout:c.timeout,domains:c.channel.domains})],oc('youtube','transcript',{target:'url'},['allow_upload']),elevenlabs],timeout:180,liveTest:{target:'https://www.youtube.com/watch?v=jNQXAC9IVRw'}},
  {name:'comments',help:'Top comments (what the audience says)',params:[target,limit(20)],backends:[oc('youtube','comments',{target:'url'})],browser:true},
  {name:'channel',help:'A channel and its recent videos',params:[{name:'id',help:'channel id, @handle or link',required:true},limit(10)],backends:[oc('youtube','channel')],browser:true},
 ]},
 {name:'instagram',description:'Instagram users, profiles, posts and reels',level:'experimental',domains:['instagram.com','instagr.am'],loginUrl:'https://www.instagram.com/accounts/login/',loginCookies:['sessionid'],readAction:'video',actions:[
  {name:'search',help:'Search users (not posts)',params:[q,limit()],backends:[oc('instagram','search')],liveTest:{query:'nasa',limit:2},publicWeb:['instagram.com/'],browser:true},
  {name:'profile',help:'A profile',params:[user],backends:[oc('instagram','profile')],liveTest:{username:'nasa'},browser:true},
  {name:'posts',help:'A user\'s recent posts',params:[user,limit(6)],backends:[oc('instagram','user')],liveTest:{username:'nasa',limit:2},browser:true},
  {name:'explore',help:'The explore feed',params:[limit(10)],backends:[oc('instagram','explore')],browser:true},
  videoAction(),
 ]},
 {name:'tiktok',description:'TikTok search, trending, users and videos',level:'experimental',domains:['tiktok.com'],loginUrl:'https://www.tiktok.com/login',loginCookies:['sessionid','sid_tt'],readAction:'video',actions:[
  {name:'search',help:'Search videos',params:[q,limit()],backends:[oc('tiktok','search')],liveTest:{query:'product launch',limit:2},publicWeb:['tiktok.com/'],browser:true},
  {name:'explore',help:'Trending videos',params:[limit(10)],backends:[oc('tiktok','explore')],browser:true},
  {name:'user',help:'A user\'s videos',params:[user,limit(10)],backends:[oc('tiktok','user')],browser:true},
  videoAction(),
 ]},
 {name:'x',description:'X (Twitter) search, trends, posts and threads',level:'experimental',domains:['x.com','twitter.com'],loginUrl:'https://x.com/i/flow/login',loginCookies:['auth_token'],readAction:'video',actions:[
  {name:'search',help:'Search posts',params:[q,limit()],backends:[oc('twitter','search')],liveTest:{query:'motion design',limit:2},publicWeb:['x.com/','twitter.com/'],browser:true},
  {name:'trending',help:'Trending topics',params:[limit(10)],backends:[oc('twitter','trending')],browser:true},
  {name:'posts',help:'A user\'s recent posts',params:[user,limit()],backends:[oc('twitter','tweets')],browser:true},
  {name:'thread',help:'A post and its replies',params:[{name:'id',help:'post id or link',required:true},limit(20)],backends:[oc('twitter','thread',{id:'tweet-id'})],browser:true},
  {name:'profile',help:'A profile',params:[user],backends:[oc('twitter','profile')],browser:true},
  videoAction(),
 ]},
 {name:'facebook',description:'Facebook search, pages and videos',level:'experimental',domains:['facebook.com','fb.com','fb.watch'],loginUrl:'https://www.facebook.com/login',loginCookies:['c_user'],readAction:'video',actions:[
  {name:'search',help:'Search Facebook',params:[q,limit()],backends:[oc('facebook','search')],liveTest:{query:'openai',limit:2},publicWeb:['facebook.com/'],browser:true},
  {name:'profile',help:'A person or page',params:[user],backends:[oc('facebook','profile')],browser:true},
  videoAction(),
 ]},
 {name:'pinterest',description:'Pinterest pins and boards (visual references)',level:'optional',domains:['pinterest.com','pin.it'],loginUrl:'https://www.pinterest.com/login/',loginCookies:['_pinterest_sess'],readAction:'pin',actions:[
  {name:'search',help:'Search pins',params:[q,limit(10)],backends:[oc('pinterest','search-pins')],liveTest:{query:'motion graphics poster',limit:2},publicWeb:['pinterest.com/pin/'],browser:true},
  {name:'pin',help:'One pin',params:[{name:'target',help:'pin id or link',required:true}],backends:[oc('pinterest','pin',{target:'pin'})],browser:true},
  {name:'board',help:'Pins of a board',params:[{name:'board',help:'board link or user/board',required:true},limit(10)],backends:[oc('pinterest','board-pins')],browser:true},
  {name:'user',help:'A user\'s pins',params:[user,limit(10)],backends:[oc('pinterest','user-pins')],browser:true},
 ]},
 {name:'dribbble',description:'Dribbble shots and designers (UI and motion references)',level:'optional',domains:['dribbble.com'],readAction:'shot',actions:[
  {name:'search',help:'Search shots',params:[q,limit(10)],backends:[oc('dribbble','shot'),siteSearch(['dribbble.com/shots'])],liveTest:{query:'saas dashboard animation',limit:2},browser:true},
  {name:'shot',help:'One shot',params:[{name:'target',help:'shot link or id',required:true}],backends:[oc('dribbble','shot-detail',{target:'shot'}),...webRead],browser:true},
  {name:'designer',help:'A designer\'s profile',params:[{name:'designer',help:'designer name or link',required:true}],backends:[oc('dribbble','profile')],browser:true},
 ]},
 {name:'behance',description:'Behance projects (search and read through the public web)',level:'optional',domains:['behance.net'],readAction:'read',actions:[
  {name:'search',help:'Search projects',params:[q,limit()],backends:[siteSearch(['behance.net/gallery'])],liveTest:{query:'motion design brand',limit:2}},
  {name:'read',help:'Read a project page',params:[target],backends:webRead},
 ]},
 {name:'threads',description:'Threads posts (search and read through the public web)',level:'optional',domains:['threads.net','threads.com'],readAction:'read',actions:[
  {name:'search',help:'Search posts',params:[q,limit()],backends:[siteSearch(['threads.net','threads.com'])]},
  {name:'read',help:'Read a post',params:[target],backends:webRead},
 ]},
 {name:'vimeo',description:'Vimeo videos',level:'optional',domains:['vimeo.com'],readAction:'video',actions:[
  {name:'search',help:'Search videos',params:[q,limit()],backends:[siteSearch(['vimeo.com'])],liveTest:{query:'motion graphics reel',limit:2}},
  videoAction(),
 ]},
 {name:'reddit',description:'Reddit search, posts and comments',level:'optional',domains:['reddit.com','redd.it'],loginUrl:'https://www.reddit.com/login/',loginCookies:['reddit_session','token_v2'],readAction:'read',actions:[
  {name:'search',help:'Search posts',params:[q,limit(),{name:'subreddit',help:'only this subreddit',default:''}],backends:[oc('reddit','search')],liveTest:{query:'motion design',limit:2},publicWeb:['reddit.com/r/'],browser:true},
  {name:'read',help:'A post with its comments',params:[{name:'target',help:'post link or id',required:true},limit(25)],backends:[oc('reddit','read',{target:'post-id'}),...webRead],browser:true},
  {name:'subreddit',help:'Posts of a subreddit',params:[{name:'name',help:'subreddit name',required:true},limit(10)],backends:[oc('reddit','subreddit')],browser:true},
 ]},
 {name:'linkedin',description:'LinkedIn company pages and posts (B2B brands)',level:'optional',domains:['linkedin.com'],loginUrl:'https://www.linkedin.com/login',loginCookies:['li_at'],readAction:'read',actions:[
  {name:'company',help:'A company page',params:[{name:'company',help:'company name or link',required:true}],backends:[oc('linkedin','company')],browser:true},
  {name:'posts',help:'Posts of a profile or company',params:[{name:'profile_url',help:'profile or company link',required:true},limit(10)],backends:[oc('linkedin','posts',{profile_url:'profile-url'})],browser:true},
  {name:'read',help:'Read a public LinkedIn page',params:[target],backends:webRead},
 ]},
 {name:'bluesky',description:'Bluesky search, profiles and trends (public)',level:'optional',domains:['bsky.app'],actions:[
  {name:'search',help:'Search posts',params:[q,limit()],backends:[oc('bluesky','search')],liveTest:{query:'design',limit:2}},
  {name:'profile',help:'A profile',params:[{name:'handle',help:'handle',required:true}],backends:[oc('bluesky','profile')]},
  {name:'posts',help:'A user\'s posts',params:[{name:'handle',help:'handle',required:true},limit(10)],backends:[oc('bluesky','user')]},
  {name:'trending',help:'Trending topics',params:[limit(10)],backends:[oc('bluesky','trending')]},
 ]},
 {name:'producthunt',description:'Product Hunt launches (SaaS and app promos)',level:'optional',domains:['producthunt.com'],readAction:'read',actions:[
  {name:'today',help:'Today\'s launches',params:[limit(10)],backends:[oc('producthunt','today')],liveTest:{limit:2}},
  {name:'posts',help:'Recent launches, optionally by category',params:[limit(10),{name:'category',help:'category',default:''}],backends:[oc('producthunt','posts')]},
  {name:'read',help:'Read a launch page',params:[target],backends:webRead},
 ]},
 {name:'google',description:'Google images, trends and news',level:'optional',domains:[],actions:[
  {name:'images',help:'Image search (references only)',params:[q,limit(10)],backends:[oc('google','images',{query:'keyword'})],browser:true},
  {name:'trends',help:'Trending searches by region',params:[{name:'region',help:'country code',default:'US'},limit(10)],backends:[oc('google','trends')],liveTest:{region:'US',limit:2}},
  {name:'news',help:'News search',params:[q,limit(10)],backends:[oc('google','news',{query:'keyword'})]},
 ]},
 {name:'github',description:'GitHub repositories (open-source animation code, Lottie files, tools)',level:'optional',domains:['github.com'],readAction:'read',actions:[
  {name:'search',help:'Search repositories',params:[q,limit()],backends:[['github-api',async(p,c)=>{
   const r=await fetch(`https://api.github.com/search/repositories?${new URLSearchParams({q:p.query,per_page:String(Math.min(p.limit,30))})}`,{headers:{accept:'application/vnd.github+json','user-agent':'dimensaz-reach'},signal:AbortSignal.timeout(c.timeout*1000)});
   if(r.status===403||r.status===429)throw new ReachError('RATE_LIMITED','GitHub API rate limit');if(!r.ok)throw new ReachError('UPSTREAM_BROKEN','GitHub API '+r.status);
   const d=await r.json() as {items:{full_name:string;html_url:string;description:string|null;owner:{login:string};pushed_at:string;stargazers_count:number;license:{spdx_id:string}|null}[]};
   return d.items.map(i=>makeItem({title:i.full_name,url:i.html_url,author:i.owner.login,published_at:i.pushed_at,text:i.description??'',raw:{stars:i.stargazers_count,license:i.license?.spdx_id??null}}));
  }],siteSearch(['github.com'])],liveTest:{query:'lottie animation',limit:2}},
  {name:'read',help:'Read a repository page or README',params:[target],backends:webRead},
 ]},
];

export const channelByName=(name:string)=>{
 const alias:Record<string,string>={twitter:'x',yt:'youtube',ig:'instagram',fb:'facebook'};
 const c=channels.find(x=>x.name===(alias[name]??name));
 if(!c)throw new ReachError('BAD_INPUT',`Unknown channel "${name}". Channels: ${channels.map(x=>x.name).join(', ')}`);
 return c;
};
/** Picks the channel, action and arguments for a link (`reach read URL`). */
export function routeUrl(url:string):{channel:Channel;action:string;params:Record<string,unknown>}{
 const u=publicUrl(url);const {pathname}=new URL(u);const seg=pathname.split('/').filter(Boolean);
 const c=channels.find(x=>x.domains.length&&hostMatches(u,...x.domains))??channelByName('web');
 const r=(action:string,params:Record<string,unknown>={target:u})=>({channel:c,action,params});
 switch(c.name){
  case 'youtube':return /^\/(watch|shorts|live)\b/.test(pathname)||hostMatches(u,'youtu.be')?r('video'):seg[0]?.startsWith('@')||seg[0]==='channel'||seg[0]==='c'?r('channel',{id:u}):r('video');
  case 'instagram':return ['p','reel','reels','tv'].includes(seg[0]??'')?r('video'):seg[0]?r('profile',{username:seg[0]}):r('video');
  case 'tiktok':return pathname.includes('/video/')||pathname.includes('/photo/')?r('video'):seg[0]?.startsWith('@')?r('user',{username:seg[0].slice(1)}):r('video');
  case 'x':return seg[1]==='status'&&seg[2]?r('thread',{id:seg[2]}):seg[0]&&!['i','search','explore','home'].includes(seg[0])?r('profile',{username:seg[0]}):r('video');
  case 'facebook':return hostMatches(u,'fb.watch')||/\/(videos|watch|reel|share\/v|share\/r)\b/.test(pathname)?r('video'):seg[0]&&seg[0]!=='profile.php'?r('profile',{username:seg[0]}):r('video');
  case 'pinterest':return seg[0]==='pin'||hostMatches(u,'pin.it')?r('pin'):seg.length>=2?r('board',{board:u}):seg[0]?r('user',{username:seg[0]}):r('pin');
  case 'reddit':return pathname.includes('/comments/')||hostMatches(u,'redd.it')?r('read'):seg[0]==='r'&&seg[1]?r('subreddit',{name:seg[1]}):r('read');
  case 'dribbble':return seg[0]==='shots'?r('shot'):seg[0]?r('designer',{designer:seg[0]}):r('shot');
  case 'bluesky':return seg[0]==='profile'&&seg[1]?r('profile',{handle:seg[1]}):{channel:channelByName('web'),action:'read',params:{target:u}};
  default:return r(c.readAction??'read');
 }
}
export const needsBrowser=(a:Action)=>!!a.browser;
