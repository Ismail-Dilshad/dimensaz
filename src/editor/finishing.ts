// Finishing: one master exported to other aspect ratios, and an automatic thumbnail.
// Narrower targets crop around a focus point (the speaker's face from `media reframe`, or
// the centre); wider targets fit the whole frame over a blurred, darkened copy of itself,
// so no text or design is cut off. Inputs are never changed; outputs are never overwritten.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {ROOT} from '../engine/config.js';
import {brandProfile} from '../engine/brand.js';
import {defaultFontPath} from '../engine/font-catalog.js';
import {detectLanguage,isRtl} from '../engine/languages.js';
import {chromiumExecutable} from '../renderer/browser-path.js';
import {ffmpeg,run} from '../renderer/ffmpeg-encoder.js';
import {mediaInfo} from './editor.js';
import {aspectSizes} from './edl.js';

export const formatNames=['9:16','1:1','16:9','4:5'] as const;
export type FormatName=typeof formatNames[number];
const even=(n:number)=>Math.max(2,Math.round(n/2)*2);
const tag=(f:string)=>f.replace(':','x');
async function free(file:string){const ext=path.extname(file),stem=file.slice(0,-ext.length);for(let i=1;;i++){const f=i===1?file:`${stem}-${i}${ext}`;try{await fs.access(f);}catch{return f;}}}

export type FormatOptions={to:FormatName[];mode?:'auto'|'crop'|'fit';focusX?:number;focusY?:number;background?:'blur'|string;outDir?:string;crf?:number};
/** Writes one file per target aspect ratio next to the master (or in outDir). */
export async function exportFormats(file:string,o:FormatOptions){
 const src=path.resolve(file),info=await mediaInfo(src),ratio=info.width/info.height;
 const longSide=Math.max(info.width,info.height)>=1900?1920:Math.max(info.width,info.height);
 const outDir=path.resolve(o.outDir??path.dirname(src));await fs.mkdir(outDir,{recursive:true});
 const stem=path.basename(src,path.extname(src)).replace(/_(9x16|1x1|16x9|4x5)$/,'');
 const results=[];
 for(const target of [...new Set(o.to)]){
  const [aw,ah]=aspectSizes[target];const scale=longSide/Math.max(aw,ah);
  const W=even(aw*scale),H=even(ah*scale),tr=W/H;
  if(Math.abs(tr-ratio)<.01){results.push({format:target,skipped:'same shape as the master',file:src});continue;}
  const mode=o.mode==='crop'||o.mode==='fit'?o.mode:tr<ratio?'crop':'fit';
  const fx=o.focusX??.5,fy=o.focusY??.45;
  let vf:string;
  if(mode==='crop'){
   // Scale so the target fully covers, then crop the window around the focus point.
   vf=`scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}:'min(max(iw*${fx}-${W}/2,0),iw-${W})':'min(max(ih*${fy}-${H}/2,0),ih-${H})',setsar=1`;
  }else{
   const bg=!o.background||o.background==='blur'
    ?`[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=luma_radius=min(h\\,w)/18:luma_power=2,eq=brightness=-0.08:saturation=1.1[bg]`
    :`color=c=${o.background.slice(0,7)}:s=${W}x${H}:r=${info.fps}[bg]`;
   vf=`${bg};[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2:shortest=1,setsar=1`;
  }
  const out=await free(path.join(outDir,`${stem}_${tag(target)}.mp4`));
  const filter=mode==='crop'?['-vf',vf]:['-filter_complex',vf];
  await run(ffmpeg,['-hide_banner','-loglevel','error','-n','-i',src,...filter,'-r',String(info.fps),'-c:v','libx264','-preset','medium','-crf',String(o.crf??18),'-pix_fmt','yuv420p',
   ...(info.hasAudio?['-c:a','aac','-b:a','192k']:['-an']),'-movflags','+faststart',out]);
  results.push({format:target,mode,width:W,height:H,file:out});
 }
 return {master:src,width:info.width,height:info.height,formats:results};
}

// ---------- thumbnail ----------
export type ThumbLayout='side'|'bottom'|'big';
export type ThumbnailOptions={title?:string;at?:number;size?:'16:9'|'9:16'|'1:1';out?:string;logo?:boolean;candidates?:number;layout?:ThumbLayout};
const escape=(s:string)=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
type Browser=Awaited<ReturnType<typeof chromium.launch>>;
const sizeOf=(size:'16:9'|'9:16'|'1:1')=>size==='16:9'?[1280,720] as const:size==='1:1'?[1080,1080] as const:[1080,1920] as const;

/** Settled frames ranked by how well they would hold a cover: sharp, colourful and well exposed,
 *  away from the very start and end (fades, cards). */
export async function rankFrames(src:string,duration:number,browser:Browser,work:string,n=24){
 const from=Math.min(duration*.08,1.5),to=Math.max(from+.1,duration-Math.min(duration*.12,2.5));
 const times=Array.from({length:n},(_,i)=>from+(to-from)*(i+.5)/n);
 for(const [i,t] of times.entries())await run(ffmpeg,['-hide_banner','-loglevel','error','-ss',t.toFixed(3),'-i',src,'-frames:v','1','-vf','scale=320:-2','-y',path.join(work,`c${i}.png`)]);
 const page=await browser.newPage(),scores:number[]=[];
 for(let i=0;i<times.length;i++){
  const data=(await fs.readFile(path.join(work,`c${i}.png`))).toString('base64');
  scores.push(await page.evaluate(async(b64)=>{
   const img=new Image();img.src='data:image/png;base64,'+b64;await img.decode();
   const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d')!;x.drawImage(img,0,0);
   const d=x.getImageData(0,0,c.width,c.height).data,w=c.width,h=c.height,g=new Float32Array(w*h);let sat=0,lum=0;
   for(let p=0,q=0;p<d.length;p+=4,q++){const r=d[p]!,gg=d[p+1]!,b=d[p+2]!;g[q]=.299*r+.587*gg+.114*b;lum+=g[q]!;const mx=Math.max(r,gg,b),mn=Math.min(r,gg,b);sat+=mx?(mx-mn)/mx:0;}
   let s=0,s2=0,k=0;for(let yy=1;yy<h-1;yy++)for(let xx=1;xx<w-1;xx++){const i=yy*w+xx;const l=4*g[i]!-g[i-1]!-g[i+1]!-g[i-w]!-g[i+w]!;s+=l;s2+=l*l;k++;}
   const sharp=Math.sqrt(Math.max(0,s2/k-(s/k)**2)),mean=lum/(w*h),colour=sat/(w*h);
   const exposure=1-Math.min(1,Math.abs(mean-128)/128);
   return sharp*(0.6+colour)*(0.4+exposure);
  },data));
 }
 await page.close();
 return times.map((t,i)=>({time:+t.toFixed(3),score:+scores[i]!.toFixed(3)})).sort((a,b)=>b.score-a.score);
}

/** One cover: the frame (cover-fitted), a gradient that keeps the title readable, the title in the
 *  language's font with its last word in the brand accent, and the logo. Written as PNG and JPEG. */
export async function composeThumbnail(browser:Browser,frame:string,o:{title?:string;size:'16:9'|'9:16'|'1:1';layout?:ThumbLayout;logo?:boolean;base:string}){
 const [W,H]=sizeOf(o.size),brand=await brandProfile(),title=o.title?.trim();
 const layout:ThumbLayout=o.layout??(o.size==='9:16'?'bottom':'side');
 const language=title?detectLanguage(title):'en',rtl=title?isRtl(language,title):false;
 const fontFile=title?path.resolve(ROOT,await defaultFontPath(language,title)):null;
 const logoPath=o.logo!==false&&(brand.logo.onDark??brand.logo.primary)?path.resolve(ROOT,(brand.logo.onDark??brand.logo.primary)!):null;
 const accent=brand.colors.accent??'#FF6B4A';
 const files:Record<string,string>={'frame.png':frame,...(fontFile?{'font':fontFile}:{}),...(logoPath?{['logo'+path.extname(logoPath)]:logoPath}:{})};
 const words=title?title.split(/\s+/):[];
 const base=o.size==='16:9'?84:o.size==='1:1'?96:120;
 const place=layout==='bottom'?`left:7%;right:7%;bottom:12%;text-align:${rtl?'right':'left'}`
  :layout==='big'?`left:6%;right:6%;top:50%;transform:translateY(-50%);text-align:center`
  :`${rtl?'right':'left'}:6%;width:58%;top:50%;transform:translateY(-50%)`;
 const shade=layout==='bottom'?'180deg,rgba(0,0,0,0) 40%,rgba(0,0,0,.82) 78%,rgba(0,0,0,.9) 100%'
  :layout==='big'?'180deg,rgba(0,0,0,.25) 0%,rgba(0,0,0,.6) 50%,rgba(0,0,0,.25) 100%'
  :`${rtl?'270deg':'90deg'},rgba(0,0,0,.75) 0%,rgba(0,0,0,.35) 55%,rgba(0,0,0,0) 80%`;
 const html=`<!doctype html><html><head><meta charset="utf-8"><style>
${fontFile?`@font-face{font-family:T;src:url(http://thumb.local/font);font-weight:100 900}`:''}
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#000}
.f{position:absolute;inset:0;background:url(http://thumb.local/frame.png) center/cover}
.g{position:absolute;inset:0;background:linear-gradient(${shade})}
.t{position:absolute;${place};direction:${rtl?'rtl':'ltr'};font-family:T,sans-serif;font-weight:800;color:#fff;font-size:${layout==='big'?Math.round(base*1.35):base}px;line-height:1.08;letter-spacing:-.01em;text-shadow:0 4px 24px rgba(0,0,0,.45)}
.t b{color:${accent};font-weight:900}
.big b{color:#fff;background:${accent};padding:0 .18em;box-decoration-break:clone;-webkit-box-decoration-break:clone;text-shadow:none}
.l{position:absolute;${rtl?'left':'right'}:4%;top:4%;height:${Math.round(H*.07)}px;filter:drop-shadow(0 2px 10px rgba(0,0,0,.55))}
</style></head><body><div class="f"></div>${title?'<div class="g"></div>':''}
${title?`<div class="t${layout==='big'?' big':''}">${words.map((w,i)=>i===words.length-1&&words.length>1?`<b>${escape(w)}</b>`:escape(w)).join(' ')}</div>`:''}
${logoPath?`<img class="l" src="http://thumb.local/logo${path.extname(logoPath)}">`:''}</body></html>`;
 const ctx=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:1,offline:true}),page=await ctx.newPage();
 try{
  await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='thumb.local')return route.abort('blockedbyclient');const f=files[u.pathname.slice(1)];
   if(!f)return route.fulfill({status:404,body:''});const ext=path.extname(f).toLowerCase();
   return route.fulfill({contentType:ext==='.svg'?'image/svg+xml':ext==='.png'?'image/png':ext==='.jpg'?'image/jpeg':'font/ttf',body:await fs.readFile(f)});});
  await page.setContent(html,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
  // The title must fit: shrink it until it does (a long title in a narrow cover).
  if(title)await page.evaluate(({H,W})=>{const t=document.querySelector('.t') as HTMLElement;let size=parseFloat(getComputedStyle(t).fontSize);
   while(size>28&&(t.getBoundingClientRect().height>H*.7||t.scrollWidth>W*.92)){size-=4;t.style.fontSize=size+'px';}},{H,W});
  const png=await free(o.base+'.png'),jpg=await free(o.base+'.jpg');
  await page.screenshot({path:png,type:'png'});await page.screenshot({path:jpg,type:'jpeg',quality:88});
  return {png,jpg,jpgKB:Math.round((await fs.stat(jpg)).size/1024),size:`${W}x${H}`,layout};
 }finally{await ctx.close();}
}

/** Picks the sharpest, most colourful settled frame (or the one at `at`), and adds a title and logo. */
export async function makeThumbnail(file:string,o:ThumbnailOptions={}){
 const src=path.resolve(file),info=await mediaInfo(src);
 const size=o.size??(info.width>info.height?'16:9':info.width===info.height?'1:1':'9:16');
 const work=await fs.mkdtemp(path.join(os.tmpdir(),'dz-thumb-'));
 const browser=await chromium.launch({headless:true,executablePath:chromiumExecutable()});
 try{
  const chosen=o.at??(await rankFrames(src,info.duration,browser,work,Math.max(4,Math.min(40,o.candidates??24))))[0]!.time;
  const frame=path.join(work,'frame.png');
  await run(ffmpeg,['-hide_banner','-loglevel','error','-ss',chosen.toFixed(3),'-i',src,'-frames:v','1','-y',frame]);
  const base=o.out?path.resolve(o.out).replace(/\.(png|jpe?g)$/i,''):path.join(path.dirname(src),path.basename(src,path.extname(src))+'_thumbnail');
  const c=await composeThumbnail(browser,frame,{title:o.title,size,layout:o.layout,logo:o.logo,base});
  return {video:src,at:Number(chosen.toFixed(2)),size:c.size,png:c.png,jpg:c.jpg,jpgKB:c.jpgKB,title:o.title?.trim()||null,note:c.jpgKB>2000?'JPEG is over 2 MB (YouTube limit); lower the quality':'Ready for YouTube, TikTok and Reels covers'};
 }finally{await browser.close();await fs.rm(work,{recursive:true,force:true});}
}
