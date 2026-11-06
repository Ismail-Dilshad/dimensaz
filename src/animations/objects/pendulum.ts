// Original 2.5D badge swing; no reference logo or frames are used.
export function pendulum(t:number,intensity:number){
 const settle=Math.min(1,Math.max(0,t)/.5);
 return {rotation:Math.sin(t*2.2)*5*intensity*settle,y:(1-Math.cos(t*2.2))*3*intensity*settle};
}
