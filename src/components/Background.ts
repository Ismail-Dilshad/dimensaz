import {referenceBackground} from './ReferenceBackground.js';
import {gradientFlow} from '../animations/backgrounds/gradient-flow.js';
import type {Config} from '../engine/schema.js';
export function background(c:Config){
 if(c.referenceStyle)return referenceBackground(c);
 const el=document.createElement('div');el.id='background';el.style.cssText='position:absolute;inset:-200px;z-index:0;';
 const dark=c.background==='black-grid';el.style.backgroundColor=dark?c.dark:c.white;
 if(c.background.endsWith('grid')){const line=dark?'#ffffff13':'#11131812';el.style.backgroundImage='linear-gradient('+line+' 1px,transparent 1px),linear-gradient(90deg,'+line+' 1px,transparent 1px)';el.style.backgroundSize='90px 90px';}
 if(c.background.endsWith('grid')&&c.backgroundDesign){
  const d=c.backgroundDesign,alpha=Math.round(d.gridOpacity*255).toString(16).padStart(2,'0'),line=d.gridColor+alpha;
  const layers=['linear-gradient('+line+' 1px,transparent 1px)','linear-gradient(90deg,'+line+' 1px,transparent 1px)'];
  const sizes=[d.gridSize+'px '+d.gridSize+'px',d.gridSize+'px '+d.gridSize+'px'];
  if(d.glow){layers.unshift('radial-gradient(ellipse at 80% 10%,'+c.primary+'0a,transparent 50%)');sizes.unshift('100% 100%');}
  el.style.backgroundImage=layers.join(',');el.style.backgroundSize=sizes.join(',');
 }
 if(c.background==='soft-gradient')el.style.backgroundImage='radial-gradient(ellipse at 80% 20%,'+c.primary+'28,transparent 65%)';
 if(c.background==='subtle-noise')el.style.backgroundImage='url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence baseFrequency=".7" numOctaves="3" seed="17"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)" opacity=".05"/></svg>')+'")';
 if(c.background==='abstract')el.style.backgroundImage='radial-gradient(circle at 20% 30%,'+c.primary+'16 0,transparent 35%),radial-gradient(circle at 80% 75%,'+c.primary+'12 0,transparent 30%)';
 // The video's generated style paints the whole frame: its colour and its pattern, at frame scale.
 if(c.frame){const f=c.frame,a=f.pattern.amount,W=c.width,H=c.height,z=Math.min(W,H),hex=(x:number)=>Math.round(Math.min(1,x)*255).toString(16).padStart(2,'0');
  el.style.backgroundColor=f.background;el.style.backgroundImage='';el.style.backgroundSize='';
  const glow=`radial-gradient(ellipse at 50% ${f.dark?'18%':'12%'},${f.pattern.color}${hex((f.dark?.22:.1)*a+.04)},transparent 60%)`;
  switch(f.pattern.kind){
   case 'grid':el.style.backgroundImage=`${glow},linear-gradient(${f.pattern.color}${hex(.1*a+.03)} 1px,transparent 1px),linear-gradient(90deg,${f.pattern.color}${hex(.1*a+.03)} 1px,transparent 1px)`;el.style.backgroundSize=`100% 100%,${z/12}px ${z/12}px,${z/12}px ${z/12}px`;break;
   case 'dots':el.style.backgroundImage=`${glow},radial-gradient(${f.pattern.color}${hex(.28*a+.06)} ${z*.0022}px,transparent ${z*.0026}px)`;el.style.backgroundSize=`100% 100%,${z/20}px ${z/20}px`;break;
   case 'stripes':el.style.backgroundImage=`${glow},repeating-linear-gradient(-35deg,${f.pattern.color}${hex(.07*a+.02)} 0 ${z*.012}px,transparent ${z*.012}px ${z*.034}px)`;break;
   case 'gradient':el.style.backgroundImage=`linear-gradient(160deg,${f.pattern.color}${hex(.2*a+.05)},transparent 55%),linear-gradient(340deg,${f.pattern.accent}${hex(.18*a+.04)},transparent 55%)`;break;
   case 'orbs':el.style.backgroundImage=`radial-gradient(circle at 18% 22%,${f.pattern.color}${hex(.3*a)},transparent 38%),radial-gradient(circle at 85% 78%,${f.pattern.accent}${hex(.26*a)},transparent 36%),radial-gradient(circle at 70% 18%,${f.pattern.accent}${hex(.12*a)},transparent 30%)`;break;
   case 'rings':el.style.backgroundImage=`${glow},repeating-radial-gradient(circle at 50% 55%,transparent 0 ${z*.11}px,${f.pattern.color}${hex(.12*a+.03)} ${z*.11}px ${z*.112}px)`;break;
   default:el.style.backgroundImage=glow;
  }
  return {element:el,render:()=>{}};
 }
 const d=c.director?.resolved;
 if(d){el.style.backgroundColor=d.palette.background;if(c.background.endsWith('grid')){const g=d.grid,line=g.color+Math.round(g.opacity*255).toString(16).padStart(2,'0');el.style.backgroundImage=g.geometry==='dotted'?'radial-gradient(circle,'+line+' '+g.width+'px,transparent '+(g.width+.5)+'px)':'linear-gradient('+line+' '+g.width+'px,transparent '+g.width+'px),linear-gradient(90deg,'+line+' '+g.width+'px,transparent '+g.width+'px)';el.style.backgroundSize=g.spacing+'px '+g.spacing+'px';}}
 return {element:el,render:(t:number)=>{if(c.background==='flow-gradient')el.style.backgroundImage=gradientFlow(t,c.primary,c.reducedMotion);if(d){const g=d.grid,shift=(t*g.speed)%g.spacing;el.style.transform='none';if(!c.reducedMotion&&g.movement!=='static')el.style.backgroundPosition=(g.movement==='vertical'?0:shift)+'px '+(g.movement==='horizontal'?0:shift)+'px';return;}const drift=c.backgroundDesign?.drift;el.style.transform=c.reducedMotion||drift===0?'none':'translate('+((t*(drift??3))%90)+'px,'+((t*(drift??2))%90)+'px)';}};
}
