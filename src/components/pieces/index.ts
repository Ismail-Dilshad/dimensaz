// Scene piece: a visual composed from layers for this video (compose.ts), an optional cursor
// that moves and clicks, placed in the frame next to the sentence, with a designed transition.
import type {Piece,PieceTheme} from '../../engine/scene-pieces-schema.js';
import {h,s,seg,ease,on,useSkin,readableOn,contrast,type Ctx} from './kit.js';
import {skinFor} from './skins.js';
import {composePiece} from './compose.js';
import {pieceTiming} from './timing.js';
export {pieceThemeFor} from './theme.js';

function cursor(p:NonNullable<Piece['cursor']>,c:Ctx){
 const size=Math.max(26,Math.min(c.box.w,c.box.h)*.075);
 const el=h('div',`position:absolute;left:0;top:0;width:${size}px;height:${size}px;z-index:20;pointer-events:none;opacity:0`);
 const svg=s('svg',{width:size,height:size,viewBox:'0 0 24 24'});
 svg.append(p.style==='hand'
  ?s('path',{d:'M9 11V4.5a1.5 1.5 0 013 0V10m0-.5V3.5a1.5 1.5 0 013 0V10m0-1a1.5 1.5 0 013 0v5.5a6.5 6.5 0 01-6.5 6.5h-1a6 6 0 01-4.6-2.2L4.4 15a1.6 1.6 0 012.4-2.1L9 15',fill:'#fff',stroke:'#111','stroke-width':1.4,'stroke-linejoin':'round'})
  :s('path',{d:'M4 2.5l15 9-6.6 1.4L16 20l-2.6 1.3-3.6-7.2L5 18.5z',fill:'#111',stroke:'#fff','stroke-width':1.5,'stroke-linejoin':'round'}));
 const ripple=h('div',`position:absolute;left:0;top:0;width:${size*2.2}px;height:${size*2.2}px;margin:-${size*1.1}px;border-radius:50%;border:${size*.1}px solid ${c.theme.accent};opacity:0;z-index:19;pointer-events:none;box-sizing:border-box`);
 el.append(svg);
 // Right-to-left layouts mirror the path, so the cursor still lands on the same element.
 const path=[...p.path].sort((a,b)=>a.at-b.at).map(q=>c.dir==='rtl'?{...q,x:1-q.x}:q),start={x:.5,y:1.15,at:Math.max(0,path[0]!.at-.6),click:false};
 const pts=[start,...path];
 return {els:[ripple,el],render:(x:number)=>{
  if(x<start.at){el.style.opacity='0';ripple.style.opacity='0';return;}
  let i=pts.findIndex(q=>q.at>x);if(i<0)i=pts.length;const a=pts[Math.max(0,i-1)]!,b=pts[Math.min(i,pts.length-1)]!;
  const k=a===b?1:ease.smooth(seg(x,a.at,b.at-a.at));
  const px=(a.x+(b.x-a.x)*k)*c.box.w,py=(a.y+(b.y-a.y)*k)*c.box.h;
  el.style.opacity=String(ease.cubic(seg(x,start.at,.3)));
  const lastClick=path.filter(q=>q.click&&q.at<=x).pop();
  const press=lastClick?seg(x,lastClick.at,.25):1;
  el.style.transform=`translate(${px-size*.18}px,${py-size*.1}px) scale(${1-Math.sin(press*Math.PI)*.18})`;
  if(lastClick){const r=seg(x,lastClick.at,.6);ripple.style.opacity=String((1-r)*.9);ripple.style.transform=`translate(${lastClick.x*c.box.w}px,${lastClick.y*c.box.h}px) scale(${.3+r*.9})`;}
  else ripple.style.opacity='0';
 }};
}

/** Text drawn straight on the frame (no card, bubble or shape behind it) is made readable on the
 *  frame's colour, which a style can make very different from its card colour. (Composed layers
 *  check the colour under each text themselves.) */
function groundText(root:HTMLElement,t:PieceTheme){
 const hex=(c:string)=>{const m=c.match(/\d+(\.\d+)?/g);return m&&m.length>=3?'#'+m.slice(0,3).map(v=>Math.round(Number(v)).toString(16).padStart(2,'0')).join(''):c.startsWith('#')?c.slice(0,7):null;};
 const filled=(e:HTMLElement)=>!!(e.style.background||e.style.backgroundColor||e.style.backgroundImage);
 for(const e of [root,...root.querySelectorAll<HTMLElement>('*')]){
  // Text now, or filled in while it animates (numbers counting): any element styled as text.
  const holdsText=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent!.trim())||!e.children.length&&!!e.style.fontSize&&!!e.style.color;
  if(!(e instanceof HTMLElement)||e.closest('[data-compose]')||!holdsText)continue;
  let bare=true;for(let x:HTMLElement|null=e;x;x=x===root?null:x.parentElement){if(filled(x)){bare=false;break;}}
  if(!bare)continue;
  const col=hex(e.style.color||t.text);if(!col)continue;
  const big=parseFloat(e.style.fontSize)>=40;const fixed=readableOn(col,t.background,big?3.4:5.2); // margin for the frame's pattern
  if(fixed!==col)e.style.color=contrast(on(t.background),t.background)>contrast(fixed,t.background)&&contrast(fixed,t.background)<(big?3.4:5.2)?on(t.background):fixed;
 }
}
/** Builds a piece inside a box of the given size. render() takes seconds since the scene started. */
export function buildPiece(p:Piece,ctx:Ctx){
 // The video's own generated style: palette, surfaces, type, motion, backdrop.
 const sk=skinFor(ctx.theme.genome);useSkin(sk);
 // Text colours are checked against the surfaces they sit on, whatever the style generated.
 const pal=sk.palette(ctx.theme);const theme={...pal,text:readableOn(pal.text,pal.surface,7),muted:readableOn(pal.muted,pal.surface,5.4)}; // margin for gradient and glass surfaces
 const c:Ctx={...ctx,theme,dir:p.direction==='auto'?ctx.dir:p.direction};
 const wrap=h('div',`position:relative;width:${c.box.w}px;height:${c.box.h}px;display:flex;align-items:center;justify-content:center;direction:${c.dir}`);
 wrap.dir=c.dir;wrap.dataset.style=sk.id;
 const framed=!!(globalThis as {PROJECT?:{config?:{frame?:unknown}}}).PROJECT?.config?.frame;
 if(sk.backdrop){const b=sk.backdrop(c.theme,c.box.w,c.box.h,framed);if(b){b.style.zIndex='0';wrap.append(b);}}
 const built=composePiece(p,c);built.el.style.width='100%';built.el.style.height='100%';
 groundText(built.el,c.theme);
 built.el.style.position=built.el.style.position||'relative';built.el.style.zIndex='1';built.el.dataset.layers='1'; // the visual itself, without the style's backdrop (the art director measures it)
 wrap.append(built.el);
 const cur=p.cursor?cursor(p.cursor,c):null;if(cur)wrap.append(...cur.els);
 // One source of truth for timing: the same length drives the sound cues (timing.ts).
 wrap.dataset.length=pieceTiming(p).length.toFixed(3);wrap.dataset.domLength=(p.delay+built.length).toFixed(3);
 return {el:wrap,length:pieceTiming(p).length,render:(local:number)=>{useSkin(sk);const x=local-p.delay;built.render(x);cur?.render(local);}};
}

/** Scene transition in, by progress 0..1 (and out, near the end). */
export function transitionStyle(kind:Piece['transition'],p:number,dir:'ltr'|'rtl',w:number){
 const e=ease.cubic(p),r=dir==='rtl'?-1:1;
 switch(kind){
  case 'none':return {opacity:'1',transform:'none',clipPath:'none',filter:'none'};
  case 'fade':return {opacity:String(e),transform:'none',clipPath:'none',filter:'none'};
  case 'wipe':return {opacity:'1',transform:'none',clipPath:r>0?`inset(0 ${(1-e)*100}% 0 0)`:`inset(0 0 0 ${(1-e)*100}%)`,filter:'none'};
  case 'push':return {opacity:String(Math.min(1,e*1.6)),transform:`translateX(${(1-e)*w*.4*r}px)`,clipPath:'none',filter:'none'};
  case 'zoom-through':return {opacity:String(Math.min(1,e*1.4)),transform:`scale(${1.35-.35*e})`,clipPath:'none',filter:`blur(${(1-e)*14}px)`};
  case 'mask-reveal':return {opacity:'1',transform:`translateY(${(1-e)*40}px)`,clipPath:`inset(${(1-e)*100}% 0 0 0 round 24px)`,filter:'none'};
  case 'circle-reveal':return {opacity:'1',transform:'none',clipPath:`circle(${e*150}% at 50% 60%)`,filter:'none'};
 }
}
export type {PieceTheme};
export {on};
