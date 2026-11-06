// Original deterministic interpretation of blurred, keyframed color layers.
// Source observations: motion-library reference dba25b550e66390b, 64.81-129.62s.
export function gradientPositions(t:number,reduced=false){
 const time=reduced?0:t;
 return {x1:24+18*Math.sin(time*.42),y1:30+20*Math.cos(time*.35),x2:76+16*Math.cos(time*.31),y2:68+17*Math.sin(time*.38)};
}
export function gradientFlow(t:number,color:string,reduced=false){
 const p=gradientPositions(t,reduced);
 return 'radial-gradient(ellipse at '+p.x1+'% '+p.y1+'%,'+color+'40,transparent 55%),radial-gradient(ellipse at '+p.x2+'% '+p.y2+'%,'+color+'28,transparent 60%)';
}
