// Shapes the text of 3D layers with HarfBuzz (correct joining and right-to-left order for Kurdish,
// Arabic and Persian; kerning for Latin) and hands the browser the glyph outlines, which the 3D
// engine extrudes into solid letters (components/pieces/three/engine.ts). Runs when a video is
// rendered, on a copy of the scenes; the project itself is not changed.
import fs from 'node:fs/promises';
import path from 'node:path';
import * as hb from 'harfbuzzjs';
import {ROOT,LATIN_FALLBACK} from '../engine/config.js';
import type {Piece} from '../engine/scene-pieces-schema.js';

type Prepared={upem:number;width:number;ascent:number;descent:number;glyphs:{d:string;x:number;y:number}[]};
const fonts=new Map<string,Promise<{font:hb.Font;upem:number}>>();
function load(file:string){
 let f=fonts.get(file);
 if(!f){f=(async()=>{const bytes=await fs.readFile(path.resolve(ROOT,file));const face=new hb.Face(new hb.Blob(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)));const font=new hb.Font(face);
  // Solid 3D letters read best heavy: use a bold instance of a variable font when it has one.
  try{const v=hb.Variation.fromString('wght=800');if(v)font.setVariations([v]);}catch{/* not a variable font */}
  return {font,upem:face.upem};})();fonts.set(file,f);}
 return f;
}
const arabic=/\p{Script=Arabic}/u;
// Used when the chosen font has no outline for a letter (it would extrude as empty boxes).
const ARABIC_FALLBACK='assets/fonts/open/NotoSansArabic-Variable.ttf';
/** One run of glyphs in visual (left-to-right) order, with its advance. */
async function shapeRun(text:string,font:hb.Font,dir:'ltr'|'rtl'){
 const b=new hb.Buffer();b.addText(text);b.guessSegmentProperties();b.setDirection(dir==='rtl'?hb.Direction.RTL:hb.Direction.LTR);hb.shape(font,b);
 const infos=b.getGlyphInfos(),pos=b.getGlyphPositions();let x=0;const glyphs:Prepared['glyphs']=[];
 infos.forEach((g,i)=>{const p=pos[i]!;glyphs.push({d:font.glyphToPath(g.codepoint),x:x+p.xOffset,y:p.yOffset});x+=p.xAdvance;});
 return {glyphs,width:x,missing:infos.some(g=>g.codepoint===0)};
}
export async function shapeText(text:string,file:string):Promise<Prepared>{
 const {font,upem}=await load(file);
 // A small bidi pass: in right-to-left text, figures still read left to right ("٤٠" stays 40), so
 // number runs (with a percent sign after them, as the headline shows it: ٤٠٪) are shaped left
 // to right and the runs are laid out from the right.
 const rtl=arabic.test(text);
 const runs=rtl?text.match(/[\p{N}][\p{N}.,٫٬]*[%٪]?|[^\p{N}]+/gu)??[text]:[text];
 const shaped=await Promise.all(runs.map(t=>shapeRun(t,font,rtl&&!/^\p{N}/u.test(t)?'rtl':'ltr')));
 if(shaped.some(r=>r.missing)){
  const alt=arabic.test(text)?ARABIC_FALLBACK:LATIN_FALLBACK;
  if(path.resolve(ROOT,alt)!==path.resolve(ROOT,file))return shapeText(text,alt);
 }
 let x=0;const glyphs:Prepared['glyphs']=[];
 for(const r of rtl?[...shaped].reverse():shaped){for(const g of r.glyphs)glyphs.push({...g,x:g.x+x});x+=r.width;}
 return {upem,width:x,ascent:upem*.8,descent:upem*.2,glyphs:glyphs.filter(g=>g.d).slice(0,64)};
}
/** Copies of the pieces with every 3D text layer's glyphs shaped (Latin in the style's font, other scripts in the video's). */
export async function prepare3d<T extends Piece|undefined>(pieces:T[],o:{latin?:string|null;script:string}):Promise<T[]>{
 return Promise.all(pieces.map(async p=>{
  if(!p||!p.layers.some(l=>l.type==='scene3d'&&l.model?.kind==='text'&&l.model.text&&!l.model.prepared))return p;
  const layers=await Promise.all(p.layers.map(async l=>{
   if(l.type!=='scene3d'||l.model?.kind!=='text'||!l.model.text||l.model.prepared)return l;
   const file=arabic.test(l.model.text)?o.script:(o.latin??LATIN_FALLBACK);
   try{return {...l,model:{...l.model,prepared:await shapeText(l.model.text,file)}};}catch{return l;}
  }));
  return {...p,layers} as T;
 }));
}
