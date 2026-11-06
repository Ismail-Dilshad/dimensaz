import {referenceLayerSample,referenceCamera,mechanismSample} from '../animations/reference-motion.js';
import {clamp} from '../animations/easing.js';
import type {Config,Scene} from '../engine/schema.js';
type Rect={x:number;y:number;w:number;h:number};
export function referenceRects(scene:Scene,c:Config){
 const sx=c.safeX,top=c.safeTop,bottom=1-c.safeBottom,w=1-2*sx,h=bottom-top;
 const r=scene.referenceMotion!;
 if(r.composition)return {text:r.composition.text,hero:r.composition.hero};
 const topText={x:sx,y:top,w,h:h*.27},bottomText={x:sx,y:top+h*.72,w,h:h*.28};
 const fullHero={x:sx,y:top+h*.3,w,h:h*.67};
 if(r.layout==='headline-bottom')return {text:bottomText,hero:{x:sx,y:top,w,h:h*.68}};
 if(r.layout==='headline-left')return {text:{x:sx,y:top+h*.2,w:w*.48,h:h*.55},hero:{x:sx+w*.49,y:top+h*.14,w:w*.51,h:h*.7}};
 if(r.layout==='headline-right')return {text:{x:sx+w*.52,y:top+h*.2,w:w*.48,h:h*.55},hero:{x:sx,y:top+h*.14,w:w*.51,h:h*.7}};
 return {text:topText,hero:fullHero};
}
function place(el:HTMLElement,r:Rect){Object.assign(el.style,{left:r.x*100+'%',top:r.y*100+'%',width:r.w*100+'%',height:r.h*100+'%'});}
export function referenceStage(scene:Scene,c:Config,assets:Record<string,string>){
 const r=scene.referenceMotion!,s=c.referenceStyle!,rects=referenceRects(scene,c);
 const element=document.createElement('div');element.dataset.referenceStage=scene.id;
 element.style.cssText='position:absolute;inset:0;pointer-events:none';
 type Options={entrance:typeof r.entrance;delay:number;rotation:number;travelX:number;travelY:number;loop:string;origin?:{x:number;y:number};keyframes?:NonNullable<typeof r.layers[number]['keyframes']>;beat?:typeof r.layers[number]['beat']};
 const layers:({el:HTMLElement;role:string}&Options)[]=[];
 const add=(id:string,rect:Rect,role:string,options:Options,depth=2)=>{
  if(!assets[id])throw new Error('Missing reference layer asset '+id);
  const wrapper=document.createElement('div');wrapper.dataset.referenceLayer=role;wrapper.dataset.asset=id;
  wrapper.style.cssText='position:absolute;transform-origin:'+(options.origin?options.origin.x*100+'% '+options.origin.y*100+'%':'center')+';z-index:'+depth;
  place(wrapper,rect);
  const img=new Image();img.src=assets[id];img.alt='';img.style.cssText='width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 '+c.height*.012+'px '+c.width*.018+'px '+s.shadow+'77)';
  wrapper.append(img);element.append(wrapper);layers.push({el:wrapper,role,...options});
 };
 element.style.zIndex=r.composition?.textDepth==='behind'?'5':'2';
 const shadow=document.createElement('div');
 shadow.style.cssText='position:absolute;left:'+(rects.hero.x+rects.hero.w*.15)*100+'%;top:'+(rects.hero.y+rects.hero.h*.88)*100+'%;width:'+rects.hero.w*70+'%;height:4%;background:'+s.shadow+';opacity:.22;border-radius:50%;filter:blur('+c.width*.025+'px)';
 if(s.card!=='Violet Cutout')element.append(shadow);
 if(r.ghost){
  const ghost=document.createElement('div');ghost.dataset.referenceGhost='true';ghost.dir=scene.direction;
  ghost.textContent=scene.highlights.map(h=>scene.text.slice(h.start,h.end)).join(' ');
  ghost.style.cssText='position:absolute;left:6%;right:6%;top:42%;font-family:VideoPrimary;font-size:'+c.width*.15+'px;color:'+s.accent+';opacity:.07;white-space:nowrap;text-align:center';
  element.append(ghost);
 }
 add(scene.asset!,rects.hero,'hero',{entrance:r.entrance,delay:0,rotation:r.rotation,travelX:0,travelY:0,loop:r.heroLoop??'float',...r.heroMotion});
 for(const p of r.layers)add(p.asset,{x:p.x-p.width/2,y:p.y-p.height/2,w:p.width,h:p.height},p.role,p,p.depth==='behind'?1:3);
 return {element,rects,render:(t:number)=>{
  const camera=referenceCamera(t,scene.duration,r.camera,c.reducedMotion);
  element.style.transform='translateX('+camera.x+'px) scale('+camera.scale+')';
  for(const [i,p] of layers.entries()){
   if(p.keyframes){
    const reducedCard=c.reducedMotion&&!!s.card;
    const k=mechanismSample(t,scene.duration,p.keyframes,c.reducedMotion&&!s.card,!!s.card);
    p.el.style.opacity=String(k.opacity);
    p.el.style.transform=reducedCard?'rotate('+p.rotation+'deg)':'translate('+(k.x*c.width)+'px,'+(k.y*c.height)+'px) rotate('+(p.rotation+k.rotation)+'deg) scale('+k.scale+')';
    if(p.role==='hero'){
     shadow.style.opacity=String(.22*k.opacity);
     shadow.style.transform=reducedCard?'none':'translateX('+(k.x*c.width)+'px) scaleX('+k.scale+')';
    }
    continue;
   }
   if(s.card){
    const beat=p.beat;
    const q=beat?clamp((t-beat.start)/beat.duration):1;
    // Quintic smoothstep: both velocity and acceleration meet the holds at zero.
    const remaining=1-q*q*q*(10+q*(-15+6*q));
    const travel=c.reducedMotion?0:remaining;
    const visible=c.reducedMotion?(q===0?1:0):remaining;
    p.el.style.opacity=String(1-((1-(beat?.fromOpacity??1))*visible));
    p.el.style.transform='translate('+((beat?.fromX??0)*c.width*travel)+'px,'+((beat?.fromY??0)*c.height*travel)+'px) rotate('+(p.rotation+(beat?.fromRotation??0)*travel)+'deg) scale('+(1+((beat?.fromScale??1)-1)*travel)+')';
    continue;
   }
   const m=p.role==='hero'&&r.continuity==='carry-hero'?{x:0,y:0,scale:1,opacity:1}:referenceLayerSample(t,scene.duration,p.entrance,p.delay,c.reducedMotion);
   const age=Math.max(0,t-scene.duration*p.delay),q=c.reducedMotion?1:clamp(age/(scene.duration*.55));
   const float=c.reducedMotion||p.loop!=='float'?0:Math.sin(age*1.4+i)*c.height*.004;
   const rotation=p.rotation+(c.reducedMotion?0:p.loop==='rotate'?age*12:p.loop==='float'?Math.sin(age*.8+i)*1.2:0);
   const pulse=c.reducedMotion||p.loop!=='pulse'?1:1+Math.sin(age*3)*.035;
   p.el.style.opacity=String(m.opacity);
   p.el.style.transform='translate('+(m.x*c.width/1080+p.travelX*c.width*q)+'px,'+(m.y*c.height/1920+float+p.travelY*c.height*q)+'px) rotate('+rotation+'deg) scale('+(m.scale*pulse)+')';
  }
 }};
}

