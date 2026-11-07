// Renders Lottie animations (Bodymovin JSON) with lottie-web inside Chromium, one exact frame
// at a time, and encodes them with transparency (ProRes 4444 .mov, VP9 .webm, PNG frames) or
// on a solid background (.mp4). Rendering is offline: only the JSON and files in its folder load.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';
import {z} from 'zod';
import {chromiumExecutable} from './browser-path.js';
import {ffmpeg} from './ffmpeg-encoder.js';

const require=createRequire(import.meta.url);
const player=()=>require.resolve('lottie-web/build/player/lottie.min.js');

const lottieSchema=z.object({v:z.string().optional(),fr:z.number().positive(),ip:z.number(),op:z.number(),w:z.number().positive(),h:z.number().positive(),
 nm:z.string().optional(),ddd:z.number().optional(),layers:z.array(z.unknown()),assets:z.array(z.record(z.string(),z.unknown())).optional(),fonts:z.unknown().optional()}).passthrough()
 .refine(a=>a.op>a.ip,'Lottie out point (op) must be after in point (ip)');

export const formats=['mov','webm','png','mp4'] as const;
export type LottieFormat=typeof formats[number];
export const renderOptionsSchema=z.object({
 format:z.enum(formats).default('mov'),
 out:z.string().optional(),
 scale:z.number().min(.1).max(4).default(1),
 width:z.number().int().positive().max(4096).optional(),
 fps:z.number().positive().max(120).optional(),
 background:z.string().regex(/^#[0-9a-f]{6}$/i,'Use a hex color like #FFFFFF').default('#FFFFFF'),
 loops:z.number().int().min(1).max(20).default(1),
}).strict();
export type RenderOptions=z.input<typeof renderOptionsSchema>;

export async function lottieInfo(file:string){
 const text=await fs.readFile(file,'utf8');
 const a=lottieSchema.parse(JSON.parse(text));
 const images=(a.assets??[]).filter(x=>typeof x.p==='string'&&('w' in x||'e' in x));
 const external=images.filter(x=>x.e!==1&&!String(x.p).startsWith('data:')).map(x=>String(x.u??'')+String(x.p));
 return {file:path.resolve(file),name:a.nm??null,version:a.v??null,width:a.w,height:a.h,fps:a.fr,inPoint:a.ip,outPoint:a.op,
  frames:Math.round(a.op-a.ip),durationSeconds:Number(((a.op-a.ip)/a.fr).toFixed(3)),layers:a.layers.length,threeD:a.ddd===1,
  images:images.length,externalImages:external,usesExpressions:/"x"\s*:\s*"/.test(text),usesTextFonts:!!a.fonts};
}

async function freeName(file:string){
 const ext=path.extname(file),stem=file.slice(0,file.length-ext.length);
 for(let i=1;;i++){const f=i===1?file:`${stem}-${i}${ext}`;try{await fs.access(f);}catch{return f;}}
}

function encoderArgs(format:LottieFormat,fps:number,out:string){
 const input=['-hide_banner','-loglevel','error','-n','-f','image2pipe','-framerate',String(fps),'-c:v','png','-i','-'];
 if(format==='mov')return [...input,'-c:v','prores_ks','-profile:v','4','-pix_fmt','yuva444p10le','-vendor','apl0',out];
 if(format==='webm')return [...input,'-c:v','libvpx-vp9','-pix_fmt','yuva420p','-b:v','0','-crf','24','-auto-alt-ref','0','-row-mt','1',out];
 return [...input,'-c:v','libx264','-preset','medium','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart',out];
}

/** Renders a Lottie file. Returns the output path (a folder of PNG frames for format png). */
export async function renderLottie(file:string,raw:RenderOptions={}){
 const o=renderOptionsSchema.parse(raw);
 const source=path.resolve(file),folder=path.dirname(source);
 const info=await lottieInfo(source);
 const scale=o.width?o.width/info.width:o.scale;
 const width=Math.max(2,Math.round(info.width*scale/2)*2),height=Math.max(2,Math.round(info.height*scale/2)*2);
 const fps=o.fps??info.fps;
 const count=Math.max(1,Math.round(info.frames/info.fps*fps))*o.loops;
 const stem=path.join(folder,path.basename(source,path.extname(source)));
 const out=o.out?path.resolve(o.out):await freeName(o.format==='png'?stem+'-frames':`${stem}.${o.format}`);
 if(o.out)await fs.access(out).then(()=>{throw new Error('Output already exists; never overwriting: '+out);},()=>{});
 const transparent=o.format!=='mp4';
 const html=`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:${transparent?'transparent':o.background}}#a{width:${width}px;height:${height}px}</style></head>
<body><div id="a"></div><script src="http://lottie.local/player.js"></script><script>
window.ready=fetch('http://lottie.local/animation.json').then(r=>r.json()).then(data=>new Promise((resolve,reject)=>{
 const anim=lottie.loadAnimation({container:document.getElementById('a'),renderer:'svg',loop:false,autoplay:false,animationData:data,assetsPath:'http://lottie.local/files/',
  rendererSettings:{preserveAspectRatio:'xMidYMid meet',progressiveLoad:false}});
 window.anim=anim;let done=false;const finish=()=>{if(!done){done=true;resolve(anim.totalFrames);}};
 anim.addEventListener('DOMLoaded',()=>{if(!anim.imagePreloader||anim.imagePreloader.loadedImages()){finish();}});
 anim.addEventListener('loaded_images',finish);anim.addEventListener('data_failed',()=>reject(new Error('Lottie data failed')));
 setTimeout(()=>reject(new Error('Lottie did not load within 30 s')),30000);
}));
window.show=async f=>{window.anim.goToAndStop(f,true);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));};
</script></body></html>`;
 const browser=await chromium.launch({headless:true,executablePath:chromiumExecutable(),args:['--disable-background-networking','--disable-component-update']});
 try{
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,offline:true});
  const page=await context.newPage();
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname!=='lottie.local'){await route.abort('blockedbyclient');return;}
   try{
    if(url.pathname==='/player.js')return route.fulfill({contentType:'application/javascript',body:await fs.readFile(player())});
    if(url.pathname==='/animation.json')return route.fulfill({contentType:'application/json',body:await fs.readFile(source)});
    if(url.pathname.startsWith('/files/')){
     const target=path.resolve(folder,decodeURIComponent(url.pathname.slice(7)));
     if(path.relative(folder,target).startsWith('..')||path.isAbsolute(path.relative(folder,target)))return route.fulfill({status:403,body:'Outside the animation folder'});
     return route.fulfill({body:await fs.readFile(target)});
    }
    return route.fulfill({status:404,body:'Not found'});
   }catch(e){errors.push(String(e));return route.fulfill({status:404,body:'Missing file'});}
  });
  await page.setContent(html,{waitUntil:'load'});
  const total=await page.evaluate(()=>(window as unknown as {ready:Promise<number>}).ready);
  if(errors.length)throw new Error('Lottie errors: '+errors.join('; '));
  const frameAt=(i:number)=>((i/fps)*info.fps)%total;
  if(o.format==='png')await fs.mkdir(out,{recursive:false});
  const encoder=o.format==='png'?null:spawn(ffmpeg,encoderArgs(o.format,fps,out),{windowsHide:true,stdio:['pipe','ignore','pipe']});
  let encodeError='';encoder?.stderr.on('data',d=>encodeError=(encodeError+d).slice(-4000));
  const closed=encoder?new Promise<number>((resolve,reject)=>{encoder.once('error',reject);encoder.once('close',code=>resolve(code??1));}):Promise.resolve(0);
  for(let i=0;i<count;i++){
   await page.evaluate(f=>(window as unknown as {show:(f:number)=>Promise<void>}).show(f),frameAt(i));
   const png=await page.screenshot({type:'png',omitBackground:transparent,clip:{x:0,y:0,width,height}});
   if(encoder){if(!encoder.stdin.write(png))await new Promise(r=>encoder.stdin.once('drain',r));}
   else await fs.writeFile(path.join(out,`frame-${String(i).padStart(5,'0')}.png`),png,{flag:'wx'});
  }
  encoder?.stdin.end();
  if(await closed!==0)throw new Error('FFmpeg failed while encoding the Lottie animation: '+encodeError);
  if(errors.length)throw new Error('Lottie errors: '+errors.join('; '));
  return {input:source,output:out,format:o.format,transparent,width,height,fps,frames:count,durationSeconds:Number((count/fps).toFixed(3)),
   usesExpressions:info.usesExpressions,externalImages:info.externalImages};
 }finally{await browser.close();}
}
