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
/** Rise-and-fade entrance driven by progress p (0..1). */
export function enter(el:HTMLElement|SVGElement,p:number,{y=28,x=0,scale=.94,curve=ease.back}:{y?:number;x?:number;scale?:number;curve?:(t:number)=>number}={}){
 const e=curve(p),o=ease.cubic(p);
 el.style.opacity=String(o);
 el.style.transform=`translate(${(1-e)*x}px,${(1-e)*y}px) scale(${scale+(1-scale)*e})`;
}
export const mix=(a:string,b:string,t:number)=>{const pa=hex(a),pb=hex(b);return '#'+pa.map((v,i)=>Math.round(v+(pb[i]!-v)*t).toString(16).padStart(2,'0')).join('');};
const hex=(c:string)=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));
export const alpha=(c:string,a:number)=>c+Math.round(clamp(a)*255).toString(16).padStart(2,'0');
/** Readable text colour on a fill. */
export const on=(fill:string)=>{const [r,g,b]=hex(fill);return (r!*299+g!*587+b!*114)/1000>150?'#111827':'#ffffff';};
export const card=(t:PieceTheme,extra='')=>`background:${t.surface};border-radius:${t.radius}px;box-shadow:0 2px 0 ${alpha(t.text,.04)},0 18px 48px ${alpha(t.text,.14)};border:1px solid ${alpha(t.text,.07)};box-sizing:border-box;${extra}`;
export const initials=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(w=>[...w][0]!.toUpperCase()).join('');
const AVATAR=['#6366F1','#F59E0B','#10B981','#EC4899','#3B82F6','#EF4444'];
export const avatarColor=(i:number,c?:string)=>c??AVATAR[i%AVATAR.length]!;
export function avatar(name:string,size:number,color:string){
 const a=h('div',`width:${size}px;height:${size}px;border-radius:50%;background:${color};color:${on(color)};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${size*.4}px;flex:none;box-shadow:0 0 0 ${Math.max(2,size*.06)}px #fff,0 6px 16px ${alpha('#000000',.18)};`,initials(name));
 return a;
}
export function formatNumber(v:number,decimals:number){return v.toLocaleString('en-US',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});}
/** Check mark drawn with a stroke; p 0..1. */
export function tick(size:number,color:string){
 const svg=s('svg',{width:size,height:size,viewBox:'0 0 24 24'});
 const path=s('path',{d:'M5 12.5l4.2 4.2L19 7',fill:'none',stroke:color,'stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round','stroke-dasharray':24,'stroke-dashoffset':24});
 svg.append(path);
 return {el:svg,render:(p:number)=>path.setAttribute('stroke-dashoffset',String(24*(1-ease.cubic(p))))};
}
