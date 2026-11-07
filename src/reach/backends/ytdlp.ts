// yt-dlp backend (Agent Reach channels/youtube.py): video info, YouTube search, subtitles as
// text, and study-only downloads for YouTube, Instagram, TikTok, X, Facebook, Pinterest,
// Vimeo and most video sites. Logins come from the Dimensaz browser's saved session for that
// site only, written to a private temporary cookies file that is deleted after the call.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ReachError,makeItem,type Item} from '../result.js';
import {ensureYtdlp,run,CommandFailed,pythonPath,ytdlpBase} from '../tools.js';
import {savedCookies,isRunning,port} from '../browser.js';
import {getCookies,domainMatches,type Cookie} from '../cdp.js';
import {publicUrl} from '../safety.js';

export function netscapeCookies(cookies:Cookie[]){
 return '# Netscape HTTP Cookie File\n'+cookies.map(c=>{const d=c.domain.startsWith('.')?c.domain:'.'+c.domain;
  return [d,'TRUE',c.path??'/',c.secure?'TRUE':'FALSE',String(Math.max(0,Math.round(c.expires&&c.expires>0?c.expires:0))),c.name,c.value].join('\t');}).join('\n')+'\n';
}
/** A private cookies file holding only `domains`' cookies, or null when there are none. */
async function cookieFile(domains:string[]){
 if(!domains.length)return null;
 const all=await isRunning()?await getCookies(port()).catch(()=>savedCookies()):savedCookies();
 const mine=all.filter(c=>domains.some(d=>domainMatches(c.domain,d)));
 if(!mine.length)return null;
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dz-ck-'));const file=path.join(dir,'cookies.txt');
 await fs.writeFile(file,netscapeCookies(mine),{mode:0o600});
 return {file,cleanup:()=>fs.rm(dir,{recursive:true,force:true})};
}

export function classifyYtdlp(e:unknown):never{
 if(!(e instanceof CommandFailed))throw e;
 const err=(e.stderr+'\n'+e.stdout).toLowerCase();
 if(/video unavailable|private video|has been removed|does not exist|404|no video formats|unsupported url/.test(err))throw new ReachError('NOT_FOUND',e.message);
 if(/sign in to confirm|not a bot|captcha|checkpoint/.test(err))throw new ReachError('PLATFORM_BLOCKED',e.message,'The site asked for a human check. Stop; do not retry. The user can open the link in a browser.');
 if(/login required|log in|requires authentication|cookies|rate-limit reached|empty media response/.test(err))throw new ReachError('NEED_LOGIN',e.message,'Log in once: pnpm dimensaz reach login <channel>, then retry.');
 if(/429|too many requests/.test(err))throw new ReachError('RATE_LIMITED',e.message);
 throw new ReachError('UPSTREAM_BROKEN',e.message);
}
async function ytdlp(args:string[],{timeout,domains=[] as string[],cwd}:{timeout:number;domains?:string[];cwd?:string}){
 await ensureYtdlp();
 const ck=await cookieFile(domains);
 try{return await run(pythonPath(),[...ytdlpBase(),...(ck?['--cookies',ck.file]:[]),...args],{timeout,cwd,label:'yt-dlp'});}
 catch(e){return classifyYtdlp(e);}
 finally{await ck?.cleanup();}
}

const isoDate=(d?:string)=>d&&/^\d{8}$/.test(d)?`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6)}`:null;
type Info={id:string;title?:string;webpage_url?:string;url?:string;uploader?:string;channel?:string;upload_date?:string;description?:string;duration?:number;view_count?:number;like_count?:number;
 width?:number;height?:number;extractor_key?:string;license?:string|null;tags?:string[];filesize_approx?:number;entries?:Info[]};
const infoItem=(i:Info):Item=>makeItem({title:i.title,url:i.webpage_url??i.url,author:i.channel??i.uploader,published_at:isoDate(i.upload_date),text:i.description,
 raw:{id:i.id,site:i.extractor_key,duration:i.duration,views:i.view_count,likes:i.like_count,width:i.width,height:i.height,tags:i.tags?.slice(0,15),license:i.license??null,approxMB:i.filesize_approx?Math.round(i.filesize_approx/1048576):null}});

export async function videoInfo({target,timeout,domains=[]}:{target:string;timeout:number;domains?:string[]}){
 const url=publicUrl(target);
 const info=JSON.parse(await ytdlp(['--dump-single-json','--skip-download','--no-playlist',url],{timeout,domains})) as Info;
 return [infoItem(info)];
}
export async function youtubeSearch({query,limit=5,timeout}:{query:string;limit?:number;timeout:number}){
 const out=JSON.parse(await ytdlp(['--dump-single-json','--flat-playlist',`ytsearch${Math.min(limit,30)}:${query}`],{timeout})) as Info;
 const items=(out.entries??[]).map(e=>infoItem({...e,webpage_url:e.url&&e.url.startsWith('http')?e.url:`https://www.youtube.com/watch?v=${e.id}`}));
 if(!items.length)throw new ReachError('NOT_FOUND','nothing found');
 return items;
}

export function vttToText(vtt:string){
 const out:string[]=[];
 for(const line of vtt.split(/\r?\n/)){
  const s=line.trim();
  if(!s||s==='WEBVTT'||/^(Kind|Language|NOTE|STYLE)\b/.test(s)||/^\d+$/.test(s)||/-->/.test(s))continue;
  const t=s.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').trim();
  if(t&&out.at(-1)!==t)out.push(t);
 }
 return out.join('\n');
}
/** Subtitles (uploaded first, then automatic) as plain text. */
export async function subtitles({target,lang='en',timeout,domains=[]}:{target:string;lang?:string;timeout:number;domains?:string[]}){
 const url=publicUrl(target);
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dz-sub-'));
 try{
  await ytdlp(['--skip-download','--no-playlist','--write-subs','--write-auto-subs','--sub-langs',`${lang}.*,${lang}`,'--sub-format','vtt','-o','%(id)s.%(ext)s',url],{timeout,domains,cwd:dir});
  const files=(await fs.readdir(dir)).filter(f=>f.endsWith('.vtt')).sort((a,b)=>Number(/auto|orig/.test(a))-Number(/auto|orig/.test(b)));
  if(!files.length)throw new ReachError('NOT_FOUND',`No ${lang} subtitles for this video`,'Try --lang with another language, or transcribe with ElevenLabs (--allow-upload) if the user agrees.');
  const text=vttToText(await fs.readFile(path.join(dir,files[0]!),'utf8'));
  return [makeItem({url,text,raw:{language:lang,file:files[0]}})];
 }finally{await fs.rm(dir,{recursive:true,force:true});}
}

/** Downloads one video (at most 1080p, optionally a section) into `folder`. */
export async function downloadVideo({target,folder,section,maxHeight=1080,timeout,domains=[],audioOnly=false}:{target:string;folder:string;section?:string;maxHeight?:number;timeout:number;domains?:string[];audioOnly?:boolean}){
 const url=publicUrl(target);
 if(section&&!/^\d+(\.\d+)?-\d+(\.\d+)?$/.test(section))throw new ReachError('BAD_INPUT','Use --section START-END in seconds, for example 0-20');
 await fs.mkdir(folder,{recursive:true});
 const {ffmpeg}=await import('../../renderer/ffmpeg-encoder.js');
 const format=audioOnly?['-f','ba/b','-x','--audio-format','m4a']:['-f',`bv*[height<=${maxHeight}][ext=mp4]+ba[ext=m4a]/b[height<=${maxHeight}][ext=mp4]/bv*[height<=${maxHeight}]+ba/b`,'--merge-output-format','mp4'];
 await ytdlp(['--no-playlist','--no-overwrites','--restrict-filenames',...format,'--max-filesize',`${Number(process.env.SOURCE_MAX_MB||'400')}M`,
  ...(path.isAbsolute(ffmpeg)?['--ffmpeg-location',ffmpeg]:[]),...(section?['--download-sections',`*${section}`,'--force-keyframes-at-cuts']:[]),
  '-o',path.join(folder,'%(id)s.%(ext)s'),url],{timeout,domains});
 const files=(await fs.readdir(folder)).filter(f=>/\.(mp4|webm|mkv|mov|m4a|mp3)$/i.test(f));
 if(!files.length)throw new ReachError('UPSTREAM_BROKEN','yt-dlp finished but wrote no file (over the size limit?)');
 return files.map(f=>path.join(folder,f));
}
