// The Teach page's local server. It listens on this computer only (127.0.0.1), needs the key in
// the link it prints, and never sends a video anywhere: uploads go to the temporary study folder
// and are deleted once learned.
import http from 'node:http';
import {z} from 'zod';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {ROOT} from '../engine/config.js';
import * as T from '../engine/teach/teach.js';
import {hasApiKey} from '../engine/transcribe.js';
import * as R from '../engine/studio-requests.js';
import {deleteJob,rate,pick,approve,archive,feedback as jobFeedback} from '../engine/studio.js';
import {home} from '../engine/home.js';
import * as Taste from '../engine/taste.js';
import * as G from '../engine/gallery.js';
import {live,liveJobs} from '../engine/studio-live.js';
import {events,FACES} from '../engine/studio-events.js';
import * as Settings from '../engine/models/settings.js';
import {providerById,LOCAL_PRESETS} from '../engine/models/providers.js';
import * as Backup from '../engine/backup.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const MAX_MB=Number(process.env.TEACH_MAX_MB||'2048');
const UI=new Set(['app.css','core.js','home.js','taste.js','teach.js','learned.js','studio.js','gallery.js','live.js','settings.js','backup.js']);
const TYPES:Record<string,string>={'.js':'text/javascript; charset=utf-8','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mp4':'video/mp4','.jpg':'image/jpeg','.svg':'image/svg+xml','.ttf':'font/ttf','.json':'application/json; charset=utf-8',
 '.png':'image/png','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.webm':'video/webm','.mov':'video/quicktime','.m4v':'video/mp4','.mp3':'audio/mpeg','.wav':'audio/wav','.m4a':'audio/mp4'};
class HttpError extends Error{constructor(public status:number,message:string){super(message);}}

export async function serve(o:{port?:number;fetcher?:typeof fetch}={}){
 const key=randomBytes(12).toString('hex');
 const cropping=new Set<string>();
 const linkPreviews=new Map<string,{url:string;expires:number;busy:boolean;choices:{id:string;item:number}[]}>();
 const linkInput=z.object({url:z.string().url(),confirm:z.boolean().default(false),previewToken:z.string().optional(),selection:z.object({id:z.string().min(1),item:z.number().int().positive()}).optional()}).strict();
 // A video left "measuring" by a server that stopped is marked failed, so it can be sent again or removed.
 T.recover();
 await Settings.loadKeys().catch(()=>0);
 const fetcher=o.fetcher??fetch;
 const uploads=new Map<string,{bytes:Uint8Array;expires:number}>();
 let busy=Promise.resolve();
 const queue=(job:()=>Promise<unknown>)=>{busy=busy.then(job).then(()=>undefined,()=>undefined);};

 const json=(res:http.ServerResponse,body:unknown,status=200)=>{const b=JSON.stringify(body);res.writeHead(status,{'content-type':TYPES['.json']!,'cache-control':'no-store'});res.end(b);};
 const body=async(req:http.IncomingMessage)=>{const chunks:Buffer[]=[];let n=0;for await(const c of req){n+=(c as Buffer).length;if(n>200_000)throw new HttpError(413,'Too much data');chunks.push(c as Buffer);}
  try{return chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string,unknown>:{};}catch{throw new HttpError(400,'Not JSON');}};
 const file=async(req:http.IncomingMessage,res:http.ServerResponse,f:string,cache='no-store')=>{
  let st;try{st=await fsp.stat(f);}catch{throw new HttpError(404,'Not found');}
  if(new URL(req.url??'/','http://x').searchParams.get('dl')==='1')res.setHeader('content-disposition',`attachment; filename*=UTF-8''${encodeURIComponent(path.basename(f))}`);
  const type=TYPES[path.extname(f).toLowerCase()]??'application/octet-stream',range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range??'');
  if(range&&(range[1]||range[2])){
   const start=range[1]?Number(range[1]):Math.max(0,st.size-Number(range[2])),end=range[1]&&range[2]?Math.min(Number(range[2]),st.size-1):st.size-1;
   if(start>end||start>=st.size){res.writeHead(416,{'content-range':`bytes */${st.size}`});return void res.end();}
   res.writeHead(206,{'content-type':type,'content-range':`bytes ${start}-${end}/${st.size}`,'accept-ranges':'bytes','content-length':end-start+1,'cache-control':cache});
   return void await pipeline(fs.createReadStream(f,{start,end}),res).catch(()=>undefined);
  }
  res.writeHead(200,{'content-type':type,'content-length':st.size,'accept-ranges':'bytes','cache-control':cache});
  await pipeline(fs.createReadStream(f),res).catch(()=>undefined);
 };

 const server=http.createServer(async(req,res)=>{
  try{
   const address=server.address() as {port:number},url=new URL(req.url??'/',`http://127.0.0.1:${address.port}`),p=url.pathname,m=req.method??'GET';
   // Only this computer's own page may talk to the server.
   const host=(req.headers.host??'').toLowerCase();
   if(host!==`127.0.0.1:${address.port}`&&host!==`localhost:${address.port}`)throw new HttpError(403,'Open the Teach page with the link from the terminal');
   const origin=req.headers.origin;if(origin&&origin!==`http://${host}`)throw new HttpError(403,'Wrong origin');
// The fonts and the logo are the project's own public files; everything else needs the key.
   if(m==='GET'&&UI.has(p.slice(1)))return await file(req,res,path.join(here,'ui',p.slice(1)));
   if(m==='GET'&&p==='/font.ttf')return await file(req,res,path.join(ROOT,'assets/fonts/open/Fredoka-Variable.ttf'),'max-age=86400');
   if(m==='GET'&&p==='/font-ar.ttf')return await file(req,res,path.join(ROOT,'assets/fonts/open/Vazirmatn-Variable.ttf'),'max-age=86400');
   if(m==='GET'&&p==='/logo-light.svg')return await file(req,res,path.join(ROOT,'assets/brand/logo/svg/tempoloom-wordmark-for-light.svg'),'max-age=86400');
   const face=/^\/mascot\/([a-z-]+)\.svg$/.exec(p);
   if(m==='GET'&&face&&(FACES as readonly string[]).includes(face[1]!))return await file(req,res,path.join(ROOT,'assets/brand/expressions/svg',`mascot-${face[1]}.svg`),'max-age=86400');
   if(m==='GET'&&p==='/logo.svg')return await file(req,res,path.join(ROOT,'assets/brand/logo/svg/tempoloom-wordmark-for-dark.svg'),'max-age=86400');
      const given=Buffer.from(String(req.headers['x-teach-key']??url.searchParams.get('k')??'')),want=Buffer.from(key);
   if(given.length!==want.length||!timingSafeEqual(given,want))throw new HttpError(403,'Open the Teach page with the link from the terminal (pnpm tempoloom teach open)');
   res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','no-referrer');

   if(m==='GET'&&p==='/'){res.setHeader('content-security-policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' blob: https:; frame-src https://www.youtube-nocookie.com https://www.instagram.com https://www.tiktok.com https://player.vimeo.com; frame-ancestors 'none'");return await file(req,res,path.join(here,'ui','index.html'));}
   if(m==='GET'&&p==='/api/home')return json(res,home());
   // ---------- the gallery: every video the agent made ----------
   if(m==='GET'&&p==='/api/gallery')return json(res,await G.gallery({hidden:url.searchParams.get('hidden')==='1'}));
   const gf=/^\/gallery\/(file|thumb)\/([a-f0-9]{16})$/.exec(p);
   if(m==='GET'&&gf){let f:string;try{f=gf[1]==='thumb'?await G.galleryThumb(gf[2]!):await G.galleryFile(gf[2]!);}catch{throw new HttpError(404,'Not found');}return await file(req,res,f,gf[1]==='thumb'?'max-age=3600':'no-store');}
   const ga=/^\/api\/gallery\/([a-f0-9]{16})\/(star|hide|teach|rate)$/.exec(p);
   const gd=/^\/api\/gallery\/([a-f0-9]{16})$/.exec(p);
   if(m==='DELETE'&&gd){try{return json(res,await G.deleteVideo(gd[1]!));}catch(e){throw new HttpError(/No such video/.test((e as Error).message)?404:400,(e as Error).message);}}
   if(m==='POST'&&ga){const b=await body(req),[,gid,action]=ga;
    if(action==='star')return json(res,G.star(gid!,b.on!==false));
    if(action==='hide')return json(res,G.hide(gid!,b.on!==false));
    if(action==='rate'){if(b.rating===null)return json(res,G.clearRating(gid!));try{return json(res,await G.rateVideo(gid!,String(b.rating) as 'good',String(b.note??'')));}catch(e){throw new HttpError(/No such video/.test((e as Error).message)?404:400,(e as Error).message);}}
    // Teach from your own video: it becomes a draft on the Teach page, like any upload.
    let f:string;try{f=await G.galleryFile(gid!);}catch{throw new HttpError(404,'Not found');}
    return json(res,await T.draftFromFile(f));}
   if(m==='GET'&&p==='/api/taste')return json(res,Taste.build(url.searchParams.get('profile')||'main'));
   if(m==='POST'&&p==='/api/taste'){const b=await body(req),pid=String(b.profile??'main'),str=(k:string)=>String(b[k]??'');
    switch(String(b.action)){
     case 'create':return json(res,Taste.create(str('name'),{videos:Array.isArray(b.videos)?b.videos.map(String):null}));
     case 'remove':return json(res,Taste.remove(pid));
     case 'rename':return json(res,Taste.rename(pid,str('name')));
     case 'videos':return json(res,Taste.setVideos(pid,Array.isArray(b.videos)?b.videos.map(String):null));
     case 'line':return json(res,Taste.setLine(pid,str('ref'),b.on===true));
     case 'add':{const topic=str('topic');if(!(T.TEACH_TOPICS as readonly string[]).includes(topic))throw new HttpError(400,'Choose a topic');return json(res,Taste.addLine(pid,topic as T.Topic,str('text')));}
     case 'drop':return json(res,Taste.dropLine(pid,str('id')));
     case 'target':{if(b.lo===null||b.lo===undefined)return json(res,Taste.setTarget(pid,str('metric'),null));const lo=Number(b.lo),hi=Number(b.hi);if(!Number.isFinite(lo)||!Number.isFinite(hi))throw new HttpError(400,'Give two numbers');return json(res,Taste.setTarget(pid,str('metric'),{lo,hi}));}
     case 'notes':return json(res,Taste.setNotes(pid,str('notes').slice(0,2000)));
    }
    throw new HttpError(400,'Unknown action');}
   if(m==='POST'&&p==='/api/lessons'){const b=await body(req);return json(res,T.addLesson({text:String(b.text??''),topics:Array.isArray(b.topics)?b.topics.map(String):[],avoid:b.avoid===true}));}
   if(m==='GET'&&p==='/api/state')return json(res,{...T.overview(),can:{speech:hasApiKey(),maxMB:MAX_MB}});

   const media=/^\/media\/([a-z0-9-]+)\/(crop-[a-f0-9]{16}\.mp4|playback\.mp4|preview\.mp4|thumb\.jpg|sheets\/[a-z0-9-]+\.jpg)$/.exec(p);
   if(m==='GET'&&media){const [,id,name]=media;return await file(req,res,name==='playback.mp4'?T.playbackFile(id!):name==='thumb.jpg'?T.thumbFile(id!):path.join(T.studyDir(id!),name!));}

   if(m==='POST'&&p==='/api/upload'){
    const name=path.basename(url.searchParams.get('name')||'video.mp4').slice(0,120),ext=(path.extname(name).toLowerCase().match(/^\.[a-z0-9]{2,5}$/)?.[0])??'.mp4';
    const length=Number(req.headers['content-length']??0);if(length>MAX_MB*1048576)throw new HttpError(413,`The video is over ${MAX_MB} MB. Trim it first, or raise TEACH_MAX_MB.`);
    const id=T.newId(name),dir=T.studyDir(id);await fsp.mkdir(dir,{recursive:true});let size=0;
    const limit=new Transform({transform(c:Buffer,_e,cb){size+=c.length;size>MAX_MB*1048576?cb(new HttpError(413,`The video is over ${MAX_MB} MB`)):cb(null,c);}});
    try{await pipeline(req,limit,fs.createWriteStream(path.join(dir,'source'+ext)));if(!size)throw new HttpError(400,'The upload was empty');return json(res,await T.draft(id,{kind:'upload',name}));}
    catch(e){await fsp.rm(dir,{recursive:true,force:true});throw e instanceof HttpError?e:new HttpError(400,(e as Error).message);}
   }
   if(m==='POST'&&p==='/api/link'){
    const input=linkInput.parse(await body(req));
    if(!input.confirm){
     const result=await T.draftFromLink(input.url,false);
     if(result.status!=='needs-confirmation')throw new HttpError(400,'Preview unavailable');
     for(const [token,v] of linkPreviews)if(v.expires<Date.now())linkPreviews.delete(token);
     if(linkPreviews.size>=64)linkPreviews.delete(linkPreviews.keys().next().value!);
     const token=randomBytes(16).toString('hex');
     linkPreviews.set(token,{url:input.url,expires:Date.now()+20*60*1000,busy:false,choices:result.info.choices.map(v=>({id:v.id,item:v.item}))});
     return json(res,{...result,previewToken:token});
    }
    const preview=linkPreviews.get(input.previewToken??'');
    if(!preview||preview.expires<Date.now()||preview.url!==input.url)throw new HttpError(400,'Preview the link again before downloading');
    const selected=preview.choices.find(v=>v.id===input.selection?.id&&v.item===input.selection.item);
    if(!selected)throw new HttpError(400,'Choose a video from the preview');
    if(preview.busy)throw new HttpError(409,'This video is already downloading');
    preview.busy=true;
    try{const result=await T.draftFromLink(input.url,true,selected);linkPreviews.delete(input.previewToken!);return json(res,result);}
    catch(e){preview.busy=false;throw e;}
   }

   const one=/^\/api\/videos\/([a-z0-9-]+)(\/teach|\/finish|\/crop)?$/.exec(p);
   if(one){const [,id,action]=one;
    if(cropping.has(id!))throw new HttpError(409,'A crop is being prepared for this video. Wait a moment.');
    if(m==='POST'&&action==='/crop'){
     const input=T.cropInput.parse(await body(req));
     if(cropping.has(id!))throw new HttpError(409,'A crop is already being prepared');
     cropping.add(id!);
     try{return json(res,await T.previewCrop(id!,input));}finally{cropping.delete(id!);}
    }
    if(m==='PATCH'&&!action)return json(res,T.renameVideo(id!,(await body(req)).title));
    if(m==='POST'&&action==='/teach'){const input=T.teachInput.safeParse(await body(req));if(!input.success)throw new HttpError(400,input.error.issues[0]?.message??'Check the form');
     if(cropping.has(id!))throw new HttpError(409,'Wait for the crop to finish');
     const v=T.video(id!);if(!['draft','failed'].includes(v.status))throw new HttpError(409,'This video was already sent');
     queue(()=>T.teach(id!,input.data,o.fetcher?{fetcher:o.fetcher}:{}));return json(res,{ok:true});}
    if(m==='POST'&&action==='/finish')return json(res,await T.finish(id!));
    if(m==='DELETE'&&!action){const v=T.video(id!);return json(res,v.status==='learned'?await T.forget(id!):await T.discard(id!));}
   }
   const lesson=/^\/api\/lessons\/([\w.:-]+)$/.exec(p);
   if(m==='POST'&&lesson){const b=await body(req),action=String(b.action);if(!['keep','remove','edit','both'].includes(action))throw new HttpError(400,'Unknown action');
    return json(res,T.review(lesson[1]!,action as 'keep',{...(typeof b.title==='string'?{title:b.title}:{}),...(typeof b.body==='string'?{body:b.body}:{})}));}
   // ---------- the Studio page ----------
   if(m==='GET'&&p==='/studio'){res.setHeader('content-security-policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' blob: https:; frame-src https://www.youtube-nocookie.com https://www.instagram.com https://www.tiktok.com https://player.vimeo.com; frame-ancestors 'none'");return await file(req,res,path.join(here,'ui','index.html'));}
   if(m==='GET'&&p==='/api/studio/state')return json(res,{...R.overview(),taught:T.videos().filter(v=>v.status==='learned').map(v=>({id:v.id,title:v.title})),profiles:Taste.profiles(),can:{maxMB:MAX_MB}});
   if(m==='POST'&&p==='/api/studio/requests')return json(res,R.newRequest());
   const rq=/^\/api\/studio\/requests\/(r-[a-f0-9]{8})(\/files|\/submit)?$/.exec(p);
   if(rq){const [,id,action]=rq;
    if(m==='POST'&&action==='/files'){
     const kind=String(url.searchParams.get('kind')) as R.FileKind,name=url.searchParams.get('name')||'file';
     if(Number(req.headers['content-length']??0)>MAX_MB*1048576)throw new HttpError(413,`The file is over ${MAX_MB} MB`);
     const target=R.filePath(id!,kind,name);let size=0;
     const limit=new Transform({transform(c:Buffer,_e,cb){size+=c.length;size>MAX_MB*1048576?cb(new HttpError(413,`The file is over ${MAX_MB} MB`)):cb(null,c);}});
     try{await pipeline(req,limit,fs.createWriteStream(target));if(!size)throw new HttpError(400,'The upload was empty');return json(res,R.addFile(id!,kind,target));}
     catch(e){await fsp.rm(target,{force:true});throw e instanceof HttpError?e:new HttpError(400,(e as Error).message);}
    }
    if(m==='DELETE'&&action==='/files')return json(res,await R.removeFile(id!,url.searchParams.get('name')??''));
    if(m==='POST'&&action==='/submit'){const input=R.requestInput.safeParse(await body(req));if(!input.success)throw new HttpError(400,input.error.issues[0]?.message??'Check the form');return json(res,R.submit(id!,input.data));}
    if(m==='PATCH'&&!action)return json(res,R.editBrief(id!,(await body(req)).text));
    if(m==='DELETE'&&!action)return json(res,await R.discard(id!));
   }
   const sf=/^\/studio-file\/(?:request\/(r-[a-f0-9]{8})\/([^/]+)|job\/([a-z0-9-]+)\/(\d+)\/((?:show|choice)-\d+))$/.exec(p);
   if(m==='GET'&&sf){let f:string;try{f=sf[1]?R.requestFile(sf[1],decodeURIComponent(sf[2]!)):R.shownFile(sf[3]!,Number(sf[4]),sf[5]!);}catch{throw new HttpError(404,'Not found');}
    // An SVG is shown as a picture only (never as a page that could run scripts).
    if(f.toLowerCase().endsWith('.svg'))res.setHeader('content-security-policy',"default-src 'none'; style-src 'unsafe-inline'; sandbox");
    return await file(req,res,f);}
   // ---------- Settings: services, keys, models, budgets. Keys come in, never go out. ----------
   if(m==='GET'&&p==='/api/settings')return json(res,{...Settings.overview(),presets:LOCAL_PRESETS});
   if(m==='PATCH'&&p==='/api/settings')return json(res,Settings.update(await body(req)));
   if(m==='GET'&&p==='/api/settings/models'){const can=String(url.searchParams.get('can')??'agents');if(!['agents','vision','images','video','speech'].includes(can))throw new HttpError(400,'Unknown ability');return json(res,{models:Settings.modelsFor(can as 'agents')});}
   const sk=/^\/api\/settings\/(keys|test|local)\/([a-z0-9-]+)$/.exec(p);
   if(sk){const [,what,id]=sk;
    const envName=()=>{const l=Settings.readSettings().local.find(x=>x.id===id);return l?id!.toUpperCase().replace(/-/g,'_')+'_API_KEY':providerById(id!).env;};
    if(what==='keys'&&m==='POST'){const b=await body(req);const saved=await Settings.saveKey(envName(),String(b.key??''));return json(res,{stored:saved.stored,test:await Settings.test(id!,fetcher)});}
    if(what==='keys'&&m==='DELETE')return json(res,await Settings.removeKey(envName()));
    if(what==='test'&&m==='POST')return json(res,await Settings.test(id!,fetcher));
    if(what==='local'&&m==='DELETE')return json(res,Settings.removeLocal(id!));
   }
   if(m==='POST'&&p==='/api/settings/local'){const b=await body(req);const l=Settings.addLocal(String(b.name??''),String(b.baseURL??''));return json(res,{added:l,test:await Settings.test(l.id,fetcher)});}
   // ---------- Backup and move: everything the studio learned, in one file ----------
   if(m==='GET'&&p==='/api/backups')return json(res,{folder:Backup.backupDir(),backups:Backup.listBackups()});
   if(m==='POST'&&p==='/api/backups')return json(res,Backup.createBackup());
   if(m==='GET'&&p==='/api/backups/download'){const {zip}=Backup.backupBytes();
    res.writeHead(200,{'content-type':'application/zip','content-length':zip.length,'cache-control':'no-store','content-disposition':`attachment; filename="tempoloom-backup-${new Date().toISOString().slice(0,10)}.zip"`});return void res.end(Buffer.from(zip));}
   const bf=/^\/api\/backups\/file\/(tempoloom-[a-z-]+-[\d-]+\.zip)$/.exec(p);
   if(m==='GET'&&bf){const f=Backup.listBackups().find(x=>x.name===bf[1]);if(!f)throw new HttpError(404,'No such backup');res.setHeader('content-disposition',`attachment; filename="${f.name}"`);return await file(req,res,f.file);}
   if(m==='POST'&&p==='/api/backups/check'){
    const chunks:Buffer[]=[];let n=0;for await(const c of req){n+=(c as Buffer).length;if(n>600*1048576)throw new HttpError(413,'That file is too big to be a Tempoloom backup');chunks.push(c as Buffer);}
    const bytes=new Uint8Array(Buffer.concat(chunks)),mode=url.searchParams.get('mode')==='replace'?'replace':'merge';
    const preview=Backup.previewRestore(bytes,mode);for(const [t,u] of uploads)if(u.expires<Date.now())uploads.delete(t);
    const token=randomBytes(12).toString('hex');uploads.set(token,{bytes,expires:Date.now()+30*60_000});return json(res,{...preview,token});}
   if(m==='POST'&&p==='/api/backups/restore'){const b=await body(req),u=uploads.get(String(b.token??''));if(!u||u.expires<Date.now())throw new HttpError(400,'Choose the backup file again');
    const mode=b.mode==='replace'?'replace':'merge';const r=Backup.restoreBackup(u.bytes,mode);uploads.delete(String(b.token));return json(res,r);}
   // ---------- the Live studio: a job as a team at work, and its events as they happen ----------
   if(m==='GET'&&p==='/api/studio/live')return json(res,{jobs:liveJobs()});
   const lv=/^\/api\/studio\/live\/([a-z0-9-]+)(\/stream)?$/.exec(p);
   if(m==='GET'&&lv&&!lv[2])return json(res,live(lv[1]!));
   if(m==='GET'&&lv&&lv[2]){
    const job=lv[1]!;live(job);let after=Math.max(0,Number(url.searchParams.get('after'))||0);
    res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-store','connection':'keep-alive','x-accel-buffering':'no'});
    const push=()=>{for(const e of events(job,after)){res.write(`id: ${e.seq}\ndata: ${JSON.stringify(e)}\n\n`);after=e.seq;}};
    res.write('retry: 2000\n\n');push();
    const tick=setInterval(push,600),beat=setInterval(()=>res.write(': still here\n\n'),15000);
    req.on('close',()=>{clearInterval(tick);clearInterval(beat);});
    return;
   }
   const deleteMatch=/^\/api\/studio\/jobs\/([a-z0-9-]+)$/.exec(p);
   if(m==='DELETE'&&deleteMatch)return json(res,deleteJob(deleteMatch[1]!));
   const jb=/^\/api\/studio\/jobs\/([a-z0-9-]+)\/(rate|pick|approve|final|feedback|archive)(?:\/([a-z-]+))?$/.exec(p);
   if(m==='POST'&&jb){const [,job,action,task]=jb,b=await body(req);
    const input={rating:String(b.rating) as 'good',reasons:Array.isArray(b.reasons)?b.reasons.map(String):[],note:typeof b.note==='string'?b.note:'',
     parts:Array.isArray(b.parts)?(b.parts as Record<string,unknown>[]).map(x=>({part:String(x.part??''),rating:x.rating==='good'?'good' as const:'bad' as const,note:String(x.note??'')})):[]};
    if(action==='rate'&&task)return json(res,await rate(job!,task,input));
    if(action==='final')return json(res,await R.finalRating(job!,input));
    if(action==='pick'&&task)return json(res,pick(job!,task,String(b.label??'')));
    if(action==='approve'&&task)return json(res,approve(job!,task));
    if(action==='archive')return json(res,archive(job!,b.on!==false));
    if(action==='feedback'){const said=String(b.said??'').trim();if(said.length<4)throw new HttpError(400,'Say what should change');return json(res,await jobFeedback(job!,said,{verdict:b.praise===true?'approve':'revise'}));}
   }
   throw new HttpError(404,'Not found');
  }catch(e){
   const status=e instanceof HttpError?e.status:/^No (taught video|lesson|request|studio job|taste profile)/.test((e as Error).message)?404:400;
   if(!res.headersSent)json(res,{error:(e as Error).message},status);else res.end();
  }
 });
 server.requestTimeout=0;server.headersTimeout=60_000;
 const port=await new Promise<number>((resolve,reject)=>{
  const tryPort=(n:number,left:number)=>{server.once('error',(e:NodeJS.ErrnoException)=>e.code==='EADDRINUSE'&&left>0&&!o.port?tryPort(n+1,left-1):reject(e.code==='EADDRINUSE'?new Error(`Port ${n} is in use; choose another with --port`):e));
   server.listen(n,'127.0.0.1',()=>{server.removeAllListeners('error');resolve((server.address() as {port:number}).port);});};
  tryPort(o.port??4747,20);
 });
 // A weekly backup of what the studio learned, made quietly when the app opens (the four newest are kept).
 setTimeout(()=>{try{Backup.autoBackup();}catch{/* never stops the app */}},4000).unref();
 return {url:`http://127.0.0.1:${port}/?k=${key}`,port,key,idle:()=>busy,close:()=>new Promise<void>(r=>{server.closeAllConnections();server.close(()=>r());})};
}
