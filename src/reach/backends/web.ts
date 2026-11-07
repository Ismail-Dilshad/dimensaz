// Public web backends (Agent Reach channels/web.py): Jina Reader reads any page as clean text,
// Exa's free hosted search (no key) searches the web and reads pages as a second route.
import {ReachError,makeItem,type Item} from '../result.js';
import {publicUrl} from '../safety.js';

const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const MAX_BYTES=5*1024*1024;
export const EXA_MCP='https://mcp.exa.ai/mcp';
let fetcher:typeof fetch=(...a)=>fetch(...a);
export const setWebFetcher=(f:typeof fetch|null)=>{fetcher=f??((...a)=>fetch(...a));}; // tests

async function getText(url:string,init:RequestInit,timeout:number){
 const r=await fetcher(url,{...init,signal:AbortSignal.timeout(Math.max(1,timeout)*1000)}).catch(e=>{
  if((e as Error).name==='TimeoutError')throw new ReachError('TIMEOUT','did not answer in time');throw new ReachError('UPSTREAM_BROKEN','network error: '+((e as {cause?:{code?:string}}).cause?.code??(e as Error).message));});
 const body=await r.text();
 if(body.length>MAX_BYTES)throw new ReachError('UPSTREAM_BROKEN','Response is larger than 5 MB');
 if(r.status===429)throw new ReachError('RATE_LIMITED','HTTP 429');
 if(r.status===404)throw new ReachError('NOT_FOUND','HTTP 404');
 if(!r.ok)throw new ReachError('UPSTREAM_BROKEN',`HTTP ${r.status}: ${body.slice(0,200)}`);
 return body;
}

const ANTIBOT=/just a moment|attention required|cf-browser-verification|captcha|verify you are human|access denied/i;
export function parseJina(url:string,body:string):Item{
 const title=body.match(/^Title:\s*(.*)$/m)?.[1]?.trim();const published=body.match(/^Published Time:\s*(.*)$/m)?.[1]?.trim();
 const content=body.includes('Markdown Content:')?body.split('Markdown Content:').slice(1).join('Markdown Content:'):body;
 return makeItem({title,url,published_at:published,text:content.trim()});
}
export async function jinaRead({target,timeout}:{target:string;timeout:number}){
 const url=publicUrl(target);
 const body=await getText('https://r.jina.ai/'+url,{headers:{'user-agent':UA,accept:'text/plain'}},timeout);
 if(ANTIBOT.test(body.slice(0,4096))&&/warning:.*captcha|just a moment/i.test(body.slice(0,4096)))throw new ReachError('UPSTREAM_BROKEN','The page answered with a bot check; use the site channel or the browser');
 return [parseJina(url,body)];
}

export function parseExa(text:string):Item[]{
 const items:Item[]=[];
 for(const block of ('\n'+text.trim()).split(/\n(?=Title: )/)){
  const b=block.trim();if(!b.startsWith('Title:'))continue;
  const lines=b.split('\n');const fields:Record<string,string>={};let i=0;
  for(;i<lines.length;i++){const m=lines[i]!.match(/^(Title|URL|Published|Author|Published Date):\s*(.*)$/);if(!m)break;fields[m[1]!.toLowerCase().replace(' date','')]=m[2]!.trim();}
  const na=(v?:string)=>!v||v==='N/A'?null:v;
  items.push(makeItem({title:na(fields.title),url:na(fields.url),author:na(fields.author),published_at:na(fields.published),
   text:lines.slice(i).filter(l=>!['Highlights:','Text:'].includes(l.trim())).join('\n').trim(),raw:fields}));
 }
 return items;
}
async function exaCall(tool:string,args:Record<string,unknown>,timeout:number){
 const body=await getText(EXA_MCP,{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream'},
  body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:tool,arguments:args}})},timeout);
 const payloads=body.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trim());
 let msg:{error?:{message?:string};result?:{content?:{type:string;text?:string}[];isError?:boolean}};
 try{msg=JSON.parse(payloads.at(-1)??body);}catch{throw new ReachError('UPSTREAM_BROKEN','Exa returned an unreadable answer');}
 const text=(msg.result?.content??[]).filter(c=>c.type==='text').map(c=>c.text??'').join('\n');
 const err=msg.error?.message??(msg.result?.isError?text:'');
 if(err){if(/429|rate.?limit|too many|quota|credits?/i.test(err))throw new ReachError('RATE_LIMITED','Exa: '+err.slice(0,200));throw new ReachError('UPSTREAM_BROKEN','Exa: '+err.slice(0,200));}
 return text;
}
export async function exaSearch({query,limit=5,timeout}:{query:string;limit?:number;timeout:number}){
 const items=parseExa(await exaCall('web_search_exa',{query,objective:query,numResults:limit},timeout));
 if(!items.length)throw new ReachError('UPSTREAM_BROKEN','Exa returned no recognizable results');
 return items.slice(0,limit);
}
export async function exaRead({target,timeout}:{target:string;timeout:number}){
 const url=publicUrl(target);
 const text=await exaCall('web_fetch_exa',{urls:[url],maxCharacters:20000},timeout);
 const items=parseExa(text);if(items.length){items[0]!.url??=url;return items.slice(0,1);}
 if(!text.trim())throw new ReachError('UPSTREAM_BROKEN','Exa returned no content');
 return [makeItem({url,text:text.trim()})];
}
