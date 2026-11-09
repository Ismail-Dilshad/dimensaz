// Shared sourcing layer: the result shape every provider returns, the license policy that
// decides what may appear in a final video, safe downloads, and storage with a license
// record next to every file. Downloads go to workspace/downloads (never committed).
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT} from '../config.js';

export const kinds=['model','texture','hdri','image','icon','video','sound','music'] as const;
export type Kind=typeof kinds[number];
/** final: may appear in videos. study: reference only, never in a final video. blocked: not downloaded. */
export type Usage='final'|'study'|'blocked';

export type License={id:string;name:string;url:string|null;usage:Usage;attributionRequired:boolean;reason:string};
export type SourceFile={url:string;path?:string;size?:number;md5?:string};
export type SourceItem={provider:string;id:string;kind:Kind;title:string;page:string;preview:string|null;
 creator:string|null;creatorUrl:string|null;license:License;files:SourceFile[];width?:number;height?:number;duration?:number;tags?:string[];
 attribution:string;credit?:string};

export const USER_AGENT='Dimensaz/4 (open-source video agent; +https://github.com/Ismail-Dilshad/dimensaz)';
const MAX_DOWNLOAD=Number(process.env.SOURCE_MAX_MB||'400')*1024*1024;

/** Maps a license name or URL to how it may be used. Unknown licenses are blocked. */
export function classifyLicense(input:string|null|undefined,url:string|null=null):License{
 const raw=(input??'').trim(),key=raw.toLowerCase().replace(/[\s_]+/g,'-'),u=(url??'').toLowerCase();
 const has=(...parts:string[])=>parts.some(p=>key.includes(p)||u.includes(p));
 const make=(id:string,name:string,usage:Usage,attributionRequired:boolean,reason:string):License=>({id,name,url,usage,attributionRequired,reason});
 if(!raw&&!url)return make('unknown','Unknown','blocked',false,'No license recorded');
 if(has('cc0','publicdomain/zero','public-domain','pdm','publicdomain/mark'))return make('CC0-1.0','CC0 / public domain','final',false,'No restrictions');
 if(has('pexels'))return make('Pexels','Pexels License','final',false,'Free to use and modify; do not sell unaltered copies or imply endorsement');
 if(has('pixabay'))return make('Pixabay','Pixabay Content License','final',false,'Free to use and modify; do not sell unaltered copies or use in trademarks');
 if(has('-nc','by-nc','noncommercial','non-commercial','/nc'))return make('CC-NC','Creative Commons NonCommercial','blocked',true,'Non-commercial only; promos and sponsored videos are commercial');
 if(has('-nd','by-nd','noderivs','/nd'))return make('CC-ND','Creative Commons NoDerivatives','blocked',true,'No modification allowed');
 if(has('by-sa','sharealike','/by-sa'))return make('CC-BY-SA','Creative Commons Attribution-ShareAlike','study',true,'Share-alike would bind the whole video; study only');
 if(has('cc-by','/by/','attribution','cc by')||key==='by'||key.startsWith('by-'))return make('CC-BY','Creative Commons Attribution','final',true,'Allowed with credit to the creator');
 if(/(^|[^a-z])(mit|apache|isc|bsd|ofl|unlicense|zlib)([^a-z]|$)/.test(key)||has('open-font','opensource.org/licenses/mit','apache.org/licenses'))return make(raw||'permissive','Permissive open license ('+(raw||url)+')','final',false,'Permissive license');
 if(has('gpl','agpl','lgpl'))return make(raw,'Copyleft ('+raw+')','study',false,'Copyleft; study only');
 return make(raw||'unknown','Unrecognised license ('+(raw||url)+')','blocked',false,'Unrecognised license; check it by hand before use');
}

export function attributionLine(i:{title:string;creator:string|null;provider:string;license:License;page:string}){
 return `"${i.title}"${i.creator?' by '+i.creator:''} via ${i.provider}, ${i.license.name}${i.license.url?' ('+i.license.url+')':''}: ${i.page}`;
}

export async function getJson<T=unknown>(url:string,{fetcher=fetch,headers={}}:{fetcher?:typeof fetch;headers?:Record<string,string>}={}):Promise<T>{
 const r=await fetcher(url,{headers:{'user-agent':USER_AGENT,accept:'application/json',...headers}});
 if(!r.ok)throw new Error(`${new URL(url).hostname} answered ${r.status}: ${(await r.text()).slice(0,200)}`);
 return await r.json() as T;
}

export async function download(url:string,file:string,{fetcher=fetch,headers={}}:{fetcher?:typeof fetch;headers?:Record<string,string>}={}){
 const r=await fetcher(url,{headers:{'user-agent':USER_AGENT,...headers},redirect:'follow'});
 if(!r.ok)throw new Error(`Download failed (${r.status}): ${url}`);
 const length=Number(r.headers.get('content-length')||0);
 if(length>MAX_DOWNLOAD)throw new Error(`File is ${Math.round(length/1048576)} MB, over the ${MAX_DOWNLOAD/1048576} MB limit (SOURCE_MAX_MB)`);
 const bytes=Buffer.from(await r.arrayBuffer());
 if(bytes.length>MAX_DOWNLOAD)throw new Error('Download exceeded the size limit');
 await fs.mkdir(path.dirname(file),{recursive:true});
 await fs.writeFile(file,bytes,{flag:'wx'});
 return {file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),type:r.headers.get('content-type')??''};
}

export const downloadsRoot=()=>path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','downloads');
const safe=(s:string)=>s.normalize('NFKD').replace(/[^\w.-]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'item';

/** Saves every file of an item with its license record. Blocked licenses are refused. */
export async function store(item:SourceItem,{fetcher=fetch,root=downloadsRoot(),headers={}}:{fetcher?:typeof fetch;root?:string;headers?:Record<string,string>}={}){
 if(item.license.usage==='blocked')throw new Error(`Not downloaded: ${item.license.name}. ${item.license.reason}.`);
 const folder=path.join(root,item.kind,`${safe(item.provider)}-${safe(item.id)}`);
 const record=path.join(folder,'source.json');
 try{const existing=JSON.parse(await fs.readFile(record,'utf8'));return {...existing,folder,cached:true};}catch{/* new */}
 const saved:{name:string;bytes:number;sha256:string;url:string}[]=[];
 for(const [i,f] of item.files.entries()){
  const name=f.path?f.path.replace(/\\/g,'/').replace(/^\/+/,''):`${safe(item.title)}${i?'-'+i:''}${path.extname(new URL(f.url).pathname)||''}`;
  const target=path.resolve(folder,name);
  if(!target.startsWith(path.resolve(folder)+path.sep))throw new Error('Unsafe file path from provider: '+name);
  const r=await download(f.url,target,{fetcher,headers});
  saved.push({name,bytes:r.bytes,sha256:r.sha256,url:f.url});
 }
 const entry={version:1,provider:item.provider,id:item.id,kind:item.kind,title:item.title,page:item.page,creator:item.creator,creatorUrl:item.creatorUrl,
  license:item.license,attribution:item.attribution,credit:item.credit??null,downloadedAt:new Date().toISOString(),files:saved,
  usage:item.license.usage==='final'?'May be used in final videos'+(item.license.attributionRequired?' with the attribution line in the description or credits':''):'Study and reference only; never in a final video'};
 await fs.writeFile(record,JSON.stringify(entry,null,1)+'\n');
 return {...entry,folder,cached:false};
}
