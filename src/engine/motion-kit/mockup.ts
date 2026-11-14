// Screenshots inside a moving device: a phone, a tablet or a laptop (generic designs, no brand's
// product), turning gently in depth, sliding in or tilting up to face the viewer. Several
// screenshots follow one another on the screen; a screenshot taller than the screen scrolls.
import fs from 'node:fs';
import path from 'node:path';
import {ffmpeg,run,probe} from '../../renderer/ffmpeg-encoder.js';
import {renderHtmlClip,dataUrl,SHAPES,type Shape} from '../../renderer/html-clip.js';
import {photoColors} from './product.js';

export type Device='phone'|'tablet'|'laptop';
export type MockupMove='float'|'tilt'|'slide';
export type MockupOptions={device?:Device;move?:MockupMove;seconds?:number;shape?:Shape;background?:string;out:string;draft?:boolean};
const SCREEN:Record<Device,{w:number;h:number}>={phone:{w:9,h:19.5},tablet:{w:3,h:4},laptop:{w:16,h:10}};

export async function mockupMotion(shots:string[],o:MockupOptions){
 if(!shots.length)throw new Error('Give at least one screenshot');if(shots.length>6)throw new Error('At most 6 screenshots');
 const files=shots.map(s=>path.resolve(s));for(const f of files)if(!fs.existsSync(f))throw new Error('No such screenshot: '+f);
 const device=o.device??'phone',move=o.move??'float',shape=o.shape??(device==='laptop'?'16:9':'9:16'),[W,H]=SHAPES[shape],seconds=Math.max(2,Math.min(30,o.seconds??(3+2.5*files.length)));
 // Each screenshot, scaled to the screen's width (a taller one keeps its height, to scroll).
 const tmp=path.join(path.dirname(path.resolve(o.out)),'.mockup');fs.mkdirSync(tmp,{recursive:true});
 const shotsIn=await Promise.all(files.map(async(f,i)=>{const s=((await probe(f)).streams as {width?:number;height?:number}[])[0]!,out=path.join(tmp,`shot-${i}.jpg`);
  await run(ffmpeg,['-v','error','-y','-i',f,'-vf','scale=w=min(1200\\,iw):h=-2','-frames:v','1','-q:v','3',out]);return {src:dataUrl(out),ratio:Number(s.height)/Number(s.width),file:out};}));
 const scr=SCREEN[device],col=await photoColors(files[0]!),bg=o.background??`radial-gradient(110% 80% at 50% 30%,${col.light},${col.base} 55%,${col.dark})`;
 // The device's size in the frame: as large as fits with room around it.
 const devH=device==='laptop'?Math.min(H*.6,W*.62*scr.h/scr.w):Math.min(H*.78,W*.72*scr.h/scr.w),devW=devH*scr.w/scr.h;
 const html=`<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}
#bg{position:absolute;inset:0;background:${bg}}
#stage{position:absolute;inset:0;perspective:${Math.round(W*1.6)}px;display:flex;align-items:center;justify-content:center}
#dev{position:relative;transform-style:preserve-3d}
.screen{position:absolute;overflow:hidden;background:#000}
.shot{position:absolute;left:0;top:0;width:100%;opacity:0}
.shot img{display:block;width:100%}
#glare{position:absolute;inset:0;background:linear-gradient(115deg,#ffffff00 40%,#ffffff26 50%,#ffffff00 60%) no-repeat;background-size:260% 100%;pointer-events:none}
#shadow{position:absolute;left:50%;top:50%;width:${Math.round(devW*1.1)}px;height:${Math.round(devH*.08)}px;margin:${Math.round(devH*.52)}px 0 0 -${Math.round(devW*.55)}px;border-radius:50%;background:radial-gradient(closest-side,#0008,#0000);filter:blur(14px)}
${device==='laptop'?`
#dev{width:${Math.round(devW)}px;height:${Math.round(devH)}px}
#lid{position:absolute;inset:0;border-radius:${Math.round(devH*.035)}px;background:linear-gradient(#2b2d33,#17181c);box-shadow:inset 0 0 0 2px #3a3d44}
#lid .screen{left:3.2%;right:3.2%;top:5%;bottom:5%;border-radius:4px}
#base{position:absolute;left:-9%;right:-9%;top:100%;height:${Math.round(devH*.055)}px;background:linear-gradient(#c9ccd2,#8e9299);border-radius:0 0 ${Math.round(devH*.04)}px ${Math.round(devH*.04)}px;clip-path:polygon(4% 0,96% 0,100% 100%,0 100%)}
#base:after{content:'';position:absolute;left:42%;right:42%;top:0;height:35%;background:#7d8188;border-radius:0 0 8px 8px}`
:`
#dev{width:${Math.round(devW)}px;height:${Math.round(devH)}px;border-radius:${Math.round(devW*(device==='phone'?.14:.06))}px;background:linear-gradient(140deg,#3a3d44,#141518);box-shadow:inset 0 0 0 ${Math.max(2,Math.round(devW*.008))}px #55585f,0 ${Math.round(devH*.04)}px ${Math.round(devH*.08)}px #0006}
#dev .screen{inset:${Math.round(devW*(device==='phone'?.035:.045))}px;border-radius:${Math.round(devW*(device==='phone'?.11:.035))}px}
${device==='phone'?`#cam{position:absolute;left:50%;top:${Math.round(devW*.06)}px;width:${Math.round(devW*.26)}px;height:${Math.round(devW*.07)}px;margin-left:-${Math.round(devW*.13)}px;border-radius:99px;background:#0b0b0d}`:''}`}
</style></head><body><div id="bg"></div><div id="shadow"></div><div id="stage"><div id="dev">
${device==='laptop'?'<div id="lid"><div class="screen" id="screen"></div></div><div id="base"></div>':'<div class="screen" id="screen"></div><div id="cam"></div>'}
</div></div>
<script>
const D=${seconds},move=${JSON.stringify(move)},shots=${JSON.stringify(shotsIn.map(s=>({src:s.src,ratio:s.ratio})))},screen=document.getElementById('screen');
// A screenshot wider than the screen fills its height (centred); a taller one fills its width and scrolls.
shots.forEach((s,i)=>{const d=document.createElement('div');d.className='shot';d.id='s'+i;const wide=s.ratio<screen.clientHeight/screen.clientWidth;
 if(wide)d.style.height='100%';d.innerHTML='<img src="'+s.src+'"'+(wide?' style="height:100%;width:auto;max-width:none;position:absolute;left:50%;transform:translateX(-50%)"':'')+'>';screen.appendChild(d);});
const g=document.createElement('div');g.id='glare';screen.appendChild(g);
const ease=x=>x<0?0:x>1?1:1-Math.pow(1-x,3),io=x=>x<0?0:x>1?1:x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
const enter=.9,per=(D-enter)/shots.length;
window.render=t=>{const dev=document.getElementById('dev'),sw=screen.clientWidth,sh=screen.clientHeight;let rx=0,ry=0,y=0,x=0,s=1;
 const e=ease(t/enter);
 if(move==='float'){ry=-14+Math.sin(t*.9)*6;rx=6+Math.sin(t*.7)*2;y=Math.sin(t*1.4)*1.2;s=.9+.1*e;}
 else if(move==='tilt'){rx=40*(1-io(t/1.6))+3;ry=-8*(1-io(t/1.6))+Math.sin(t*.8)*3;y=(1-e)*12;}
 else{x=(1-e)*110;ry=-25*(1-e)-6+Math.sin(t*.8)*3;}
 dev.style.transform='translate('+x+'%,'+y+'%) scale('+s+') rotateX('+rx+'deg) rotateY('+ry+'deg)';
 document.getElementById('shadow').style.opacity=.9*e;
 // Each screenshot in turn (crossfading); one taller than the screen scrolls down while it shows.
 shots.forEach((sh2,i)=>{const el=document.getElementById('s'+i),a=enter+i*per-(i?.35:enter),u=(t-(enter+i*per))/per;
  const op=i===0?(u<1||i===shots.length-1?1:1-ease((t-(enter+(i+1)*per)+.35)/.35)):Math.min(ease((t-a)/.35),i===shots.length-1?1:1-ease((t-(enter+(i+1)*per)+.35)/.35));
  el.style.opacity=Math.max(0,op);const over=Math.max(0,sw*sh2.ratio-sh);el.style.transform='translateY('+(-over*io((u-.15)/.7))+'px)';});
 const q=(t-D*.45)/1.2;g.style.backgroundPosition=(q<0||q>1?-100:100-q*200)+'% 0';};
</script></body></html>`;
 const r=await renderHtmlClip({html,width:W,height:H,duration:seconds,out:o.out,...(o.draft?{draft:true}:{})});
 fs.rmSync(tmp,{recursive:true,force:true});
 return {...r,device,move,shape,screenshots:files.length,note:'A generic device (no brand\'s product).'};
}
