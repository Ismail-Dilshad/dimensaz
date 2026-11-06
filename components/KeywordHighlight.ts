import type {Scene} from '../engine/schema.js';
import type {WordBox} from './TextBlock.js';
export function highlights(scene:Scene,boxes:WordBox[],color:string){
 const el=document.createElement('div');el.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:-1;';
 const marks=boxes.filter(b=>scene.highlights.some(h=>b.start<h.end&&b.end>h.start)).map(b=>{
  const bar=document.createElement('div');
  bar.style.cssText='position:absolute;left:'+b.rect.x+'px;top:'+(b.rect.bottom-8)+'px;width:'+b.rect.width+'px;height:7px;border-radius:6px;background:'+color+';transform-origin:'+(scene.direction==='rtl'?'right':'left');
  el.append(bar);return {bar,rect:b.rect};
 });
 return {element:el,render:(v:number,name:string)=>{
  for(const {bar,rect} of marks){
   bar.style.transform='scaleX('+v+')';
   bar.style.opacity=String(name==='keyword-highlight'?.2:1);
   bar.style.height='7px';bar.style.top=(rect.bottom-8)+'px';
   if(name==='marker-sweep'||name==='keyword-highlight'){
    // Use this word's measured line box, never the full paragraph height.
    bar.style.height=(rect.height*.5)+'px';
    bar.style.top=(rect.y+rect.height*.32)+'px';
   }else if(name==='strikethrough-reveal')bar.style.top=(rect.y+rect.height*.5)+'px';
  }
 }};
}
