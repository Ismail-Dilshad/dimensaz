import type {Config} from '../engine/schema.js';
export function referenceBackground(c:Config){
 const s=c.referenceStyle!;
 const el=document.createElement('div');el.dataset.referenceBackground=s.id;
 el.style.cssText='position:absolute;inset:0;overflow:hidden;background:'+s.background;
 const haze=document.createElement('div');
 haze.style.cssText='position:absolute;inset:0;background:radial-gradient(ellipse at 0% 0%,'+s.corner+'99,transparent 42%),radial-gradient(ellipse at 100% 100%,'+(s.texture==='glass'?'#FFE8EE':s.corner)+'88,transparent 42%)';
 const grid=document.createElement('div');grid.dataset.referenceGrid=s.grid.geometry;
 const g=s.grid;
 const stroke=g.width??1;
 grid.style.cssText='position:absolute;inset:-120px;opacity:'+g.opacity+';background-size:'+g.spacing+'px '+g.spacing+'px;background-image:'+(g.geometry==='dotted'?'radial-gradient(circle,'+g.color+' '+(g.width??1.2)+'px,transparent '+((g.width??1.2)+.3)+'px)':'linear-gradient('+g.color+' '+stroke+'px,transparent '+stroke+'px),linear-gradient(90deg,'+g.color+' '+stroke+'px,transparent '+stroke+'px)');
 el.append(haze,grid);
 if(s.texture==='paper'){
  const texture=document.createElement('div');
  texture.style.cssText='position:absolute;inset:0;opacity:.18;background-size:7px 11px;background-image:radial-gradient('+s.shadow+' 0.6px,transparent 0.8px)';
  el.append(texture);
 }
 const lines=Array.from({length:s.lines.count},(_,i)=>{
  const line=document.createElement('div');line.dataset.referenceLine=String(i);
  line.style.cssText='position:absolute;width:220%;height:'+(s.lines.width??2)+'px;left:-60%;top:'+(25+i*28)+'%;background:'+s.lines.color+';opacity:'+s.lines.opacity;
  el.append(line);return line;
 });
 const corner=document.createElement('div');
 corner.style.cssText='position:absolute;right:-12%;bottom:-8%;width:40%;height:30%;border-radius:58% 42% 63% 37%;background:'+s.corner+';opacity:.4';
 el.append(corner);
 if(s.card==='Green Beacon'){
  const beam='#26d57935';
  haze.style.background='radial-gradient(ellipse at 18% 4%,'+beam+',transparent 42%),radial-gradient(ellipse at 65% 75%,'+s.shadow+'55,transparent 35%)';
  corner.style.opacity='.12';
 }else if(s.card==='Tangerine Counter'){
  const fold=document.createElement('div');
  fold.style.cssText='position:absolute;bottom:0;left:0;width:18%;aspect-ratio:1;clip-path:polygon(0 0,100% 100%,0 100%);background:linear-gradient(45deg,'+s.shadow+','+s.background+')';
  el.append(fold);
 }
 return {element:el,render:(t:number)=>{
  const still=c.reducedMotion||!!s.card;
  grid.style.backgroundPosition=still?'0px 0px':((t*1.3)%g.spacing)+'px '+((t*.8)%g.spacing)+'px';
  lines.forEach((line,i)=>{const shift=still?0:Math.sin(t*.13+i*1.9)*16;line.style.transform='translateY('+shift+'px) rotate('+s.lines.angle+'deg)';});
 }};
}

