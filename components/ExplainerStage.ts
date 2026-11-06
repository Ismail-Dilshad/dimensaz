import type {Project} from '../engine/schema.js';
import {iconSvg} from './ExplainerIcons.js';
import {sceneTemplates} from '../engine/explainer-templates.js';

const ease=(x:number)=>{const t=Math.max(0,Math.min(1,x));return 1-(1-t)**3;};
export function explainerZones(width:number,height:number){
 const wide=width>height*1.2;
 return wide?{icons:{x:.07,y:.18,w:.38,h:.62},text:{x:.52,y:.16,w:.39,h:.67}}:
 {icons:{x:.1,y:.14,w:.8,h:width===height?.32:.36},text:{x:.09,y:width===height?.51:.55,w:.82,h:width===height?.35:.31}};
}
export function explainerStage(p:Project,root:HTMLElement){
 const c=p.config,t=c.explainer!,W=c.width,H=c.height,d=t.duration,zones=explainerZones(W,H);
 root.style.cssText=`position:relative;overflow:hidden;width:${W}px;height:${H}px;background:${t.background};color:${t.ink}`;
 const backdrop=document.createElement('div');backdrop.style.cssText='position:absolute;inset:0;pointer-events:none;opacity:.28';
 const patterns={none:'none',grid:`linear-gradient(${t.tint} 1px,transparent 1px),linear-gradient(90deg,${t.tint} 1px,transparent 1px)`,dots:`radial-gradient(${t.accent} 1.4px,transparent 1.6px)`,gradient:`linear-gradient(135deg,${t.tint},transparent 65%)`,texture:`repeating-linear-gradient(35deg,${t.tint} 0 1px,transparent 1px 8px)`,mesh:`radial-gradient(ellipse at 5% 20%,${t.tint},transparent 50%),radial-gradient(ellipse at 95% 85%,${t.tint},transparent 50%)`};
 backdrop.style.backgroundImage=patterns[t.backgroundStyle];if(['grid','dots'].includes(t.backgroundStyle))backdrop.style.backgroundSize=(W/18)+'px '+(W/18)+'px';root.append(backdrop);
 const views=p.scenes.map((s,index)=>{
  const plan=s.explainer!,template=sceneTemplates[plan.template],layer=document.createElement('section');layer.dataset.scene=s.id;layer.dataset.template=plan.template;layer.style.cssText='position:absolute;inset:0';root.append(layer);
  const iconZone=document.createElement('div');iconZone.dataset.zone='icons';layer.append(iconZone);
  const textZone=document.createElement('div');textZone.dataset.zone='text';layer.append(textZone);
  for(const [el,r] of [[iconZone,zones.icons],[textZone,zones.text]] as const)el.style.cssText=`position:absolute;left:${r.x*100}%;top:${r.y*100}%;width:${r.w*100}%;height:${r.h*100}%;`;
  // Opaque local panel guarantees the measured text contrast on patterned backgrounds.
  textZone.style.background=t.background;textZone.style.borderRadius='24px';textZone.style.display='flex';textZone.style.flexDirection='column';textZone.style.justifyContent='center';textZone.style.gap=(H*.012)+'px';textZone.style.textAlign='center';
  const total=plan.icons.length,iw=zones.icons.w*W,ih=zones.icons.h*H;
  const mainSize=Math.min(iw*.62,ih*(total>1?.6:.84))*template.heroScale;
  const symbols=plan.icons.map((icon,i)=>{
   const node=document.createElement('div');node.dataset.icon=icon.name;node.dataset.meaning=icon.meaning;
   const size=i===0?mainSize:mainSize*.34;
   const x=i===0?iw/2:iw*(s.direction==='rtl'?1-i/total:i/total);const y=i===0?ih*(total>1?.34:.5):ih*.83;
   node.style.cssText=`position:absolute;left:${x-size/2}px;top:${y-size/2}px;width:${size}px;height:${size}px;opacity:${i?'.8':'1'}`;
   node.innerHTML=iconSvg(icon.name,t);iconZone.append(node);return {node,icon,size};
  });
  const phrases=plan.phrases.map((phrase,i)=>{
   const node=document.createElement('div');node.dataset.phrase=String(i);node.setAttribute('dir',s.direction);node.style.cssText=`font-family:VideoPrimary,${c.fallbacks.map((_,i)=>'VideoFallback'+i).join(',')};line-height:1.4;unicode-bidi:plaintext;white-space:pre-wrap;overflow-wrap:normal;flex-shrink:0;padding:0 12px;`;
   const copy=s.text.slice(phrase.from,phrase.to),leading=copy.match(/^\s*/u)![0],trailing=copy.match(/\s*$/u)![0];
   const span=document.createElement('span');span.textContent=copy.slice(leading.length,copy.length-trailing.length);span.style.boxDecorationBreak='clone';
   if(phrase.highlight){if(t.highlight==='color')span.style.color=t.accent;else if(t.highlight==='underline'){span.style.textDecoration='underline';span.style.textDecorationColor=t.accent;span.style.textDecorationThickness='.055em';span.style.textUnderlineOffset='.13em';}else{span.style.background=t.tint;span.style.borderRadius='.12em';span.style.padding='0 .12em';}}
   // Preserve exact source separators in the DOM without painting a highlight on blank lines.
   const before=document.createElement('span'),after=document.createElement('span');before.textContent=leading;after.textContent=trailing;before.style.display=after.style.display='none';node.append(before,span,after);textZone.append(node);return {node,phrase};
  });
  if(plan.template==='stat'&&s.number!==undefined){const value=document.createElement('div');value.textContent=String(s.number);value.dataset.stat='true';value.style.cssText=`position:absolute;left:0;right:0;top:0;text-align:center;font:bold ${Math.min(W,H)*.07}px VideoPrimary;color:${t.accent}`;iconZone.append(value);}
  let font=Math.min(c.fontSize,W*.091,H*.059)*template.textScale;textZone.style.fontSize=font+'px';
  const contentHeight=()=>phrases.reduce((n,x)=>n+x.node.offsetHeight,0)+Math.max(0,phrases.length-1)*H*.012+H*.04;
  while(font>Math.min(48,W*.045)&&contentHeight()>textZone.clientHeight){font-=1;textZone.style.fontSize=font+'px';}
  const footer=document.createElement('div');footer.textContent=String(index+1).padStart(2,'0')+' / '+String(p.scenes.length).padStart(2,'0');footer.style.cssText=`position:absolute;bottom:7%;left:0;right:0;text-align:center;font:500 ${Math.min(W,H)*.018}px Arial;color:${t.accent};letter-spacing:.18em`;layer.append(footer);
  return {s,layer,phrases,symbols,font,textZone,iconZone};
 });
 window.TOTAL=p.scenes.at(-1)!.start+p.scenes.at(-1)!.duration;
 window.render=async(time:number)=>{
  for(const v of views){const local=time-v.s.start,active=local>=0&&local<v.s.duration;v.layer.style.display=active?'block':'none';if(!active)continue;
   const e=v.s.explainer!,exit=!c.reducedMotion&&e.transition==='match-slide'?ease((local-(v.s.duration-d))/d):0;
   for(const {node,icon} of v.symbols){
    const entered=c.reducedMotion?Number(local>=icon.at):ease((local-icon.at)/d);
    node.style.visibility=local<icon.at?'hidden':'visible';
    // One dominant symbol enters at a time. Supports occupy smaller, separate slots.
    node.style.transform=`translateX(${(1-entered)*W*.07-exit*W*.07}px)`;
    node.style.opacity=String(entered*(1-exit)*(node===v.symbols[0].node?1:.8));
   }
   for(const {node,phrase} of v.phrases){const q=c.reducedMotion?Number(local>=phrase.at):ease((local-phrase.at)/d);node.style.visibility=local<phrase.at?'hidden':'visible';node.style.opacity=String(q);node.style.transform=`translateY(${(1-q)*H*.007}px)`;}
  }
  const current=views.find(v=>time>=v.s.start&&time<v.s.start+v.s.duration);
  const rect=(el:Element)=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height};};
  window.qa={mode:'script-explainer',time,scene:current?.s.id,fontReady:document.fonts.check('32px VideoPrimary'),fontSize:current?.font,sourceExact:current?.phrases.map(x=>x.node.textContent).join('')===current?.s.text,
   textOverflow:current?current.textZone.scrollHeight>current.textZone.clientHeight+2||current.textZone.scrollWidth>current.textZone.clientWidth+2:false,
   directionCorrect:current?!/[\u0600-\u06ff]/u.test(current.s.text)||current.s.direction==='rtl':true,
   focalCentered:current?Math.abs((rect(current.symbols[0].node).x+rect(current.symbols[0].node).w/2)-(rect(current.iconZone).x+rect(current.iconZone).w/2))<W*.09:true,
   direction:current?.s.direction,phraseNodes:current?.phrases.length,
   boxes:current?[...current.phrases.filter(x=>x.node.style.visibility!=='hidden').map(x=>({kind:'text',...rect(x.node)})),...current.symbols.filter(x=>x.node.style.visibility!=='hidden').map(x=>({kind:'icon',name:x.icon.name,...rect(x.node)}))]:[],
   zones:current?{text:rect(current.textZone),icons:rect(current.iconZone)}:null,
   shaping:'Complete phrase DOM, font coverage and direction are structural checks; actual joining requires pixel inspection.'};
 };
 return window.render(0);
}
