// Reference videos with yt-dlp, for study only: measuring pacing, cuts, motion and style.
// They are stored in workspace/downloads/reference (never committed) with a source.json that
// marks them study-only, and are never placed in a final video.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {projectPython} from '../audio-analysis.js';
import {ffmpeg} from '../../renderer/ffmpeg-encoder.js';
import {downloadsRoot,classifyLicense} from './core.js';

type Info={id:string;title:string;uploader?:string;channel?:string;webpage_url:string;duration?:number;license?:string|null;width?:number;height?:number;extractor_key?:string;filesize_approx?:number};

function ytdlp(args:string[],timeoutMs=30*60*1000){
 return new Promise<string>((resolve,reject)=>{
  const child=spawn(projectPython(),['-m','yt_dlp','--js-runtimes','node',...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err=(err+d).slice(-4000));
  const timer=setTimeout(()=>{child.kill();reject(new Error('yt-dlp timed out'));},timeoutMs);
  child.once('error',e=>{clearTimeout(timer);reject(new Error('yt-dlp is not installed in .venv; run pnpm media:setup ('+e.message+')'));});
  child.once('close',code=>{clearTimeout(timer);
   if(code===0)return resolve(out);
   if(/No module named yt_dlp/.test(err))return reject(new Error('yt-dlp is not installed in .venv; run pnpm media:setup'));
   reject(new Error('yt-dlp failed: '+err.trim().split('\n').slice(-3).join(' ')));});
 });
}

const checkUrl=(url:string)=>{const u=new URL(url);if(!/^https?:$/.test(u.protocol))throw new Error('Use an http(s) link');return u.toString();};

/** Title, length and license of a video without downloading it. */
export async function referenceInfo(url:string){
 const info=JSON.parse(await ytdlp(['--dump-single-json','--skip-download','--no-playlist','--no-warnings',checkUrl(url)],120000)) as Info;
 return {id:info.id,title:info.title,creator:info.channel??info.uploader??null,page:info.webpage_url,site:info.extractor_key??null,duration:info.duration??null,
  width:info.width??null,height:info.height??null,approxMB:info.filesize_approx?Math.round(info.filesize_approx/1048576):null,license:info.license??null,
  usage:'study' as const,note:'Reference only: study pacing, cuts and motion; never place this video or its frames in a final video.'};
}

/** Downloads a reference video (at most 1080p, optionally only a section like "0-20"). */
export async function downloadReference(url:string,{section,maxHeight=1080,root=downloadsRoot()}:{section?:string;maxHeight?:number;root?:string}={}){
 const info=await referenceInfo(url);
 const safe=(s:string)=>s.replace(/[^\w.-]+/g,'-').slice(0,60);
 const folder=path.join(root,'reference',`${safe(info.site??'video').toLowerCase()}-${safe(info.id)}`);
 const record=path.join(folder,'source.json');
 try{return {...JSON.parse(await fs.readFile(record,'utf8')),folder,cached:true};}catch{/* new */}
 await fs.mkdir(folder,{recursive:true});
 if(section&&!/^\d+(\.\d+)?-\d+(\.\d+)?$/.test(section))throw new Error('Use --section START-END in seconds, for example 0-20');
 const ffmpegDir=path.isAbsolute(ffmpeg)?['--ffmpeg-location',ffmpeg]:[];
 await ytdlp(['--no-playlist','--no-warnings','--no-overwrites','--restrict-filenames',
  '-f',`bv*[height<=${maxHeight}][ext=mp4]+ba[ext=m4a]/b[height<=${maxHeight}][ext=mp4]/bv*[height<=${maxHeight}]+ba/b`,
  '--merge-output-format','mp4','--max-filesize',`${Number(process.env.SOURCE_MAX_MB||'400')}M`,...ffmpegDir,
  ...(section?['--download-sections',`*${section}`,'--force-keyframes-at-cuts']:[]),
  '-o',path.join(folder,'%(id)s.%(ext)s'),info.page]);
 const files=(await fs.readdir(folder)).filter(f=>/\.(mp4|webm|mkv|mov)$/i.test(f));
 if(!files.length)throw new Error('yt-dlp finished but no video file was written (over the size limit?)');
 const license=classifyLicense(info.license??'unknown');
 const entry={version:1,provider:'yt-dlp',...info,section:section??null,files,downloadedAt:new Date().toISOString(),
  license:{...license,usage:'study',reason:'Downloaded for reference; study only whatever the license says'},usage:'Study and reference only; never in a final video'};
 await fs.writeFile(record,JSON.stringify(entry,null,1)+'\n');
 return {...entry,folder,video:path.join(folder,files[0]!),cached:false};
}
