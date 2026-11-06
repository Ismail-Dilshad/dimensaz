import {motion} from '../animations/animation-registry.js';
import {fitText} from '../engine/text-fit.js';
import {words,strongDirection} from '../engine/rtl-layout.js';
import {clamp,easing} from '../animations/easing.js';
import type {Config,Scene} from '../engine/schema.js';
import {htmlLanguage} from '../engine/languages.js';

// Each span contains a COMPLETE word, including attached punctuation. Arabic
// glyphs remain shaped by Chromium; no letters are split or strings reversed.
export function kineticText(scene:Scene,c:Config){
 const d=c.referenceStyle?undefined:scene.director??c.director?.resolved;
 const centered=(d?.textReveal==='replacement'||(!d&&scene.animation==='center-word-swap'))&&!c.reducedMotion;
 const box=document.createElement('div');
 box.dataset.kinetic='true';
 box.style.cssText='position:absolute;left:'+c.safeX*100+'%;right:'+c.safeX*100+'%;top:'+c.safeTop*100+'%;bottom:'+c.safeBottom*100+'%;display:flex;align-items:center;justify-content:center';
 const text=document.createElement('div');text.dir=scene.direction;text.lang=htmlLanguage(c.language,scene.text);
 text.style.cssText='position:relative;width:100%;white-space:pre-wrap;text-align:center;unicode-bidi:isolate;line-height:'+c.lineHeight+';font-family:VideoPrimary'+c.fallbacks.map((_,i)=>',VideoFallback'+i).join('')+';font-weight:normal;color:'+(c.background==='black-grid'?c.white:c.ink);
 if(d&&d.composition==='card'){text.style.background=d.creativeDirection==='glass'?'#ffffff88':d.palette.primary+'10';text.style.border='1px solid '+d.palette.primary+'28';text.style.borderRadius='24px';text.style.padding='16px';text.style.boxSizing='border-box';}
 if(d&&d.composition==='stack')text.style.textAlign='start';
 if(d){text.style.textAlign=d.typography.align;text.style.maxWidth=d.typography.width*100+'%';box.style.alignItems=d.typography.position==='top'?'flex-start':d.typography.position==='bottom'?'flex-end':'center';}
 const tokens=words(scene.text);
 const layers:HTMLElement[]=[];
 let offset=0;let run:HTMLElement=text;let runDirection:typeof scene.direction=scene.direction;
 const headline=c.referenceStyle?scene.referenceMotion?.headline:undefined;
 const gap=(from:number,to:number)=>{
  const value=scene.text.slice(from,to);
  if(headline&&(from<headline.from||to>headline.to)){const hidden=document.createElement('span');hidden.textContent=value;hidden.style.display='none';run.append(hidden);}
  else run.append(document.createTextNode(value));
 };
 for(const w of tokens){
  gap(offset,w.start);
  // Inline-block words are bidi-neutral atoms. Group directional runs so a
  // Latin phrase inside RTL (or Arabic inside English) keeps its reading order.
  const wordDirection=strongDirection(w.text)||(/\p{N}/u.test(w.text)?'ltr':runDirection);
  if(run===text||wordDirection!==runDirection){
   run=document.createElement('bdi');run.dir=wordDirection;runDirection=wordDirection;text.append(run);
  }
  const span=document.createElement('span');span.textContent=w.text;span.dataset.word='true';span.dir='auto';
  const emphasized=scene.highlights.some(h=>w.start<h.end&&w.end>h.start);
  span.style.cssText='display:inline-block;position:relative;white-space:pre;transform-origin:center;vertical-align:baseline;'+(emphasized?'font-size:'+scene.emphasisScale+'em;color:'+c.primary+';':'');
  // Keep director words on stable compositor layers. Without this, Chromium can
  // choose a different text raster scale after seeking through a spring transform,
  // even when the final DOM and time are identical. No real-time animation is used.
  if(d)span.style.willChange='transform';
  if(emphasized&&c.referenceStyle){span.style.background=c.referenceStyle.accent;span.style.color=c.referenceStyle.onAccent;span.style.padding='0 .1em';span.style.borderRadius=c.referenceStyle.texture==='glass'?'.22em':'.04em';span.style.fontSize='1em';}
  if(emphasized&&c.referenceStyle&&scene.referenceMotion?.highlightJoin){span.style.borderRadius='0';span.style.boxShadow='-.1em 0 0 '+c.referenceStyle.accent+',.1em 0 0 '+c.referenceStyle.accent;}
  if(headline&&(w.start<headline.from||w.end>headline.to))span.style.display='none';
  span.dataset.emphasis=String(emphasized);
  run.append(span);layers.push(span);offset=w.end;
 }
 gap(offset,scene.text.length);box.append(text);
 const layout=()=>{
  if(centered){
   // Reserve a stable center zone; fit each whole word independently.
   text.style.height='1px';text.style.fontSize=c.fontSize+'px';
   for(const span of layers){
    span.style.position='absolute';span.style.left='50%';span.style.top='50%';
    span.style.width='max-content';span.style.maxWidth='none';
    let size=c.fontSize*1.65*(span.dataset.emphasis==='true'?scene.emphasisScale:1);
    span.style.fontSize=size+'px';
    while(size>c.minFontSize&&(span.getBoundingClientRect().width>box.clientWidth*.94||span.getBoundingClientRect().height>box.clientHeight*.9)){size=Math.max(c.minFontSize,size-2);span.style.fontSize=size+'px';}
    if(span.getBoundingClientRect().width>box.clientWidth||span.getBoundingClientRect().height>box.clientHeight)throw new Error('Centered word does not fit safe area');
   }
  }else fitText(text,c.fontSize,c.minFontSize);
  return [];
 };
 const render=(local:number)=>{
  if(c.referenceStyle?.card){
   // One shaped source phrase per scene, anchored to the first displayed spoken word.
   const first=scene.wordCues?.find(cue=>!headline||cue.from>=headline.from&&cue.from<headline.to);
   const elapsed=local-(first?.start??0);
   const q=c.reducedMotion?Number(elapsed>=0):clamp(elapsed/.45);
   if(scene.referenceMotion?.scoreFrames){
    const eased=q*q*q*(10+q*(-15+6*q));
    text.style.opacity=String(eased);text.style.transform='translateY('+((1-eased)*8)+'px)';
    return;
   }
   text.style.opacity=String(q*q*(3-2*q));text.style.transform='translateY('+((1-q)**3*8)+'px)';
   return;
  }
  const duration=Math.max(.01,scene.duration-c.exit);
  const step=duration/Math.max(1,layers.length);
  const cues=scene.wordCues;
  const activeIndex=cues?cues.reduce((n,c,i)=>local>=c.start?i:n,-1):Math.min(layers.length-1,Math.floor(Math.max(0,local)/step));
  for(let i=0;i<layers.length;i++){
   const span=layers[i];
   if(centered){
    const index=activeIndex;
    const phase=clamp((local-(cues?.[i].start??i*step))/Math.min(.16,step*.65));
    span.style.opacity=i===index?'1':'0';
    span.style.transform='translate(-50%,-50%) translateY('+((1-easing.cubic(phase))*30)+'px) scale('+(.94+.06*easing.cubic(phase))+')';
   }else if(scene.animation==='word-slide-up'){
    // Visual cadence is independent of speech alignment. Caller must not
    // describe this as verified spoken-word timing without real cue data.
    const reveal=scene.referenceMotion?.headlineRevealSeconds??Math.max(.2,Math.min(duration*.72,duration-.35));
    const delay=cues?.[i].start??i*reveal/Math.max(1,layers.length);
    const q=clamp((local-delay)/(cues?.[i]?Math.min(.12,cues[i].end-cues[i].start):Math.min(.3,step*.85+.08)));
    span.style.opacity=cues?(local>=delay?'1':'0'):String(q);
    span.style.transform='translateY('+((1-easing.cubic(q))*38)+'px)';
   }else{
    span.style.opacity='1';span.style.transform='none';
   }
   if(cues&&c.textTreatment==='kinetic'&&scene.wordCues){span.dataset.active=String(i===activeIndex);if(window.PROJECT.production?.preset==='active-word')span.style.color=i===activeIndex?c.primary:(c.background==='black-grid'?c.white:c.ink);}
   if(d){
    const cue=cues?.[i];const spoken=!!cue&&local>=cue.start&&local<cue.end;
    // No estimated word timestamps are introduced. Unaligned previews show the sentence.
    const reveal=d.textReveal;let start=0,visible=true;
    if(cues){if(reveal==='progressive'){start=cue!.start;visible=local>=start;}else if(reveal==='replacement'){start=cue!.start;visible=spoken;}else if(reveal==='phrase'){const group=Math.floor(i/3)*3;start=cues[group].start;visible=local>=start;}}
    const animation={fade:'fade','slide-up':'phrase-rise','slide-down':'phrase-rise','slide-left':'slide','slide-right':'slide',bounce:'bounce-up',spring:'spring-pop',scale:'zoom',blur:'blur-reveal',mask:'mask-reveal'}[d.textEntrance];
    const m=motion(animation,local-start,{duration:d.animation.duration,easing:d.animation.easing,intensity:d.animation.energy,direction:d.textEntrance==='slide-left'?-1:1});
    if(d.textEntrance==='slide-down')m.y=-m.y;
    const tail=clamp((scene.duration-local)/d.animation.duration),exit=d.textExit==='cut'?1:tail;
    span.style.opacity=visible?String(m.opacity*(d.textExit==='fade'?exit:1)):'0';
    const scale=(d.textHighlight==='scale'&&spoken?1.08:1)*(d.textExit==='scale'?.8+.2*exit:1);
    span.style.transform=(centered?'translate(-50%,-50%) ':'')+'translate('+m.x+'px,'+(m.y+(d.textExit==='slide'?(1-exit)*30:0))+'px) scale('+(m.scaleX*scale)+','+(m.scaleY*scale)+')';
    span.style.filter='blur('+(m.blur+(d.textExit==='blur'?(1-exit)*8:0))+'px)';
    span.style.clipPath='inset(0 0 0 '+((1-m.clip)*100)+'%)';
    span.style.color=d.textHighlight==='color'&&(span.dataset.emphasis==='true'||d.textReveal==='active'&&spoken)?d.palette.highlight:d.palette.text;
    span.style.textDecoration=spoken&&d.textHighlight==='underline'?'underline':'none';
    span.style.backgroundColor=spoken&&d.textHighlight==='background'?d.palette.highlight+'30':'transparent';span.style.borderRadius='0.15em';
    if(c.reducedMotion){span.style.transform=centered?'translate(-50%,-50%)':'none';span.style.filter='none';}
   }
   if(c.reducedMotion){span.style.opacity=cues?(local>=cues[i].start?'1':'0'):'1';span.style.transform='none';}
  }
 };
 return {element:box,text,layout,render};
}
