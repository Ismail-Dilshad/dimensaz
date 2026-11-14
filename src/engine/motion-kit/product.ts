// A product photo becomes a moving scene: the product (cut out of its background when the media
// tools can, or already transparent) floats in front of a backdrop of its own colours, turns a
// little in depth, casts a soft shadow, and a band of light passes over it. Without a cut-out the
// photo is a card with the same depth, light and shadow, and the note says so.
import fs from 'node:fs';
import path from 'node:path';
import {ffmpeg,probe,run} from '../../renderer/ffmpeg-encoder.js';
import {renderHtmlClip,fontFaces,dataUrl,esc,SHAPES,type Shape} from '../../renderer/html-clip.js';

export type ProductMove='orbit'|'push'|'rise';
export type ProductOptions={seconds?:number;move?:ProductMove;shape?:Shape;background?:string;title?:string;cutout?:'auto'|'none';out:string;draft?:boolean};
const hex=(r:number,g:number,b:number)=>'#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
/** The photo's own colour (its average), lightened and darkened for the backdrop. */
export async function photoColors(file:string){
 const {spawn}=await import('node:child_process');
 const px=await new Promise<Buffer>((res,rej)=>{const c=spawn(ffmpeg,['-v','error','-i',file,'-vf','scale=1:1:flags=area,format=rgb24','-frames:v','1','-f','rawvideo','-'],{windowsHide:true});const b:Buffer[]=[];c.stdout.on('data',d=>b.push(d));c.once('error',rej);c.once('close',()=>res(Buffer.concat(b)));});
 const [r,g,b]=[px[0]??128,px[1]??128,px[2]??128],l=(r*.3+g*.59+b*.11)/255;
 const mix=(t:number,to:number)=>hex(r+(to-r)*t,g+(to-g)*t,b+(to-b)*t);
 return {base:hex(r,g,b),light:mix(.55,255),dark:mix(.6,10),isLight:l>.55};
}
async function hasAlpha(file:string){try{const s=((await probe(file)).streams as {codec_type:string;pix_fmt?:string}[]).find(x=>x.codec_type==='video');return /^(rgba|bgra|argb|abgr|ya8|ya16|yuva\w*|gbrap\w*|rgba64\w*)$/.test(s?.pix_fmt??'');}catch{return false;}}

export async function productMotion(photo:string,o:ProductOptions){
 const file=path.resolve(photo);if(!fs.existsSync(file))throw new Error('No such photo: '+photo);
 const seconds=Math.max(2,Math.min(20,o.seconds??6)),shape=o.shape??'9:16',[W,H]=SHAPES[shape],move=o.move??'orbit';
 // The product, cut out of its background.
 let layer=file,cut=await hasAlpha(file),note='';
 if(!cut&&o.cutout!=='none'){
  try{const {runPythonModule}=await import('../audio-analysis.js');const dir=path.join(path.dirname(path.resolve(o.out)),'.cutout');fs.mkdirSync(dir,{recursive:true});
   const r=await runPythonModule('media_tools.cli',['cutout',file,'--out-dir',dir],{label:'Cut-out'}) as {results?:{output:string}[]};const f=r.results?.[0]?.output;if(f&&fs.existsSync(f)){layer=f;cut=true;}}
  catch{note='The photo is shown as a card: cutting the product out needs the media tools (pnpm tempoloom media setup, then pnpm tempoloom media download cutout), or give a PNG with a transparent background.';}
 }
 // A big photo is scaled down first (the page carries it inline).
 const small=path.join(path.dirname(path.resolve(o.out)),`.product-${path.basename(layer,path.extname(layer))}.png`);fs.mkdirSync(path.dirname(small),{recursive:true});
 await run(ffmpeg,['-v','error','-y','-i',layer,'-vf','scale=w=min(1400\\,iw):h=-2','-frames:v','1',small]);
 const col=await photoColors(file),bg=o.background&&o.background!=='auto'?o.background:null,src=dataUrl(small),f=o.title?await fontFaces(o.title):null;
 const html=`<!doctype html><html><head><meta charset="utf-8"><style>${f?.css??''}
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:${bg??col.dark}}
#bg{position:absolute;inset:-6%;background:${bg?bg:`radial-gradient(120% 90% at 50% 38%,${col.light} 0%,${col.base} 45%,${col.dark} 100%)`}}
#blur{position:absolute;inset:-12%;background:url(${src}) center/cover;filter:blur(60px) saturate(1.1);opacity:${cut?0:.55}}
#stage{position:absolute;inset:0;perspective:1400px;display:flex;align-items:center;justify-content:center}
#p{position:relative;width:${shape==='16:9'?46:72}%;height:${shape==='16:9'?70:52}%;transform-style:preserve-3d}
#img{position:absolute;inset:0;background:url(${src}) center/contain no-repeat;${cut?'':'border-radius:28px;background-size:cover;box-shadow:0 30px 80px #0007;'}}
#light{position:absolute;inset:0;-webkit-mask:url(${src}) center/${cut?'contain':'cover'} no-repeat;mask:url(${src}) center/${cut?'contain':'cover'} no-repeat;${cut?'':'border-radius:28px;'}
background:linear-gradient(105deg,transparent 35%,#ffffff99 50%,transparent 65%) no-repeat;background-size:250% 100%;mix-blend-mode:screen}
#shadow{position:absolute;left:50%;bottom:${shape==='16:9'?12:20}%;width:${shape==='16:9'?36:56}%;height:5%;margin-left:-${shape==='16:9'?18:28}%;border-radius:50%;background:radial-gradient(closest-side,#000a,#0000);filter:blur(10px)}
#title{position:absolute;left:8%;right:8%;bottom:${shape==='9:16'?14:8}%;text-align:center;font:700 ${Math.round(H*.038)}px/1.2 ${f?.family??'sans-serif'};color:${col.isLight&&!bg?'#111':'#fff'};opacity:0}
</style></head><body><div id="bg"></div><div id="blur"></div><div id="shadow"></div><div id="stage"><div id="p"><div id="img"></div><div id="light"></div></div></div>
${o.title?`<div id="title" dir="${f?.rtl?'rtl':'auto'}">${esc(o.title)}</div>`:''}
<script>
const D=${seconds},move=${JSON.stringify(move)},ease=x=>x<0?0:x>1?1:1-Math.pow(1-x,3),io=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
window.render=t=>{const u=t/D,p=document.getElementById('p'),bg=document.getElementById('bg'),sh=document.getElementById('shadow'),li=document.getElementById('light'),ti=document.getElementById('title');
 const fl=Math.sin(t*1.6)*1.2,enter=ease(t/1.1);let ry=0,rx=4,s=1,y=fl,o=1;
 if(move==='orbit'){ry=Math.sin(u*Math.PI*2)*16;rx=4+Math.sin(u*Math.PI*2+1)*2;s=.94+.06*enter;}
 else if(move==='push'){s=.9+.18*io(u);ry=-6+12*io(u);}
 else{y=fl+(1-enter)*22;o=enter;ry=Math.sin(u*Math.PI)*8;}
 p.style.transform='translateY('+y+'%) scale('+s+') rotateX('+rx+'deg) rotateY('+ry+'deg)';p.style.opacity=o;
 bg.style.transform='translateX('+(-ry*.35)+'%) scale('+(1.02+.04*u)+')';
 sh.style.transform='scaleX('+(1-(y-fl)*.01+fl*.02)+')';sh.style.opacity=(.85-fl*.05)*o;
 // The band of light passes once a third of the way in, and again near the end.
 const pass=x=>x<0||x>1?-1:x,a=pass((t-D*.28)/1.1),b=pass((t-D*.78)/1.1),q=a>=0?a:b;li.style.backgroundPosition=(q<0?-100:100-q*200)+'% 0';li.style.opacity=q<0?0:.9;
 if(ti)ti.style.opacity=ease((t-.6)/.8);};
</script></body></html>`;
 const r=await renderHtmlClip({html,width:W,height:H,duration:seconds,out:o.out,...(o.draft?{draft:true}:{})});
 fs.rmSync(small,{force:true});
 return {...r,move,shape,cutOut:cut,colors:col,note:note||(cut?'The product floats in front of a backdrop of its own colours.':'')};
}
