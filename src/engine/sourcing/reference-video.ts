// Reference video acquisition shares the platform login and exact-media selection backend.
import fs from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {downloadsRoot,classifyLicense} from './core.js';
import {referenceVideos,selectVideo,videoTarget,downloadVideo,type VideoMetadata} from '../../reach/backends/ytdlp.js';

export const sourceDomains=(url:string)=>{
 const host=new URL(videoTarget(url)).hostname.replace(/^www\./,'');
 const platform=['instagram.com','youtube.com','tiktok.com','facebook.com','vimeo.com','twitter.com','x.com'].find(domain=>host===domain||host.endsWith('.'+domain));
 return host==='youtu.be'?['youtube.com','youtu.be']:[platform??host];
};
const http=(value:unknown)=>typeof value==='string'&&/^https:\/\//.test(value)?value:null;
function preview(v:VideoMetadata){
 const formats=z.array(z.object({url:z.string().optional(),vcodec:z.string().optional(),acodec:z.string().optional(),height:z.number().nullish(),ext:z.string().optional()}).passthrough()).safeParse(v.formats);
 const playable=formats.success?formats.data.filter(f=>f.vcodec!=='none'&&f.acodec!=='none'&&f.ext==='mp4').sort((a,b)=>(b.height??0)-(a.height??0))[0]?.url:null;
 return {id:v.id,item:v.item,title:v.title??'Video',creator:v.channel??v.uploader??null,page:v.webpage_url??null,site:v.extractor_key??null,duration:v.duration??null,
  width:v.width??null,height:v.height??null,approxMB:v.filesize_approx?Math.round(v.filesize_approx/1048576):null,license:v.license??null,
  thumbnail:http(v.thumbnail),previewUrl:http(playable),usage:'study' as const};
}
/** Inspect metadata only. The selected item is returned with all choices for carousel previews. */
export async function referenceInfo(url:string,o:{item?:number;expectedId?:string}={}){
 const items=await referenceVideos({target:url,timeout:120,domains:sourceDomains(url)});
 const hasIndex=o.item!==undefined||new URL(url).searchParams.has('img_index');
 const selected=hasIndex||items.length===1?selectVideo(items,url,o.item,o.expectedId):items[0]!;
 if(o.expectedId&&selected.id!==o.expectedId)throw new Error('The video changed. Preview the link again.');
 return {...preview(selected),page:videoTarget(url),choices:items.map(preview),note:'Reference only. Study pacing, cuts and motion.'};
}
export async function downloadReference(url:string,{section,maxHeight=1080,root=downloadsRoot(),item,expectedId}:{section?:string;maxHeight?:number;root?:string;item?:number;expectedId?:string}={}){
 const info=await referenceInfo(url,{...(item?{item}:{}),...(expectedId?{expectedId}:{})});
 if(info.choices.length>1&&!item&&!new URL(url).searchParams.has('img_index'))throw new Error('Choose a video from this post before downloading');
 const safe=(s:string)=>s.replace(/[^\w.-]+/g,'-').slice(0,60);
 const folder=path.resolve(root,'reference',safe(info.site??'video').toLowerCase()+'-'+safe(info.id)+'-'+safe(section??'full')+'-'+maxHeight);
 const record=path.join(folder,'source.json');
 try{
  const saved=z.object({id:z.string(),files:z.array(z.string()).length(1)}).passthrough().parse(JSON.parse(await fs.readFile(record,'utf8')));
  const file=path.resolve(folder,saved.files[0]!);
  if(saved.id===info.id&&path.dirname(file)===folder){await fs.access(file);return {...saved,folder,video:file,cached:true};}
 }catch{/* Download when the selected file is absent. */}
 await fs.mkdir(folder,{recursive:true});
 const files=await downloadVideo({target:url,folder,maxHeight,timeout:1800,domains:sourceDomains(url),item:info.item,expectedId:info.id,...(section?{section}:{})});
 const license=classifyLicense(info.license??'unknown');
 const entry={version:1,provider:'yt-dlp',...info,section:section??null,files:files.map(f=>path.basename(f)),downloadedAt:new Date().toISOString(),
  license:{...license,usage:'study',reason:'Downloaded for reference study'},usage:'Study and reference only'};
 await fs.writeFile(record,JSON.stringify(entry,null,1)+'\n');
 return {...entry,folder,video:files[0]!,cached:false};
}
