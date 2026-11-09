// Scene piece: a phone or browser mockup (or a bare content piece), an optional cursor that
// moves and clicks, placed in the frame next to the sentence, with a designed transition.
import type {Piece,PieceTheme} from '../../engine/scene-pieces-schema.js';
import {h,s,seg,ease,enter,alpha,on,R,surf,useSkin,readableOn,contrast,type Built,type Ctx} from './kit.js';
import {skinFor} from './skins.js';
import {buildContent} from './content.js';
import {pieceTiming} from './timing.js';
export {pieceThemeFor} from './theme.js';

function phone(p:Extract<Piece,{kind:'phone'}>,c:Ctx):Built{
 const t=c.theme,H=c.box.h,W=Math.min(c.box.w,H*.49),bezel=W*.035;
 const el=h('div',`position:relative;width:${W}px;height:${H}px;border-radius:${W*.14}px;background:#0f1115;padding:${bezel}px;box-sizing:border-box;box-shadow:0 30px 80px ${alpha('#000000',.32)},inset 0 0 0 ${W*.008}px #3a3d45`);
 const screen=h('div',`position:relative;width:100%;height:100%;border-radius:${W*.11}px;overflow:hidden;background:${t.background};display:flex;flex-direction:column`);
 const island=h('div',`position:absolute;top:${W*.03}px;left:50%;width:${W*.3}px;height:${W*.085}px;margin-left:-${W*.15}px;border-radius:99px;background:#0f1115;z-index:3`);
 const scr=contrast(t.text,t.background)>=4.5?t.text:on(t.background); // text on the screen itself, not on a card
 const bar=h('div',`height:${W*.16}px;flex:none;display:flex;align-items:flex-end;justify-content:space-between;padding:0 ${W*.07}px ${W*.02}px;font-size:${W*.048}px;font-weight:700;color:${scr}`);
 bar.append(h('span','','9:41'),h('span','','●●● ▮'));
 const app=p.app?h('div',`flex:none;padding:${W*.02}px ${W*.06}px ${W*.03}px;font-size:${W*.07}px;font-weight:800;color:${scr};letter-spacing:-.02em`,p.app):null;
 const body=h('div',`flex:1;min-height:0;padding:${W*.04}px ${W*.05}px ${W*.06}px;box-sizing:border-box;display:flex`);
 const inner=buildContent(p.screen,{...c,box:{w:W-2*bezel-W*.1,h:H-2*bezel-W*.16-(app?W*.12:0)-W*.1},unit:W/58});
 inner.el.style.flex='1';body.append(inner.el);
 screen.append(island,bar);if(app)screen.append(app);screen.append(body);el.append(screen);
 for(const [side,top,len] of [['left',.2,.08],['left',.31,.12],['right',.26,.14]] as const)el.append(h('div',`position:absolute;${side}:-${W*.012}px;top:${H*top}px;width:${W*.014}px;height:${H*len}px;border-radius:4px;background:#2a2d33`));
 return {el,length:.5+inner.length,render:(x)=>{
  const q=seg(x,0,.7),e=ease.back(q);
  el.style.opacity=String(ease.cubic(q));
  el.style.transform=`translateY(${(1-e)*H*.25}px) rotate(${p.tilt+(1-ease.cubic(q))*6}deg) scale(${.9+.1*e})`;
  inner.render(x-.45);
 }};
}

function browser(p:Extract<Piece,{kind:'browser'}>,c:Ctx):Built{
 const t=c.theme,W=c.box.w,H=c.box.h,u=Math.min(W,H)/100,barH=Math.max(28,u*9);
 const el=h('div',`width:${W}px;height:${H}px;border-radius:${R(Math.max(10,t.radius*.8))}px;overflow:hidden;${surf(t,2)};background:${t.background};display:flex;flex-direction:column;box-sizing:border-box`);
 const chrome=h('div',`height:${barH}px;flex:none;display:flex;align-items:center;gap:${u*1.6}px;padding:0 ${u*3}px;background:${t.surface};border-bottom:1px solid ${alpha(t.text,.08)}`);
 for(const col of ['#FF5F57','#FEBC2E','#28C840'])chrome.append(h('div',`width:${u*2.4}px;height:${u*2.4}px;border-radius:50%;background:${col}`));
 // The address is Latin text, so it reads left to right even in a right-to-left browser.
 const url=h('div',`flex:1;margin-inline-start:${u*3}px;height:${barH*.56}px;border-radius:${R(99)}px;background:${alpha(t.text,.06)};display:flex;align-items:center;justify-content:${c.dir==='rtl'?'flex-end':'flex-start'};direction:ltr;padding:0 ${u*3}px;font-size:${barH*.3}px;color:${t.muted};overflow:hidden;white-space:nowrap`);
 chrome.append(url);
 const body=h('div',`flex:1;min-height:0;padding:${u*5}px;box-sizing:border-box;display:flex`);
 const inner=buildContent(p.screen,{...c,box:{w:W-u*10,h:H-barH-u*10}});inner.el.style.flex='1';body.append(inner.el);
 el.append(chrome,body);
 const full=p.url??'';
 return {el,length:.6+inner.length,render:(x)=>{
  enter(el,seg(x,0,.6),{y:H*.12,scale:.94});
  url.textContent=full.slice(0,Math.round(full.length*ease.smooth(seg(x,.25,.6))));
  inner.render(x-.5);
 }};
}

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
 *  frame's colour, which a style can make very different from its card colour. */
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
 // The piece's design style (its own, or the video's): palette, surfaces, type, motion, backdrop.
 // A piece asked for a named style keeps it; otherwise the video's own bred style.
 const sk=p.style?skinFor(p.style):skinFor(ctx.theme.style,ctx.theme.genome);useSkin(sk);
 // Text colours are checked against the surfaces they sit on, whatever the style bred.
 const pal=sk.palette(ctx.theme);const theme={...pal,text:readableOn(pal.text,pal.surface,7),muted:readableOn(pal.muted,pal.surface,5.4)}; // margin for gradient and glass surfaces
 const c:Ctx={...ctx,theme,dir:p.direction==='auto'?ctx.dir:p.direction};
 const wrap=h('div',`position:relative;width:${c.box.w}px;height:${c.box.h}px;display:flex;align-items:center;justify-content:center;direction:${c.dir}`);
 wrap.dir=c.dir;wrap.dataset.style=sk.id;
 const framed=!!(globalThis as {PROJECT?:{config?:{frame?:unknown}}}).PROJECT?.config?.frame;
 if(sk.backdrop){const b=sk.backdrop(c.theme,c.box.w,c.box.h,framed);if(b){b.style.zIndex='0';wrap.append(b);}}
 const built=p.kind==='phone'?phone(p,c):p.kind==='browser'?browser(p,c):buildContent(p,c);
 if(p.kind!=='phone'&&p.kind!=='browser'){built.el.style.width='100%';built.el.style.height='100%';}
 groundText(built.el,c.theme);
 built.el.style.position=built.el.style.position||'relative';built.el.style.zIndex='1';
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
