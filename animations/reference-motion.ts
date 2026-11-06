import {clamp} from './easing.js';
import type {ReferenceScene} from '../engine/reference-motion-schema.js';
import type {z} from 'zod';
import type {mechanismKeyframeSchema} from '../engine/reference-motion-schema.js';
type Keyframe=z.infer<typeof mechanismKeyframeSchema>;
export function mechanismSample(t:number,duration:number,frames:Keyframe[],reduced=false,card=false){
 const q=reduced?1:clamp(t/duration);
 const right=frames.findIndex(f=>f.at>q);
 if(right===0)return frames[0];
 if(right<0)return frames[frames.length-1];
 const a=frames[right-1],b=frames[right],u=clamp((q-a.at)/(b.at-a.at));
 const e=card?u*u*u*(10+u*(-15+6*u)):b.easing==='linear'?u:b.easing==='cubic'?1-Math.pow(1-u,3):u*u*(3-2*u);
 const mix=(key:'x'|'y'|'rotation'|'scale'|'opacity')=>a[key]+(b[key]-a[key])*e;
 return {x:mix('x'),y:mix('y'),rotation:mix('rotation'),scale:mix('scale'),opacity:mix('opacity')};
}
// Pure scene-time sampling. Seeking backward must produce identical frames.
export function referenceLayerSample(t:number,duration:number,entrance:ReferenceScene['entrance'],delay=0,reduced=false){
 if(reduced)return {x:0,y:0,scale:1,opacity:1};
 const progress=clamp((t/duration-delay)/.22),e=1-Math.pow(1-progress,3);
 const pop=1+Math.sin(progress*Math.PI)*.08;
 return {x:(entrance==='left'?-90:entrance==='right'?90:0)*(1-e),
  y:(entrance==='rise'?95:entrance==='drop'?-95:0)*(1-e),
  scale:entrance==='pop'?(0.82+.18*e)*pop:1,
  opacity:clamp(progress*4)};
}
export function referenceCamera(t:number,duration:number,camera:ReferenceScene['camera'],reduced=false){
 const q=clamp(t/duration);
 return reduced?{scale:1,x:0}:{scale:camera==='push'?1+.025*q:camera==='pull'?1.025-.025*q:1,x:camera==='pan'?(q-.5)*12:0};
}

