// Page backend: opens a page in the Tempoloom browser and reads what is shown (OpenCLI browser
// commands: open, extract, a read-only meta lookup), for when a site's data API refuses but
// the page itself works. Used for Instagram profiles and posts.
import {ReachError,makeItem,type Item} from '../result.js';
import {opencliMain,run,CommandFailed} from '../tools.js';
import {ensureRunning,loadBrowserState,touch,saveSession} from '../browser.js';
import {publicUrl} from '../safety.js';

export type PageRead={url:string;title:string|null;content:string;meta:Record<string,string>};
type PageReader=(url:string,timeout:number)=>Promise<PageRead>;

const META_JS=`(()=>{const o={};for(const m of document.querySelectorAll('meta[property],meta[name]')){const k=m.getAttribute('property')||m.getAttribute('name');if(/^(og:|description$|twitter:)/.test(k))o[k]=m.getAttribute('content')||'';}return o;})()`;

export const readPageLive:PageReader=async(target,timeout)=>{
 const url=publicUrl(target);
 await ensureRunning();
 const env={OPENCLI_PROFILE:loadBrowserState().contextId??'',OPENCLI_CDP_ENDPOINT:'',OPENCLI_CDP_TARGET:'',OPENCLI_WINDOW:'background'};
 const session='tempoloom-reach-'+process.pid;
 const oc=async(args:string[])=>{
  try{const out=await run(process.execPath,[opencliMain(),'browser','--session',session,...args],{timeout:Math.max(10,timeout/3),env,label:'OpenCLI browser'});
   const d=JSON.parse(out.slice(out.search(/[[{]/)));if(d?.ok===false)throw new ReachError('UPSTREAM_BROKEN',String(d.error?.message??'browser command failed'));return d.data;}
  catch(e){if(e instanceof CommandFailed)throw new ReachError('UPSTREAM_BROKEN',e.message);throw e;}
 };
 try{
  touch();
  await oc(['open',url]);
  await oc(['wait','time','2']).catch(()=>undefined);
  const ex=await oc(['extract']) as {url?:string;title?:string;content?:string};
  const meta=await oc(['eval',META_JS]).catch(()=>({})) as Record<string,string>;
  return {url:ex.url??url,title:ex.title??null,content:ex.content??'',meta:meta&&typeof meta==='object'?meta:{}};
 }finally{await oc(['close']).catch(()=>undefined);touch();await saveSession().catch(()=>undefined);}
};
let reader:PageReader=readPageLive;
export const setPageReader=(r:PageReader|null)=>{reader=r??readPageLive;}; // tests
export const readPage:PageReader=(u,t)=>reader(u,t);

const LOGIN_WALL=/log in to instagram|sign up to see photos|login • instagram/i;
/** Post links with their captions from an Instagram profile page. */
export function instagramPosts(content:string,limit=12):Item[]{
 const re=/\[\s*!\[([\s\S]*?)\]\((https:\/\/[^)\s]+)\)\s*\]\((\/[\w.]+\/(?:p|reel|tv)\/[\w-]+\/?)\)/g;
 const out:Item[]=[];const seen=new Set<string>();
 for(const m of content.matchAll(re)){
  const link='https://www.instagram.com'+m[3]!;if(seen.has(link))continue;seen.add(link);
  const caption=m[1]!.replace(/\\_/g,'_').trim();
  out.push(makeItem({title:caption.split('\n')[0]!.slice(0,120)||null,url:link,author:m[3]!.split('/')[1]!,text:caption,raw:{image:m[2],kind:m[3]!.includes('/reel/')?'reel':'post'}}));
  if(out.length>=limit)break;
 }
 return out;
}
const num=(s?:string)=>{if(!s)return null;const m=s.replace(/,/g,'').match(/([\d.]+)\s*([KMB])?/i);if(!m)return null;return Math.round(Number(m[1])*({K:1e3,M:1e6,B:1e9}[(m[2]??'').toUpperCase() as 'K']??1));};
/** Profile facts from an Instagram profile page's meta tags. */
export function instagramProfile(page:PageRead,username:string):Item{
 const d=page.meta['og:description']||page.meta.description||'';
 const followers=d.match(/([\d.,]+\s*[KMB]?)\s+Followers/i)?.[1],following=d.match(/([\d.,]+\s*[KMB]?)\s+Following/i)?.[1],posts=d.match(/([\d.,]+\s*[KMB]?)\s+Posts/i)?.[1];
 const name=(page.meta['og:title']||'').replace(/\s*\(@[\w.]+\).*$/,'').replace(/\s*•.*$/,'').trim()||null;
 const bio=d.split(/\s+-\s+/).slice(1).join(' - ').replace(/^See Instagram photos and videos from .*$/i,'').trim();
 return makeItem({title:name??username,url:`https://www.instagram.com/${username}/`,author:username,text:bio||d,
  raw:{username,name,followers:num(followers),following:num(following),posts:num(posts),description:d,source:'profile page'}});
}
export async function instagramPage(kind:'profile'|'posts',username:string,limit:number,timeout:number){
 if(!/^[\w.]{1,30}$/.test(username))throw new ReachError('BAD_INPUT','Not an Instagram user name: '+username);
 const page=await readPage(`https://www.instagram.com/${username}/`,timeout);
 if(LOGIN_WALL.test(page.title??'')||(LOGIN_WALL.test(page.content.slice(0,2000))&&!/\/(p|reel)\//.test(page.content)))
  throw new ReachError('NEED_LOGIN','Instagram showed its login page','Run pnpm tempoloom reach login instagram and ask the user to log in in the window.');
 if(kind==='profile'){const item=instagramProfile(page,username);if(!page.meta['og:description']&&!page.content.trim())throw new ReachError('UPSTREAM_BROKEN','The profile page was empty');return [item];}
 const posts=instagramPosts(page.content,limit);
 if(!posts.length)throw new ReachError('UPSTREAM_BROKEN','No posts found on the profile page (private account, or the page changed)');
 return posts;
}
