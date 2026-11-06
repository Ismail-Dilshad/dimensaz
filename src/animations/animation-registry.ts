import {clamp,easing} from './easing.js';
export const animationNames=[
 'word-slide-up','center-word-swap','phrase-rise','center-word-by-word','sentence-build','sentence-by-sentence','typewriter','mask-reveal','blur-reveal','staggered-text','smooth-replacement',
 'bounce-up','bounce-slide-up','bouncy-slide-glow','spring-pop','elastic-scale','squash-stretch',
 'keyword-highlight','marker-sweep','underline-draw','glow-pulse','keyword-zoom','color-transition','strikethrough-reveal',
 'text-stack','split-screen','comparison-layout','saas-feature-card','statistics-counter','cta-reveal','floating-cards',
 'floating-objects','parallax','soft-rotation','spring-entrance','shadow-animation',
 'fade','slide','zoom','blur','mask-transition'] as const;
export type AnimationName=typeof animationNames[number];
export type Motion={opacity:number;x:number;y:number;scaleX:number;scaleY:number;rotation:number;blur:number;clip:number;glow:number;emphasis:number;wordProgress:number};
export function motion(name:string,time:number,options:{duration?:number;delay?:number;easing?:keyof typeof easing;direction?:number;intensity?:number}={}):Motion{
 if(!animationNames.includes(name as AnimationName))throw new Error('Unknown animation: '+name);
 const q=clamp((time-(options.delay||0))/(options.duration||.55)),e=easing[options.easing||'cubic'](q),i=options.intensity??.65,d=options.direction??1;
 const m:Motion={opacity:clamp(q*3),x:0,y:0,scaleX:1,scaleY:1,rotation:0,blur:0,clip:1,glow:0,emphasis:0,wordProgress:q};
 switch(name){
 case 'phrase-rise':m.y=(1-e)*45*i;break;
 case 'bounce-up':m.y=(1-easing.back(q))*80*i;break;
 case 'bounce-slide-up':m.y=(1-easing.back(q))*90*i;m.x=(1-e)*50*i*d;break;
 case 'bouncy-slide-glow':m.y=(1-easing.back(q))*90*i;m.glow=Math.sin(q*Math.PI)*15*i;break;
 case 'spring-pop':case 'spring-entrance':m.scaleX=m.scaleY=1-(1-easing.back(q))*.25*i;break;
 case 'elastic-scale':m.scaleX=m.scaleY=1-(1-easing.elastic(q))*.4*i;break;
 case 'squash-stretch':m.scaleX=1+Math.sin(q*Math.PI)*.2*i;m.scaleY=1-Math.sin(q*Math.PI)*.2*i;break;
 case 'mask-reveal':case 'mask-transition':m.clip=e;break;
 case 'blur-reveal':case 'blur':m.blur=(1-e)*14*i;break;
 case 'slide':m.x=(1-e)*150*d*i;break;
 case 'zoom':m.scaleX=m.scaleY=.8+.2*e;break;
 case 'smooth-replacement':m.y=(1-e)*-20*i;m.blur=(1-e)*5;break;
 case 'text-stack':m.y=(1-e)*35*i;break;
 case 'split-screen':m.x=(1-e)*80*d*i;break;
 case 'comparison-layout':m.scaleX=.95+.05*e;break;
 case 'saas-feature-card':m.y=(1-e)*45*i;break;
 case 'cta-reveal':m.scaleX=m.scaleY=.96+.04*e;m.glow=Math.sin(q*Math.PI)*4*i;break;
 case 'floating-cards':m.y=Math.sin(time*1.7)*8*i;break;
 case 'floating-objects':m.y=Math.sin(time*1.4)*16*i;break;
 case 'parallax':m.x=Math.sin(time*.6)*20*i;m.y=Math.cos(time*.6)*6*i;break;
 case 'soft-rotation':m.rotation=Math.sin(time)*3*i;break;
 case 'shadow-animation':m.y=Math.sin(time)*10*i;m.glow=8+Math.sin(time)*4*i;break;
 case 'glow-pulse':m.glow=(.5+.5*Math.sin(time*3))*10*i;break;
 case 'keyword-zoom':m.emphasis=Math.sin(q*Math.PI)*.1*i;break;
 case 'keyword-highlight':case 'marker-sweep':case 'underline-draw':case 'color-transition':case 'strikethrough-reveal':m.emphasis=e;break;
 }
 return m;
}
