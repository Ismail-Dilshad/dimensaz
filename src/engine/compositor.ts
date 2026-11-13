import {explainerStage} from '../components/ExplainerStage.js';
import {pendulumStage} from '../components/PendulumStage.js';
import {presenterStage} from '../components/PresenterStage.js';
import {referenceStage} from '../components/ReferenceStage.js';
import {clayStage} from '../components/ClayStage.js';
import {speechEvents} from './speech-events.js';
import {kineticText} from '../components/KineticText.js';
import {statisticsCounter} from '../components/StatisticsCounter.js';
import {background} from '../components/Background.js';
import {progressBar} from '../components/ProgressBar.js';
import {clayObject} from '../components/ClayObject.js';
import {textBlock} from '../components/TextBlock.js';
import {wordReveal} from '../components/WordReveal.js';
import {highlights} from '../components/KeywordHighlight.js';
import {decorateCard} from '../components/SaaSCard.js';
import {videoFrame} from '../components/VideoFrame.js';
import {buildPiece,transitionStyle,pieceThemeFor} from '../components/pieces/index.js';
import {speechTimed} from '../components/pieces/timing.js';
import {style} from '../presets/styles.js';
import {motion,animationNames} from '../animations/animation-registry.js';
import {clamp} from '../animations/easing.js';
import {total} from '../animations/timeline.js';
import {graphemes,words} from './rtl-layout.js';
import type {Project} from './schema.js';
declare global {interface Window {render:(t:number)=>Promise<void>;TOTAL:number;ready:Promise<void>;qa:unknown;PROJECT:Project;ASSETS:Record<string,string>;}}
async function setup(){
 const p=window.PROJECT,c=p.config,theme=style(c),root=document.getElementById('stage')!;
 if(c.pendulum){await pendulumStage(p,root);return;}
 if(c.presenterInserts){await presenterStage(p,root);return;}
 if(c.explainer){await explainerStage(p,root);return;}
 const speech=speechEvents(p);
 root.style.cssText='position:relative;overflow:hidden;width:'+c.width+'px;height:'+c.height+'px;';
 const bg=background(c);root.append(bg.element);
 const footage=p.media.find(m=>m.kind==='video');let video:ReturnType<typeof videoFrame>|undefined;
 if(footage){video=videoFrame('/media/'+encodeURIComponent(footage.id),c.fit);root.append(video.element);
 const scrim=document.createElement('div');scrim.style.cssText='position:absolute;inset:0;background:#ffffffa8;z-index:2;';root.append(scrim);}
 const image=p.media.find(m=>m.kind==='image');
 const views=p.scenes.map(scene=>{
  if(!animationNames.includes(scene.animation as any))throw new Error('Unknown scene animation '+scene.animation);
  const layer=document.createElement('div');layer.style.cssText='position:absolute;inset:0;z-index:3;';root.append(layer);
  const kinetic=c.textTreatment==='kinetic'?kineticText(scene,c):undefined;
  const view=kinetic??textBlock(scene,c);layer.append(view.element);
  // Headline type in the video's generated style (Latin-script lines; other scripts keep the language's font).
  if(c.frame&&!/[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(scene.text)){const f=c.frame,st=view.text.style;
   if(f.font)st.fontFamily='"PieceDisplay-'+f.genome+'",'+st.fontFamily;st.fontWeight=String(f.weight);
   if(f.upper&&scene.text.length<=90)st.textTransform='uppercase';st.letterSpacing=(f.upper?Math.max(.02,f.tracking):f.tracking)+'em';}
  if(!kinetic&&(theme.card||scene.layout==='card'||['saas-feature-card','comparison-layout'].includes(scene.animation)))decorateCard(view.text,c.primary,c.radius);
  // Composition adjustments remain deterministic and never insert invented copy.
  if(!kinetic&&(scene.layout==='stack'||scene.animation==='text-stack')){view.text.style.textAlign=scene.direction==='rtl'?'right':'left';view.text.style.maxWidth='75%';}
  if(!kinetic&&(scene.layout==='split'||scene.animation==='split-screen')){view.text.style.columnCount='2';view.text.style.columnGap='48px';view.text.style.columnRule='2px solid '+c.primary+'35';}
  let object:ReturnType<typeof clayObject>|undefined;
  const reference=c.referenceStyle&&scene.referenceMotion?referenceStage(scene,c,window.ASSETS):undefined;
  if(reference){layer.prepend(reference.element);const r=reference.rects.text;Object.assign(view.element.style,{left:r.x*100+'%',right:'auto',top:r.y*100+'%',bottom:'auto',width:r.w*100+'%',height:r.h*100+'%',zIndex:'4'});}
  // Animated scene piece: the visual takes most of the frame, the sentence sits above or below it.
  let piece:ReturnType<typeof buildPiece>|undefined;
  if(scene.piece&&!reference){
   const sp=speechTimed(scene.piece,scene),H=c.height,W=c.width,top=c.safeTop*H,bottom=(1-c.safeBottom)*H,avail=bottom-top;
   const ph=Math.min(sp.size*H,avail-.2*H),pw=W*(1-2*Math.max(.05,c.safeX*.8)),gap=.025*H;
   const pieceTop=sp.placement==='top'?top:sp.placement==='bottom'?bottom-ph:Math.max(top+.2*H+gap,bottom-ph-(avail-ph-.2*H-gap)*.35);
   const holder=document.createElement('div');holder.style.cssText='position:absolute;left:'+(W-pw)/2+'px;top:'+pieceTop+'px;width:'+pw+'px;height:'+ph+'px;z-index:3;font-family:VideoPrimary'+c.fallbacks.map((_,i)=>',VideoFallback'+i).join('')+';';
   piece=buildPiece(sp,{theme:pieceThemeFor(c),box:{w:pw,h:ph},font:'VideoPrimary',dir:scene.direction,assets:window.ASSETS});
   holder.append(piece.el);layer.prepend(holder);
   const textTop=sp.placement==='top'?pieceTop+ph+gap:top,textBottom=sp.placement==='top'?bottom:pieceTop-gap;
   Object.assign(view.element.style,{top:textTop/H*100+'%',bottom:(1-textBottom/H)*100+'%'});
  }
  const clay=!piece&&!reference&&c.illustrationLayout==='clay-stage'&&scene.asset&&window.ASSETS[scene.asset]?clayStage(scene,c,window.ASSETS[scene.asset]):undefined;
  if(clay){layer.prepend(clay.panel);layer.append(clay.element);view.element.style.top='57%';view.element.style.bottom='17%';}
  if(!piece&&!reference&&!clay&&(scene.asset||image)&&(c.visuals||image)){
   const src=image?'/media/'+encodeURIComponent(image.id):window.ASSETS[scene.asset!];
   if(src){object=clayObject(src,Math.min(c.width*.3,c.height*.18));layer.append(object.element);view.element.style.top='35%';}
  }
  const counter=!piece&&scene.number!==undefined?statisticsCounter(scene.number,c.primary):undefined;
  if(counter){layer.append(counter.element);view.element.style.top='30%';}
  const boxes=view.layout();
  const isWords=['sentence-build','staggered-text','center-word-by-word','typewriter'].includes(scene.animation);
  const reveal=!kinetic&&isWords?wordReveal(view.text,boxes):undefined;
  const marks=highlights(reference?{...scene,highlights:[]}:scene,boxes,c.primary);view.text.style.isolation='isolate';view.text.append(marks.element);
  return {scene,layer,view,boxes,reveal,marks,object,counter,kinetic,clay,reference,piece};
 });
 await document.fonts.ready;
 await Promise.all([...document.images].map(img=>img.decode()));
 const progress=progressBar(c.primary);if(c.progress)root.append(progress.element);
 window.TOTAL=total(p.scenes);
 window.qa={font:document.fonts.check('32px VideoPrimary'),texts:p.scenes.map(s=>s.text),scenes:views.map(v=>({id:v.scene.id,fontSize:v.view.text.style.fontSize,boxes:v.boxes.length}))};
 window.render=async(t:number)=>{
  bg.render(t);progress.render(t,window.TOTAL);if(video)await video.render(t);
  for(const v of views){const {scene:s,layer,view,marks,reveal,object}=v,local=t-s.start;
   const active=local>=0&&local<s.duration;const display=active?'block':'none';if(layer.style.display!==display)layer.style.display=display;if(!active)continue;
   const effective=c.reducedMotion?'fade':s.animation;const m=motion(effective,local,{duration:s.motion?.duration??c.entrance,easing:s.motion?.easing,intensity:s.motion?.intensity??c.intensity*theme.intensity,direction:s.direction==='rtl'?-1:1});
   v.kinetic?.render(local);v.clay?.render(local);
   const heroAnchor=speech.find(event=>event.kind==='object'&&event.sceneId===s.id);
   if(v.reference){v.reference.element.style.visibility=heroAnchor&&t<heroAnchor.time?'hidden':'visible';v.reference.render(heroAnchor?Math.max(0,t-heroAnchor.time):local);}
   const camera=speech.find(event=>event.kind==='camera'&&event.sceneId===s.id);
   if(camera&&t>=camera.time&&!c.reducedMotion){const cm=motion('parallax',t-camera.time,{intensity:c.intensity});const origin=motion('parallax',0,{intensity:c.intensity});m.x+=cm.x-origin.x;m.y+=cm.y-origin.y;}
   const ds=s.director??c.director?.resolved;
   const exit=clamp((s.duration-local)/c.exit);const tr=motion(c.reducedMotion?'fade':c.transition,exit*(c.transitionDuration||.001),{duration:c.transitionDuration||.001,intensity:c.intensity,direction:s.direction==='rtl'?-1:1});
   layer.style.opacity=s.wordCues?String(s.wordCues.some(cue=>local>=cue.start)?1:0):String(m.opacity*exit);
   layer.style.transform='translate('+(m.x+tr.x)+'px,'+(m.y+tr.y)+'px) scale('+(m.scaleX*tr.scaleX)+','+(m.scaleY*tr.scaleY)+') rotate('+m.rotation+'deg)';
   layer.style.filter='blur('+(m.blur+tr.blur)+'px) drop-shadow(0 0 '+m.glow+'px '+c.primary+'55)';
   layer.style.clipPath=s.direction==='rtl'?'inset(0 0 0 '+((1-m.clip*tr.clip)*100)+'%)':'inset(0 '+((1-m.clip*tr.clip)*100)+'% 0 0)';
   if(ds&&!v.piece){
    // Director word entrances live inside KineticText; do not double-animate the sentence.
    const q=clamp(local/s.duration),ending=clamp((s.duration-local)/Math.max(.01,c.transitionDuration));
    const cam=!c.reducedMotion&&ds.camera==='gentle-zoom'?1+q*.025:1,pan=!c.reducedMotion&&ds.camera==='pan'?q*12:0;
    layer.style.opacity=ds.transitions==='fade'?String(ending):'1';layer.style.filter='none';
    layer.style.transform='translateX('+(pan+(ds.transitions==='slide'?(1-ending)*60:0))+'px) scale('+(cam*(ds.transitions==='zoom'?.96+.04*ending:1))+')';
    layer.style.clipPath=ds.transitions==='mask'?'inset(0 0 0 '+((1-ending)*100)+'%)':'none';
   }
   if(v.reference){
    const r=s.referenceMotion!,q=c.reducedMotion?1:clamp((s.duration-local)/Math.min(.4,s.duration*.12));
    layer.style.opacity=r.transition==='fade'?String(q):'1';layer.style.filter='none';
    layer.style.transform=r.transition==='push'?'scale('+(1+(1-q)*.06)+')':'none';
    layer.style.clipPath=r.transition==='wipe'?'inset(0 0 0 '+((1-q)*100)+'%)':'none';
   }
   if(v.piece&&s.piece){
    // The piece's designed transition drives the scene; the text keeps its own entrance.
    const inP=c.reducedMotion?1:clamp(local/.55),out=c.reducedMotion||s.piece.transition==='none'?1:clamp((s.duration-local)/.3);
    const st=transitionStyle(s.piece.transition,inP,s.direction,c.width);
    layer.style.opacity=String(Number(st.opacity)*(.15+.85*out));layer.style.transform=st.transform==='none'?'scale('+(.985+.015*out)+')':st.transform+' scale('+(.985+.015*out)+')';
    layer.style.clipPath=st.clipPath;layer.style.filter=st.filter;
    if(!v.kinetic){view.element.style.opacity=String(m.opacity);view.element.style.transform='translate('+m.x+'px,'+m.y+'px) scale('+m.scaleX+','+m.scaleY+')';}
    // A piece longer than its scene plays faster so it finishes by 85% of the scene.
    const speed=Math.max(1,v.piece.length/Math.max(.5,s.duration*.85));
    v.piece.render(c.reducedMotion?Math.max(local,v.piece.length):local*speed);
   }
   marks.render(['marker-sweep','underline-draw','strikethrough-reveal','keyword-highlight'].includes(s.animation)?m.emphasis:clamp(local/c.entrance),s.animation);
   const color=c.background==='black-grid'?c.white:c.ink;
   if(reveal){const tokens=words(s.text),revealDuration=Math.max(c.entrance,s.duration-c.exit-.8);
    let count=clamp(local/revealDuration)*v.boxes.length;
    if(s.animation==='typewriter'){const gs=graphemes(s.text),end=gs[Math.min(gs.length-1,Math.floor(clamp(local/revealDuration)*gs.length))]?.end||0;count=v.boxes.filter(b=>b.start<end).length;}
    if(s.animation==='center-word-by-word'){const index=Math.min(tokens.length-1,Math.floor(clamp(local/(s.duration-c.exit))*tokens.length));reveal.layers.forEach((el,i)=>{const b=v.boxes[i];el.style.opacity=b.start===tokens[index]?.start?'1':'0';el.style.color=color;el.style.transform='translate('+((view.text.clientWidth/2-b.rect.x-b.rect.width/2))+'px,'+((view.text.clientHeight/2-b.rect.y-b.rect.height/2))+'px)';});}
    else reveal.render(count,color,s.animation==='staggered-text');
   }
   if(s.animation==='color-transition')view.text.style.color=local<c.entrance/2?color:c.primary;
   if(s.animation==='keyword-zoom')view.text.style.transform='scale('+(1+m.emphasis)+')';
   v.counter?.render(clamp(local/(s.duration-c.exit)));
   const objectEvent=speech.find(event=>event.kind==='object'&&event.sceneId===s.id);
   if(object){object.element.style.visibility=objectEvent&&t<objectEvent.time?'hidden':'visible';object.render(objectEvent?Math.max(0,t-objectEvent.time):local,c.reducedMotion?0:c.intensity,s.objectMotion);if(ds){const elapsed=objectEvent?Math.max(0,t-objectEvent.time):local;const entrance=motion(({fade:'fade',pop:'zoom','slide-up':'phrase-rise',spring:'spring-pop'} as const)[ds.objectEntrance],elapsed,{duration:ds.animation.duration,intensity:ds.animation.energy});object.element.style.opacity=String(entrance.opacity);object.element.style.transform+=' translateY('+entrance.y+'px) scale('+entrance.scaleX+')';}}
  }
 };
 await window.render(0);
}
window.ready=(async()=>{
 await Promise.all(['VideoPrimary',...window.PROJECT.config.fallbacks.map((_,i)=>'VideoFallback'+i)].map(font=>document.fonts.load('32px '+font)));
 // Fonts of the pieces' design styles (declared by the renderer only when used).
 const pieceFonts=[...document.fonts].map(f=>f.family.replace(/["']/g,'')).filter(f=>f.startsWith('Piece'));
 await Promise.all(pieceFonts.map(f=>document.fonts.load('32px "'+f+'"')));
 await document.fonts.ready;await setup();
})();


