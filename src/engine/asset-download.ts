import https from 'node:https';
import {lookup} from 'node:dns';

export class DownloadError extends Error {
 constructor(message:string,public recovery:'retry'|'permission'|'alternate'|'invalid'){super(message);}
}
export function publicAddress(ip:string){
 if(ip.includes(':'))return false;
 const [a,b]=ip.split('.').map(Number);
 return !([0,10,127].includes(a)||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19));
}
export type Transport=(url:URL,limit:number)=>Promise<{status:number;location?:string;bytes:Buffer}>;
const transport:Transport=(url,limit)=>new Promise((resolve,reject)=>{
 const req=https.get(url,{headers:{'User-Agent':'LocalVideoAssetLibrary/1.0'},lookup:(host,options,cb)=>{
  lookup(host,{family:4},(err,address,family)=>{
   if(err)return cb(err,address,family);
   if(!publicAddress(address))return cb(new Error('Non-public address blocked'),address,family);
   if(typeof options==='object'&&options.all)(cb as Function)(null,[{address,family}]);else cb(null,address,family);
  });
 }},res=>{
  const chunks:Buffer[]=[];let size=0;
  res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>limit)req.destroy(new DownloadError('Download exceeds size limit','invalid'));else chunks.push(chunk);});
  res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode||0,location:res.headers.location,bytes:Buffer.concat(chunks)}));
 });
 const timer=setTimeout(()=>req.destroy(new DownloadError('Download timed out','retry')),20000);
 req.on('close',()=>clearTimeout(timer));req.on('error',reject);
});
export async function download(url:string,hosts:string[],options:{limit?:number;transport?:Transport;sleep?:(ms:number)=>Promise<void>}={}){
 let current=new URL(url);const limit=options.limit??25*1024*1024;
 const pause=options.sleep??(ms=>new Promise(r=>setTimeout(r,ms)));
 for(let redirects=0;redirects<=5;redirects++){
  if(current.protocol!=='https:'||current.username||current.password||current.port&&current.port!=='443'||!hosts.includes(current.hostname))throw new DownloadError('URL or redirect host is not authorized','permission');
  let response:Awaited<ReturnType<Transport>>|undefined;
  for(let attempt=0;attempt<3;attempt++){
   try{
    response=await (options.transport??transport)(current,limit);
    if(response.bytes.length>limit)throw new DownloadError('Download exceeds size limit','invalid');
    if([408,429,500,502,503,504].includes(response.status))throw new DownloadError('Temporary HTTP '+response.status,'retry');
    break;
   }catch(error){
    const code=(error as NodeJS.ErrnoException).code;
    const retry=error instanceof DownloadError?error.recovery==='retry':['ECONNRESET','ETIMEDOUT','EAI_AGAIN','ECONNREFUSED'].includes(code||'');
    if(!retry||attempt===2)throw error;
    await pause(250*2**attempt);
   }
  }
  if(!response)throw new Error('No response');
  if([301,302,303,307,308].includes(response.status)&&response.location){current=new URL(response.location,current);continue;}
  if(response.status!==200)throw new DownloadError('HTTP '+response.status,[401,403].includes(response.status)?'permission':'alternate');
  return {bytes:response.bytes,finalUrl:current.href};
 }
 throw new DownloadError('Redirect limit exceeded','alternate');
}

