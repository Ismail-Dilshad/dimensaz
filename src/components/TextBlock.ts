import {fitText} from '../engine/text-fit.js';
import {words} from '../engine/rtl-layout.js';
import type {Config,Scene} from '../engine/schema.js';
import {htmlLanguage} from '../engine/languages.js';
export type WordBox={start:number;end:number;rect:DOMRect};
export function textBlock(scene:Scene,c:Config){
 const box=document.createElement('div');box.style.cssText='position:absolute;left:'+c.safeX*100+'%;right:'+c.safeX*100+'%;top:'+c.safeTop*100+'%;bottom:'+c.safeBottom*100+'%;display:flex;align-items:center;justify-content:center';
 const text=document.createElement('div');text.textContent=scene.text;text.dir=scene.direction;text.lang=htmlLanguage(c.language,scene.text);
 text.style.cssText='position:relative;width:100%;white-space:pre-wrap;overflow-wrap:normal;text-align:center;unicode-bidi:plaintext;line-height:'+c.lineHeight+';font-family:VideoPrimary'+c.fallbacks.map((_,i)=>',VideoFallback'+i).join('')+';font-weight:normal;color:'+(c.background==='black-grid'?c.white:c.ink);
 box.append(text);
 return {element:box,text,layout:()=>{
  fitText(text,c.fontSize,c.minFontSize);
  const origin=text.getBoundingClientRect(),node=text.firstChild!;
  const ranges:WordBox[]=[];
  for(const w of words(scene.text)){const range=document.createRange();range.setStart(node,w.start);range.setEnd(node,w.end);
   for(const r of range.getClientRects())ranges.push({start:w.start,end:w.end,rect:new DOMRect(r.x-origin.x,r.y-origin.y,r.width,r.height)});
  }
  return ranges;
 }};
}

