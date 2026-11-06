import {videoFrame} from './VideoFrame.js';
import type {Project} from '../engine/schema.js';

const ease=(v:number)=>{const x=Math.max(0,Math.min(1,v));return x*x*(3-2*x);};
type Pen=CanvasRenderingContext2D;
function box(g:Pen,x:number,y:number,w:number,h:number,r:number,fill:string|CanvasGradient){
 g.fillStyle=fill;g.beginPath();g.roundRect(x,y,w,h,r);g.fill();
}
function line(g:Pen,points:number[][],color:string,width=2){
 g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.lineJoin='round';g.beginPath();
 points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();
}
function dot(g:Pen,x:number,y:number,r:number,color:string){g.fillStyle=color;g.beginPath();g.arc(x,y,r,0,2*Math.PI);g.fill();}
function text(g:Pen,value:string,x:number,y:number,size:number,color:string,rtl=false){
 g.direction=rtl?'rtl':'ltr';g.textAlign='center';g.font=(rtl?'normal ':'600 ')+size+'px '+(rtl?'VideoPrimary':'Arial');g.fillStyle=color;g.fillText(value,x,y);
}
function check(g:Pen,x:number,y:number,color:string){line(g,[[x-7,y],[x-2,y+5],[x+8,y-6]],color,3);}
function shadow(g:Pen){g.shadowColor='#15264c35';g.shadowBlur=22;g.shadowOffsetY=12;}
function phonePlate(g:Pen,t:number){
 // Receiver stays fixed. An outgoing bubble moves from the sender into the screen.
 g.save();g.translate(327,532);g.rotate(-.085);shadow(g);box(g,-103,-171,206,342,31,'#17233b');g.restore();
 g.save();g.translate(327,532);g.rotate(-.085);
 box(g,-95,-162,190,324,25,'#f6f9ff');box(g,-37,-149,74,10,5,'#17233b');
 box(g,-85,-123,170,35,8,'#e3eafb');dot(g,-62,-106,8,'#2765ee');box(g,-44,-109,56,6,3,'#75859f');
 box(g,-78,-65,93,32,12,'#dce4f0');box(g,-67,-52,54,5,3,'#97a7be');
 line(g,[[-70,89],[69,89]],'#cbd5e6');box(g,-69,106,136,22,11,'#e3eaf6');g.restore();
 const q=ease((t-.16)/.62),x=158+145*q,y=553-55*q-22*Math.sin(Math.PI*q);
 g.save();g.translate(x,y);g.rotate(-.08*q);shadow(g);const grad=g.createLinearGradient(-80,-32,80,32);grad.addColorStop(0,'#2866f3');grad.addColorStop(1,'#1646c4');
 box(g,-87,-33,174,66,20,grad);g.shadowColor='transparent';
 g.fillStyle='#235ce0';g.beginPath();g.moveTo(49,21);g.lineTo(79,42);g.lineTo(75,16);g.fill();
 line(g,[[-61,-7],[22,-7]],'#dbeaff',5);line(g,[[-61,7],[-5,7]],'#a5caff',5);
 g.globalAlpha=ease((t-.85)/.24);check(g,55,8,'white');g.restore();
}
function audiencePlate(g:Pen,t:number){
 // A published video reaches three people. Nodes are schematic, not audience statistics.
 g.save();shadow(g);box(g,168,360,240,144,20,'#f4f7ff');g.restore();
 box(g,177,369,222,126,15,'#1d4edb');box(g,190,382,48,6,3,'#83acff');
 g.fillStyle='white';g.beginPath();g.moveTo(275,406);g.lineTo(275,457);g.lineTo(315,432);g.closePath();g.fill();
 const targets=[107,288,469],y=655;
 targets.forEach((x,i)=>{
  const q=ease((t-.14-.15*i)/.52);
  line(g,[[288,509],[288,555],[x,555],[x,y-39]],'#455573',2);
  const route=[[288,509],[288,555],[x,555],[x,y-39]],dist=[46,Math.abs(x-288),y-39-555];let remain=q*dist.reduce((a,b)=>a+b,0);
  for(let j=0;j<3;j++){const l=dist[j];if(l===0)continue;const k=Math.min(1,remain/l);
   line(g,[route[j],[route[j][0]+(route[j+1][0]-route[j][0])*k,route[j][1]+(route[j+1][1]-route[j][1])*k]],'#85b6ff',3);remain-=k*l;if(remain<=0)break;}
  const lit=ease((t-.57-.15*i)/.30);
  dot(g,x,y,39,'#27344b');dot(g,x,y,32,lit>.5?'#e6efff':'#35415a');g.save();g.globalAlpha=.3+.7*lit;
  dot(g,x,y-8,8,'#3979ef');box(g,x-15,y+4,30,13,6,'#3979ef');g.restore();
 });
}
export async function presenterStage(p:Project,root:HTMLElement){
 const theme=p.config.presenterInserts!,w=p.config.width,h=p.config.height;
 const footage=p.media.find(m=>m.kind==='video');if(!footage)throw new Error('Presenter clip missing');
 const video=videoFrame('/media/'+encodeURIComponent(footage.id),'cover');
 root.style.cssText='position:relative;overflow:hidden;width:'+w+'px;height:'+h+'px;background:#111822';root.append(video.element);
 const design=document.createElement('canvas');design.width=w;design.height=h;design.style.cssText='position:absolute;inset:0;z-index:3';root.append(design);
 const ctx=design.getContext('2d')!;
 const cap=document.createElement('div');cap.dir=p.scenes[0].direction;
 cap.style.cssText='position:absolute;z-index:4;left:6%;width:88%;transform:translateY(-50%);font:normal '+w*.065+'px/1.28 VideoPrimary;text-align:center;text-wrap:balance;white-space:pre-line;';
 root.append(cap);
 const handle=document.createElement('div');handle.textContent=theme.handle;handle.dir='ltr';
 handle.style.cssText='position:absolute;z-index:4;top:10%;left:50%;transform:translateX(-50%);background:#162330;color:#b8d2ff;border:1px solid #7da2dc;border-radius:28px;padding:7px 21px;font:600 '+w*.045+'px Arial';root.append(handle);
 window.TOTAL=p.scenes.at(-1)!.start+p.scenes.at(-1)!.duration;
 window.render=async(time:number)=>{
  const current=p.scenes.find(s=>time>=s.start&&time<s.start+s.duration)??p.scenes.at(-1)!;
  const insert=theme.inserts.find(s=>time>=s.start&&time<s.end);
  const audience=insert?.kind==='viewers';
  ctx.clearRect(0,0,w,h);ctx.save();ctx.scale(w/576,h/1024);
  if(insert){
   video.element.style.visibility='hidden';
   const bg=ctx.createLinearGradient(0,0,576,1024);bg.addColorStop(0,audience?'#111c30':'#f8faff');bg.addColorStop(1,audience?'#192d4a':'#dfe8f9');
   ctx.fillStyle=bg;ctx.fillRect(0,0,576,1024);
   for(let i=0;i<=576;i+=32)line(ctx,[[i,0],[i,1024]],audience?'#ffffff09':'#4968980c',1);
   for(let j=0;j<=1024;j+=32)line(ctx,[[0,j],[576,j]],audience?'#ffffff09':'#4968980c',1);
   const ink=audience?'#f3f7ff':'#172740',muted=audience?'#a3b6d2':'#60708a';
   line(ctx,[[42,112],[534,112]],audience?'#465770':'#b7c4d9');
   text(ctx,theme.brand,101,92,17,muted);text(ctx,audience?'02 / 02':'01 / 02',489,92,16,muted);
   text(ctx,insert.heading,288,250,48,ink,true);
   const age=p.config.reducedMotion?3:time-insert.start;
   if(audience)audiencePlate(ctx,age);else phonePlate(ctx,age);
   line(ctx,[[48,782],[528,782]],audience?'#475a76':'#b0bfd7');
  }else{
   video.element.style.visibility='visible';await video.render(time);
  }
  ctx.restore();
  if(cap.dataset.scene!==current.id){
   cap.dataset.scene=current.id;cap.replaceChildren();let offset=0;
   for(const mark of current.highlights){
    cap.append(current.text.slice(offset,mark.start));
    const accent=document.createElement('span');accent.style.color='#a9caff';
    accent.textContent=current.text.slice(mark.start,mark.end);cap.append(accent);offset=mark.end;
   }
   cap.append(current.text.slice(offset).trimEnd());
  }
  cap.style.visibility=(!insert&&theme.inserts.some(s=>current.start<s.end&&s.end<=time&&s.end<current.start+current.duration))?'hidden':'visible';
  cap.style.top=insert?'85%':'21%';
  cap.style.color=insert?(audience?'#e0edff':'#233854'):'#f7faff';
  cap.style.fontSize=w*(insert ? .058 : .065)+'px';
  cap.style.textShadow=insert?'none':'0 2px 8px #111724';
  const fade=ease((time-theme.handleAt)/.25);
  handle.style.opacity=(!insert&&time>=theme.handleAt?fade:0).toString();
  window.qa={font:document.fonts.check('32px VideoPrimary'),texts:p.scenes.map(s=>s.text),scene:current.id};
 };
}

