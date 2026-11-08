// The whole frame in the video's bred style: background colour and pattern, headline colour,
// highlight colour, headline font, weight, capitals and tracking, and the headline's motion.
// Computed once when the job is planned (from the genome and the brand) and stored in the
// project, so the background, the sentence and the pieces always belong to one design.
import type {PieceTheme} from '../../engine/scene-pieces-schema.js';
import type {Genome} from './genome.js';
import {skinFromGenome} from './skins.js';

export type Frame={genome:string;background:string;text:string;highlight:string;muted:string;dark:boolean;
 pattern:{kind:Genome['backdrop']['kind'];amount:number;color:string;accent:string};
 /** Headline font (Latin-script lines only; other scripts keep the language's font). */
 font:string|null;weight:number;upper:boolean;tracking:number;
 easing:'smooth'|'cubic'|'back'|'elastic';intensity:number};

const rgb=(c:string)=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255);
const lin=(v:number)=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4;
export const luminance=(c:string)=>{const [r,g,b]=rgb(c).map(lin) as [number,number,number];return .2126*r+.7152*g+.0722*b;};
export const contrast=(a:string,b:string)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const mixHex=(a:string,b:string,t:number)=>{const A=rgb(a),B=rgb(b);return '#'+A.map((v,i)=>Math.round((v+(B[i]!-v)*t)*255).toString(16).padStart(2,'0')).join('');};
/** Moves a colour toward black or white until it reads on the background. */
const hsl=(c:string)=>{const [r,g,b]=rgb(c) as [number,number,number];const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn,l=(mx+mn)/2;
 let h=0;if(d)h=(mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4)*60;return {h:(h+360)%360,s:d?d/(1-Math.abs(2*l-1)):0};};
const hueOf=(c:string)=>hsl(c).h,satOf=(c:string)=>hsl(c).s;
export function readableOn(color:string,bg:string,min:number){
 const toward=luminance(bg)>.4?'#000000':'#ffffff';let c=color;
 for(let k=1;k<=10&&contrast(c,bg)<min;k++)c=mixHex(color,toward,k/10);
 return c;
}

export function frameFor(g:Genome,brand:PieceTheme):Frame{
 const sk=skinFromGenome(g),t=sk.palette(brand);
 // Brand-colour styles put colour on the cards; the frame stays a quiet tint of it.
 const background=g.tone==='brand'?t.background:t.background;
 const text=readableOn(g.tone==='brand'?'#111827':t.text,background,7);
 // The highlight must read on the background and stand apart from the headline colour.
 const candidates=[g.tone==='brand'?mixHex(t.surface,'#000000',.15):t.primary,t.accent,brand.primary,brand.accent].map(c=>readableOn(c,background,3.2));
 const highlight=candidates.find(c=>contrast(c,text)>=1.8||Math.abs(hueOf(c)-hueOf(text))>40&&satOf(c)>.35)??candidates[1]!;
 const curve=g.motion.curve==='snap'?'cubic':g.motion.curve;
 return {genome:g.id,background,text,highlight,muted:readableOn(t.muted,background,3),dark:luminance(background)<.18,
  pattern:{kind:g.backdrop.kind,amount:g.backdrop.amount,color:t.primary,accent:t.accent},
  font:g.type.display==='video'?null:sk.fonts.display??null,weight:Math.max(500,Math.min(900,g.type.weight+(g.type.display==='serif'?0:100))),
  upper:g.type.upper,tracking:g.type.tracking,easing:curve,intensity:Math.min(.9,Math.max(.2,g.motion.distance/1.8))};
}
