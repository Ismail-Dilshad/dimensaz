// Brand layer from config/brand.json: a logo watermark over the footage and an animated end
// card (logo springs in, the call to action slides up, the background keeps drifting). Both
// are drawn in an offline Chromium page, so SVG logos and brand fonts render exactly.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {chromium,type Page} from 'playwright';
import {ROOT} from '../engine/config.js';
import {brandProfile} from '../engine/brand.js';
import {fontCatalog} from '../engine/font-catalog.js';
import {detectLanguage,isRtl} from '../engine/languages.js';
import {chromiumExecutable} from '../renderer/browser-path.js';
import {ffmpeg} from '../renderer/ffmpeg-encoder.js';

export type LogoChoice='primary'|'mark'|'onLight'|'onDark';

export async function brandAssets(choice:LogoChoice='primary'){
 const brand=await brandProfile();
 const pick=brand.logo[choice]??brand.logo.primary??brand.logo.mark;
 if(!pick)throw new Error('config/brand.json has no logo. Add logo.primary (an SVG or PNG path) or run pnpm reelwright init.');
 const logo=path.resolve(ROOT,pick);await fs.access(logo);
 const fontId=brand.fonts.en??null;
 const catalog=await fontCatalog();
 const font=(fontId&&catalog.fonts.find(f=>f.id===fontId&&f.available))||catalog.fonts.find(f=>f.id==='inter'&&f.available)||catalog.fonts.find(f=>f.available);
 return {brand,logo,font:font?path.resolve(ROOT,font.path):null};
}

async function withPage<T>(width:number,height:number,files:Record<string,string>,html:string,fn:(page:Page)=>Promise<T>){
 const browser=await chromium.launch({headless:true,executablePath:chromiumExecutable()});
 try{
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,offline:true});
  const page=await context.newPage();
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname!=='brand.local'){await route.abort('blockedbyclient');return;}
   const file=files[url.pathname.slice(1)];
   if(!file)return route.fulfill({status:404,body:'Not found'});
   const ext=path.extname(file).toLowerCase();
   return route.fulfill({contentType:ext==='.svg'?'image/svg+xml':ext==='.png'?'image/png':ext==='.ttf'||ext==='.otf'?'font/ttf':'application/octet-stream',body:await fs.readFile(file)});
  });
  await page.setContent(html,{waitUntil:'load'});
  await page.evaluate(()=>document.fonts.ready.then(()=>undefined));
  if(errors.length)throw new Error(errors.join('; '));
  return await fn(page);
 }finally{await browser.close();}
}

/** Renders the logo to a transparent PNG at the given width. */
export async function logoPng(logo:string,width:number,out:string){
 const w=Math.max(16,Math.round(width)),box=w*4;
 const html=`<!doctype html><html><head><style>html,body{margin:0;background:transparent}img{display:block;width:${w}px;height:auto}</style></head><body><img id="l" src="http://brand.local/logo"></body></html>`;
 await withPage(box,box,{logo},html,async page=>{
  await page.waitForFunction(()=>(document.getElementById('l') as HTMLImageElement).complete);
  const el=await page.$('#l');if(!el)throw new Error('Logo did not load');
  await fs.writeFile(out,await el.screenshot({omitBackground:true,type:'png'}));
 });
 return out;
}

const esc=(s:string)=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));

/** Renders an animated end card as an H.264 clip with the given size, frame rate and length. */
export async function endCard(opts:{width:number;height:number;fps:number;duration:number;text?:string;out:string;logo?:LogoChoice}){
 const {brand,logo,font}=await brandAssets(opts.logo??'primary');
 const c=brand.colors,bg=c.background??'#FFFFFF',ink=c.text??'#111318',accent=c.accent??c.primary??'#2563EB',primary=c.primary??accent;
 const text=(opts.text??brand.name).trim();
 const dir=isRtl(detectLanguage(text),text)?'rtl':'ltr';
 const {width:W,height:H}=opts;const logoW=Math.round(Math.min(W,H)*.52),size=Math.round(Math.min(W,H)*.075);
 const files:Record<string,string>={logo,...(font?{font}:{})};
 const html=`<!doctype html><html><head><meta charset="utf-8"><style>
${font?`@font-face{font-family:Brand;src:url(http://brand.local/font);font-weight:100 900}`:''}
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:${bg}}
.blob{position:absolute;border-radius:50%;filter:blur(${Math.round(W*.06)}px);opacity:.35}
#a{width:${W*.7}px;height:${W*.7}px;background:${accent}}#b{width:${W*.6}px;height:${W*.6}px;background:${primary}}
#stage{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(H*.035)}px}
#logo{width:${logoW}px;height:auto;will-change:transform}
#text{font-family:${font?'Brand,':''}system-ui,sans-serif;font-weight:700;font-size:${size}px;color:${ink};direction:${dir};text-align:center;max-width:${Math.round(W*.8)}px;line-height:1.15}
#bar{height:${Math.max(4,Math.round(size*.12))}px;width:${Math.round(W*.22)}px;background:${accent};border-radius:99px;transform-origin:center}
</style></head><body><div class="blob" id="a"></div><div class="blob" id="b"></div>
<div id="stage"><img id="logo" src="http://brand.local/logo"><div id="text">${esc(text)}</div><div id="bar"></div></div>
<script>
const clamp=x=>Math.min(1,Math.max(0,x));
const out=x=>1-Math.pow(1-x,3);
const spring=x=>x>=1?1:1-Math.exp(-6*x)*Math.cos(9*x);
window.draw=t=>{
 const W=${W},H=${H};
 document.getElementById('a').style.transform='translate('+(W*.55+Math.sin(t*.9)*W*.08)+'px,'+(-W*.15+Math.cos(t*.7)*W*.06)+'px)';
 document.getElementById('b').style.transform='translate('+(-W*.25+Math.cos(t*.8)*W*.07)+'px,'+(H*.62+Math.sin(t*.6)*W*.05)+'px)';
 const l=clamp(t/.7),s=.6+.4*spring(l),drift=1+.025*clamp((t-.7)/3);
 const logo=document.getElementById('logo');logo.style.opacity=String(clamp(t/.25));logo.style.transform='scale('+(s*drift)+')';
 const p=out(clamp((t-.35)/.55)),text=document.getElementById('text');text.style.opacity=String(p);text.style.transform='translateY('+((1-p)*${Math.round(size*.8)})+'px)';
 document.getElementById('bar').style.transform='scaleX('+out(clamp((t-.6)/.5))+')';
};
window.draw(0);
</script></body></html>`;
 const frames=Math.max(1,Math.round(opts.duration*opts.fps));
 await fs.mkdir(path.dirname(opts.out),{recursive:true});
 await withPage(W,H,files,html,async page=>{
  await page.waitForFunction(()=>(document.getElementById('logo') as HTMLImageElement).complete);
  const enc=spawn(ffmpeg,['-hide_banner','-loglevel','error','-n','-f','image2pipe','-framerate',String(opts.fps),'-c:v','png','-i','-',
   '-c:v','libx264','-preset','veryfast','-crf','14','-pix_fmt','yuv420p','-r',String(opts.fps),opts.out],{windowsHide:true,stdio:['pipe','ignore','pipe']});
  let err='';enc.stderr.on('data',d=>err=(err+d).slice(-3000));
  const done=new Promise<number>((resolve,reject)=>{enc.once('error',reject);enc.once('close',code=>resolve(code??1));});
  for(let i=0;i<frames;i++){
   await page.evaluate(t=>(window as unknown as {draw:(t:number)=>void}).draw(t),i/opts.fps);
   const png=await page.screenshot({type:'png'});
   if(!enc.stdin.write(png))await new Promise(r=>enc.stdin.once('drain',r));
  }
  enc.stdin.end();
  if(await done!==0)throw new Error('FFmpeg failed while encoding the end card: '+err);
 });
 return opts.out;
}

