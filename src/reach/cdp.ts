// Minimal Chrome DevTools Protocol client for the dedicated browser (browser-level calls:
// cookies, version, targets). Loopback only.
import {ReachError} from './result.js';

export const cdpUrl=(port:number)=>`http://127.0.0.1:${port}`;

export async function cdpJson<T=unknown>(port:number,pathname:string,timeoutMs=3000):Promise<T|null>{
 try{const r=await fetch(cdpUrl(port)+pathname,{signal:AbortSignal.timeout(timeoutMs)});return r.ok?await r.json() as T:null;}catch{return null;}
}

/** One browser-level CDP call. */
export async function cdpCall<T=Record<string,unknown>>(port:number,method:string,params:Record<string,unknown>={},timeoutMs=10000):Promise<T>{
 const version=await cdpJson<{webSocketDebuggerUrl?:string}>(port,'/json/version');
 if(!version?.webSocketDebuggerUrl)throw new ReachError('NEED_SETUP','The Tempoloom browser is not running');
 return new Promise<T>((resolve,reject)=>{
  const ws=new WebSocket(version.webSocketDebuggerUrl!);
  const timer=setTimeout(()=>{ws.close();reject(new ReachError('TIMEOUT','The browser did not answer '+method));},timeoutMs);
  ws.onopen=()=>ws.send(JSON.stringify({id:1,method,params}));
  ws.onerror=()=>{clearTimeout(timer);reject(new ReachError('UPSTREAM_BROKEN','Lost the connection to the Tempoloom browser'));};
  ws.onmessage=ev=>{const m=JSON.parse(String(ev.data));if(m.id!==1)return;clearTimeout(timer);ws.close();
   m.error?reject(new ReachError('UPSTREAM_BROKEN',`${method}: ${m.error.message}`)):resolve(m.result as T);};
 });
}

export type Cookie={name:string;value:string;domain:string;path?:string;expires?:number;secure?:boolean;httpOnly?:boolean;sameSite?:'Strict'|'Lax'|'None'};
export const domainMatches=(cookieDomain:string,domain:string)=>{const c=cookieDomain.replace(/^\./,'').toLowerCase(),d=domain.replace(/^\./,'').toLowerCase();return c===d||c.endsWith('.'+d);};
export const getCookies=async(port:number)=>(await cdpCall<{cookies:Cookie[]}>(port,'Storage.getCookies')).cookies;
export const setCookies=(port:number,cookies:Cookie[])=>cookies.length?cdpCall(port,'Storage.setCookies',{cookies}):Promise.resolve({});
