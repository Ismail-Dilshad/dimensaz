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
 const d=c.director?.resolved;
 if(d){el.style.backgroundColor=d.palette.background;if(c.background.endsWith('grid')){const g=d.grid,line=g.color+Math.round(g.opacity*255).toString(16).padStart(2,'0');el.style.backgroundImage=g.geometry==='dotted'?'radial-gradient(circle,'+line+' '+g.width+'px,transparent '+(g.width+.5)+'px)':'linear-gradient('+line+' '+g.width+'px,transparent '+g.width+'px),linear-gradient(90deg,'+line+' '+g.width+'px,transparent '+g.width+'px)';el.style.backgroundSize=g.spacing+'px '+g.spacing+'px';}}
 return {element:el,render:(t:number)=>{if(c.background==='flow-gradient')el.style.backgroundImage=gradientFlow(t,c.primary,c.reducedMotion);if(d){const g=d.grid,shift=(t*g.speed)%g.spacing;el.style.transform='none';if(!c.reducedMotion&&g.movement!=='static')el.style.backgroundPosition=(g.movement==='vertical'?0:shift)+'px '+(g.movement==='horizontal'?0:shift)+'px';return;}const drift=c.backgroundDesign?.drift;el.style.transform=c.reducedMotion||drift===0?'none':'translate('+((t*(drift??3))%90)+'px,'+((t*(drift??2))%90)+'px)';}};
}
