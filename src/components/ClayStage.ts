import type {Config,Scene} from '../engine/schema.js';
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
export function clayStage(scene:Scene,c:Config,src:string){
 const el=document.createElement('div');el.dataset.clayStage='true';el.style.cssText='position:absolute;left:50%;top:11%;width:760px;height:720px;margin-left:-380px;transform-origin:50% 50%;pointer-events:none';
 const parts:HTMLElement[]=[];
 const add=(css:string)=>{const x=document.createElement('div');x.style.cssText='position:absolute;'+css;el.append(x);parts.push(x);return x;};
 add('left:56px;top:75px;width:650px;height:580px;border-radius:48%;background:linear-gradient(140deg,#edf4ff,#c4d6f5);box-shadow:inset 12px 12px 24px #ffffffbb,inset -14px -18px 28px #a7bbd77a,20px 35px 50px #7f95b425;');
 const phone=['social','communication','technology'].includes(scene.asset??'');
 const card=add('left:'+(phone?210:155)+'px;top:95px;width:'+(phone?340:450)+'px;height:445px;border:3px solid #ffffffb0;border-radius:'+(phone?65:100)+'px;background:linear-gradient(135deg,#ffffff,#e2e8f2);box-shadow:inset 8px 8px 12px #fff,inset -10px -10px 20px #b8c5dc,14px 24px 2px #b3c2da,24px 42px 40px #45658e35;');
 const img=new Image();img.src=src;img.alt='';img.style.cssText='position:absolute;width:92%;height:85%;object-fit:contain;left:4%;top:7%;';card.append(img);
 if(phone){const speaker=document.createElement('div');speaker.style.cssText='position:absolute;top:26px;left:38%;width:24%;height:12px;border-radius:20px;background:#bac8df;box-shadow:inset 0 3px 4px #7389ae50';card.append(speaker);}
 const mint=add('left:570px;top:70px;width:130px;height:130px;border-radius:44px;background:linear-gradient(135deg,#e9fff1,#95d6b7);box-shadow:inset 6px 6px 10px #ffffffa0,inset -7px -8px 12px #5aa98755,10px 18px 24px #4b79602b;');
 mint.innerHTML='<div style="position:absolute;left:44px;top:35px;width:32px;height:48px;border-right:13px solid white;border-bottom:13px solid white;transform:rotate(40deg);border-radius:7px"></div>';
 add('left:55px;top:430px;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle at 30% 25%,#fff0df,#efbba9 65%,#d39786);box-shadow:inset -8px -10px 15px #b5786940,12px 20px 28px #93756525;');
 add('left:610px;top:450px;width:65px;height:65px;border-radius:50%;background:radial-gradient(circle at 30% 25%,#fff,#8ba9ee);box-shadow:8px 12px 14px #45658e25;');
 const ring=add('left:82px;top:82px;width:70px;height:70px;border:22px solid #f8fbff;border-radius:50%;box-shadow:inset 4px 4px 7px #a7b7cf,6px 10px 12px #617b9d26;');
 const panel=document.createElement('div');panel.style.cssText='position:absolute;left:7%;right:7%;top:55%;height:30%;border-radius:58px;background:linear-gradient(135deg,#ffffff,#f0f3f9);border:2px solid #ffffff;box-shadow:inset 5px 5px 10px #fff,inset -8px -8px 16px #d5ddeb70,14px 22px 40px #6983a51b;';
 return {element:el,panel,render:(t:number)=>{
 const variant=Number(scene.id.replace(/\D/g,''))||0;
 for(const [i,x] of parts.entries()){const age=Math.max(0,t-i*.065);const q=c.reducedMotion?1:1-Math.exp(-7*age)*Math.cos(10*age);const settle=clamp(age/.18);const drift=c.reducedMotion?0:Math.sin(t*1.35+i)*9;const tilt=c.reducedMotion?0:Math.sin(t*.8+i)*2+(i===1?(variant%2? -5:5):0);x.style.opacity=String(c.reducedMotion?1:settle);x.style.transform='translateY('+((1-q)*100+drift)+'px) rotate('+tilt+'deg) scale('+(.78+.22*q)+')';}
 el.style.transform='scale('+Math.min(c.width/1080,c.height/1920)+')';
 panel.style.transform=c.reducedMotion?'none':'translateY('+((1-Math.min(1,t/.45))*35)+'px)';
 }};
}
