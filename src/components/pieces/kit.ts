// Shared drawing helpers for animated scene pieces. Every value is a pure function of time,
// so any frame renders the same way twice.
import {clamp,easing} from '../../animations/easing.js';
import type {PieceTheme} from '../../engine/scene-pieces-schema.js';

export type Box={w:number;h:number};
export type Built={el:HTMLElement;render:(t:number)=>void;/** seconds the piece needs to finish its main animation */length:number};
export type Ctx={theme:PieceTheme;box:Box;font:string;dir:'ltr'|'rtl';assets:Record<string,string>;/** size unit in px (1/100 of the piece); set by device frames */unit?:number};

export const SVG='http://www.w3.org/2000/svg';
export function h(tag:string,css='',text?:string){const e=document.createElement(tag);if(css)e.style.cssText=css;if(text!==undefined)e.textContent=text;return e;}
export function s<K extends keyof SVGElementTagNameMap>(tag:K,attrs:Record<string,string|number>={}){const e=document.createElementNS(SVG,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e;}
/** 0..1 progress of a segment that starts at `start` and lasts `dur` seconds. */
export const seg=(t:number,start:number,dur:number)=>clamp((t-start)/Math.max(.001,dur));
export const ease=easing;
/** The design style every piece draws with: surfaces, corners, shadows, type, marks and motion.
 *  Set by buildPiece before building and before each frame (see skins.ts). */
export type SkinLike={id:string;
 surface:(t:PieceTheme,level:number)=>string;
 radius:(px:number)=>number;
 shadow:(t:PieceTheme,level:number)=>string;
 avatar:'circle'|'square'|'squircle';
 /** box-shadow value around avatars */
 avatarRing:(size:number)=>string;
 motion:{curve:'back'|'cubic'|'elastic'|'smooth'|'snap';distance:number;scale:number;rotate:number};
 type:{display?:boolean;numbers?:boolean;titleWeight:number;case:'none'|'upper';tracking:number};
 tick:'round'|'square';
};
const DEFAULT:SkinLike={id:'soft',surface:(t,l)=>`background:${t.surface};border:1px solid ${alpha(t.text,.07)};box-shadow:0 2px 0 ${alpha(t.text,.04)},0 ${8+l*10}px ${24+l*24}px ${alpha(t.text,.08+l*.06)}`,
 radius:px=>px,shadow:(t,l)=>`box-shadow:0 ${4+l*8}px ${12+l*20}px ${alpha(t.text,.08+l*.05)}`,avatar:'circle',avatarRing:size=>`0 0 0 ${Math.max(2,size*.06)}px #fff,0 6px 16px ${alpha('#000000',.18)}`,motion:{curve:'back',distance:1,scale:.94,rotate:0},
 type:{titleWeight:700,case:'none',tracking:0},tick:'round'};
let active:SkinLike=DEFAULT;
export function useSkin(skin:SkinLike|undefined){active=skin??DEFAULT;}
export const skin=()=>active;
/** Corner radius in the current style (square styles return 0, soft ones round more). */
export const R=(px:number)=>Math.max(0,active.radius(px));
/** A drop shadow in the current style ("box-shadow:..." or a style that has none). */
export const shadow=(t:PieceTheme,level=1)=>active.shadow(t,level);
/** A surface (background, border, shadow) in the current style; level 0 flat, 1 card, 2 raised. */
export const surf=(t:PieceTheme,level=1)=>active.surface(t,level);
/** Font for titles and big numbers when the style has its own (falls back to the video font). */
export const displayFont=()=>active.type.display?`font-family:PieceDisplay-${active.id},VideoPrimary,VideoFallback0,sans-serif;`:'';
export const numberFont=()=>active.type.numbers?`font-family:PieceNumbers-${active.id},VideoPrimary,VideoFallback0,sans-serif;`:'';
export const titleCase=()=>`${active.type.case==='upper'?'text-transform:uppercase;':''}letter-spacing:${active.type.tracking}em;`;
const snap=(t:number)=>1-Math.pow(1-clamp(t),5);
/** Entrance driven by progress p (0..1), in the style's motion character. */
export function enter(el:HTMLElement|SVGElement,p:number,{y=28,x=0,scale=.94,curve}:{y?:number;x?:number;scale?:number;curve?:(t:number)=>number}={}){
 const m=active.motion,c=curve??(m.curve==='snap'?snap:ease[m.curve]),e=c(p),o=ease.cubic(m.curve==='snap'?Math.min(1,p*1.6):p);
 // The style scales the entrance: soft styles pop from further away, crisp ones barely scale.
 const sc=Math.min(1,Math.max(.2,1-(1-scale)*(1-m.scale)/(1-.94)));
 el.style.opacity=String(o);
 el.style.transform=`translate(${(1-e)*x*m.distance}px,${(1-e)*y*m.distance}px) scale(${sc+(1-sc)*e})${m.rotate?` rotate(${(1-e)*m.rotate}deg)`:''}`;
}
export const mix=(a:string,b:string,t:number)=>{const pa=hex(a),pb=hex(b);return '#'+pa.map((v,i)=>Math.round(v+(pb[i]!-v)*t).toString(16).padStart(2,'0')).join('');};
const hex=(c:string)=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));
export const alpha=(c:string,a:number)=>c+Math.round(clamp(a)*255).toString(16).padStart(2,'0');
/** Readable text colour on a fill. */
const lin=(v:number)=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;};
export const luminance=(c:string)=>{const [r,g,b]=hex(c);return .2126*lin(r!)+.7152*lin(g!)+.0722*lin(b!);};
export const contrast=(a:string,b:string)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
/** Readable text colour on a fill: dark or white, whichever has more contrast. */
export const on=(fill:string)=>contrast('#111827',fill)>=contrast('#ffffff',fill)?'#111827':'#ffffff';
/** Moves a colour toward black or white until it reads on the background. */
export function readableOn(color:string,bg:string,min:number){
 const toward=luminance(bg)>.35?'#000000':'#ffffff';let c=color;
 for(let k=1;k<=10&&contrast(c,bg)<min;k++)c=mix(color,toward,k/10);
 return c;
}
/** A brand colour used as text, made readable on the piece's surface. */
export const ink=(c:string,t:PieceTheme)=>readableOn(c,t.surface,4.5);
/** Up and down trend colours that read on a surface. */
export const trendColor=(up:boolean,surface:string)=>readableOn(luminance(surface)<.3?(up?'#4ADE80':'#F87171'):(up?'#15803D':'#B91C1C'),surface,5.5);
export const card=(t:PieceTheme,extra='')=>`${active.surface(t,1)};border-radius:${R(t.radius)}px;box-sizing:border-box;${extra}`;
export const initials=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(w=>[...w][0]!.toUpperCase()).join('');
const AVATAR=['#6366F1','#F59E0B','#10B981','#EC4899','#3B82F6','#EF4444'];
export const avatarColor=(i:number,c?:string)=>c??AVATAR[i%AVATAR.length]!;
export function avatar(name:string,size:number,color:string){
 const r=active.avatar==='circle'?'50%':active.avatar==='square'?R(size*.12)+'px':size*.32+'px';
 const a=h('div',`width:${size}px;height:${size}px;border-radius:${r};background:${color};color:${on(color)};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${size*.4}px;flex:none;box-shadow:${active.avatarRing(size)};`,initials(name));
 return a;
}
export function formatNumber(v:number,decimals:number,digits?:'latin'|'arabic'|'persian'){
 const t=v.toLocaleString('en-US',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
 return digits&&digits!=='latin'?inScript(t,digits):t;}
/** Writes Latin digits and number signs in Arabic-Indic or Persian digits (٤٠٪, ١٬٢٠٠, ٢٫٥). */
export function inScript(t:string,digits:'arabic'|'persian'){const zero=digits==='arabic'?0x660:0x6f0;
 return t.replace(/[0-9]/g,d=>String.fromCharCode(zero+Number(d))).replace(/,/g,'٬').replace(/\./g,'٫').replace(/%/g,'٪');}
/** Check mark drawn with a stroke; p 0..1. */
export function tick(size:number,color:string){
 const svg=s('svg',{width:size,height:size,viewBox:'0 0 24 24'});
 const sq=active.tick==='square';
 const path=s('path',{d:'M5 12.5l4.2 4.2L19 7',fill:'none',stroke:color,'stroke-width':sq?3.6:3,'stroke-linecap':sq?'square':'round','stroke-linejoin':sq?'miter':'round','stroke-dasharray':24,'stroke-dashoffset':24});
 svg.append(path);
 return {el:svg,render:(p:number)=>path.setAttribute('stroke-dashoffset',String(24*(1-ease.cubic(p))))};
}
