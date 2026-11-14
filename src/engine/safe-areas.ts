// Where the platforms draw their own buttons, captions and names over a vertical video. Nothing
// important may sit there. The numbers are each platform's ad guidance at 1080 x 1920, as published
// in late 2026; the platforms change their layouts, so they live here, in one place, and the user
// chooses which platforms their videos go to (Models and keys page, or .tempoloom/settings.json).
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './config-root.js';
import fsp from 'node:fs/promises';
import {ffmpeg,probe,run} from '../renderer/ffmpeg-encoder.js';

export const PLATFORMS={
 tiktok:{label:'TikTok',top:130,bottom:484,left:44,right:140},
 reels:{label:'Instagram Reels',top:269,bottom:672,left:65,right:65},
 shorts:{label:'YouTube Shorts',top:288,bottom:672,left:48,right:192},
} as const;
export type Platform=keyof typeof PLATFORMS;
export const PLATFORM_IDS=Object.keys(PLATFORMS) as Platform[];
export type Margins={top:number;bottom:number;left:number;right:number};
/** A vertical video, the shape these platforms show full screen. */
export const isVertical=(w:number,h:number)=>h/w>=1.5;

/** The platforms the user's videos go to (all three when they did not say). */
export function platforms():Platform[]{
 try{const s=JSON.parse(fs.readFileSync(path.join(path.resolve(ROOT,process.env.TEMPOLOOM_SETTINGS_DIR||'.tempoloom'),'settings.json'),'utf8')) as {platforms?:string[]};
  const p=(s.platforms??[]).filter((x):x is Platform=>x in PLATFORMS);if(p.length)return p;}catch{/* not chosen yet */}
 return [...PLATFORM_IDS];
}
/** The margins to keep clear, as fractions of the frame: the widest of the chosen platforms. */
export function margins(list:Platform[]=platforms()):Margins{
 const m={top:0,bottom:0,left:0,right:0};
 for(const p of list){const z=PLATFORMS[p];m.top=Math.max(m.top,z.top/1920);m.bottom=Math.max(m.bottom,z.bottom/1920);m.left=Math.max(m.left,z.left/1080);m.right=Math.max(m.right,z.right/1080);}
 return {top:+m.top.toFixed(4),bottom:+m.bottom.toFixed(4),left:+m.left.toFixed(4),right:+m.right.toFixed(4)};
}
export type Box={x:number;y:number;w:number;h:number};
/** How much of a box (in fractions of the frame) is under a platform's buttons, and which ones. */
export function unsafe(b:Box,list:Platform[]=platforms()){
 const area=Math.max(1e-9,b.w*b.h),hits:{platform:Platform;side:keyof Margins;share:number}[]=[];
 for(const p of list){const z=PLATFORMS[p],m={top:z.top/1920,bottom:z.bottom/1920,left:z.left/1080,right:z.right/1080};
  const zones:Record<keyof Margins,Box>={top:{x:0,y:0,w:1,h:m.top},bottom:{x:0,y:1-m.bottom,w:1,h:m.bottom},left:{x:0,y:0,w:m.left,h:1},right:{x:1-m.right,y:0,w:m.right,h:1}};
  for(const [side,zz] of Object.entries(zones) as [keyof Margins,Box][]){const ix=Math.max(0,Math.min(b.x+b.w,zz.x+zz.w)-Math.max(b.x,zz.x)),iy=Math.max(0,Math.min(b.y+b.h,zz.y+zz.h)-Math.max(b.y,zz.y));
   const share=ix*iy/area;if(share>.02)hits.push({platform:p,side,share:+share.toFixed(3)});}}
 return {share:Math.max(0,...hits.map(h=>h.share)),hits};
}
/** In words: "under the TikTok and Reels buttons (bottom)". */
export function describe(hits:{platform:Platform;side:keyof Margins}[]){
 const sides=[...new Set(hits.map(h=>h.side))],names=[...new Set(hits.map(h=>PLATFORMS[h.platform].label))];
 return `under the ${names.join(' and ')} ${sides.includes('bottom')?'caption and buttons':sides.includes('right')?'buttons':'top bar'} (${sides.join(', ')})`;
}
/** Where captions sit on a vertical video so they clear every chosen platform: just above the bottom area. */
export const captionMargin=(m:Margins=margins())=>+Math.min(.45,m.bottom+.02).toFixed(3);

/** Frames of a vertical video with the chosen platforms' button areas shaded red: anything to read
 *  or the logo inside the red is covered on the phone. Returns null for a video that is not vertical. */
export async function safeSheet(file:string,out:string,o:{list?:Platform[];frames?:number}={}){
 const info=await probe(file),v=(info.streams as {codec_type?:string;width?:number;height?:number}[]|undefined)?.find(s=>s.codec_type==='video'),w=Number(v?.width),h=Number(v?.height),dur=Number(info.format?.duration)||0;
 if(!w||!h||!isVertical(w,h))return null;
 const list=o.list??platforms(),m=margins(list),n=Math.max(2,Math.min(8,o.frames??6)),cw=270,ch=480;
 const box=(x:string,y:string,bw:string,bh:string)=>`drawbox=x=${x}:y=${y}:w=${bw}:h=${bh}:color=red@0.32:t=fill`;
 const shade=[box('0','0','iw',`ih*${m.top}`),box('0',`ih*${1-m.bottom}`,'iw',`ih*${m.bottom}`),box('0','0',`iw*${m.left}`,'ih'),box(`iw*${1-m.right}`,'0',`iw*${m.right}`,'ih')].join(',');
 const tmp=out+'.parts';await fsp.mkdir(tmp,{recursive:true});
 try{
  for(let i=0;i<n;i++){const t=Math.max(0,Math.min(dur-.05,dur*(i+.5)/n));
   await run(ffmpeg,['-v','error','-y','-ss',t.toFixed(2),'-i',file,'-frames:v','1','-vf',`scale=${cw}:${ch}:force_original_aspect_ratio=decrease,pad=${cw}:${ch}:(ow-iw)/2:(oh-ih)/2,${shade}`,path.join(tmp,String(i).padStart(3,'0')+'.jpg')]);}
  await run(ffmpeg,['-v','error','-y','-framerate','1','-i',path.join(tmp,'%03d.jpg'),'-vf',`tile=${n}x1:padding=4:color=0x101010`,'-frames:v','1','-q:v','3',out]);
 }finally{await fsp.rm(tmp,{recursive:true,force:true});}
 return {file:out,platforms:list.map(p=>PLATFORMS[p].label),margins:m,times:Array.from({length:n},(_,i)=>+(dur*(i+.5)/n).toFixed(2))};
}
