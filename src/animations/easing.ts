export const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
export const easing={
 linear:(t:number)=>clamp(t),
 smooth:(t:number)=>{t=clamp(t);return t*t*(3-2*t);},
 cubic:(t:number)=>1-Math.pow(1-clamp(t),3),
 back:(t:number)=>{t=clamp(t)-1;return 1+2.70158*t*t*t+1.70158*t*t;},
 elastic:(t:number)=>{t=clamp(t);return t===0||t===1?t:Math.pow(2,-10*t)*Math.sin((t*10-.75)*(2*Math.PI/3))+1;},
 bounce:(t:number)=>{t=clamp(t);if(t<1/2.75)return 7.5625*t*t;if(t<2/2.75){t-=1.5/2.75;return 7.5625*t*t+.75;}if(t<2.5/2.75){t-=2.25/2.75;return 7.5625*t*t+.9375;}t-=2.625/2.75;return 7.5625*t*t+.984375;}
};
