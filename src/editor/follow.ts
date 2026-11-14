// Reframing that follows the subject: from where the speaker's face is over time (media reframe,
// MediaPipe), a crop that moves like a calm camera operator: it holds while the face stays near
// the middle, glides (never jumps) when it leaves, and never shows outside the frame.
export type TrackPoint={time:number;face:boolean;x?:number;y?:number};
export type FollowPoint={t:number;x:number;y:number};

const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
const median=(a:number[])=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]!;};

/** The crop's centre over time, as fractions of the source frame. `crop` is the crop's width and
 *  height as fractions of the frame (a 9:16 crop of 16:9 is about 0.316 wide). */
export function followPath(track:TrackPoint[],o:{crop:{w:number;h:number};duration:number;deadZone?:number;speed?:number;step?:number}):FollowPoint[]{
 const found=track.filter(p=>p.face&&p.x!==undefined).sort((a,b)=>a.time-b.time);
 if(!found.length)return [];
 const step=o.step??.25,dead=o.deadZone??.07,speed=o.speed??.3;
 // The face, sampled evenly: gaps hold the last place seen; a short median smooths detector jitter.
 const at=(t:number)=>{let last=found[0]!;for(const p of found){if(p.time>t)break;last=p;}return last;};
 const raw:{t:number;x:number;y:number}[]=[];
 for(let t=0;t<=o.duration+1e-9;t+=step){const p=at(t);raw.push({t:+t.toFixed(3),x:p.x!,y:p.y??.4});}
 const smooth=raw.map((p,i)=>{const w=raw.slice(Math.max(0,i-2),i+3);return {t:p.t,x:median(w.map(q=>q.x)),y:median(w.map(q=>q.y))};});
 const lo={x:o.crop.w/2,y:o.crop.h/2},hi={x:1-o.crop.w/2,y:1-o.crop.h/2};
 // The face sits a little above the middle of a vertical frame (headroom), as a camera operator frames it.
 const aimY=(y:number)=>y+o.crop.h*.08;
 let cx=clamp(smooth[0]!.x,lo.x,hi.x),cy=clamp(aimY(smooth[0]!.y),lo.y,hi.y);
 const out:FollowPoint[]=[];
 for(const p of smooth){
  const tx=clamp(p.x,lo.x,hi.x),ty=clamp(aimY(p.y),lo.y,hi.y),max=speed*step;
  // Inside the dead zone the camera holds; outside it eases towards the face, no faster than `speed`.
  if(Math.abs(tx-cx)>dead*o.crop.w)cx+=clamp((tx-cx)*.5,-max,max);
  if(Math.abs(ty-cy)>dead*o.crop.h)cy+=clamp((ty-cy)*.5,-max,max);
  out.push({t:p.t,x:+cx.toFixed(4),y:+cy.toFixed(4)});
 }
 // Only the points where the movement changes are kept (the editor interpolates between them).
 return out.filter((p,i)=>i===0||i===out.length-1||!(Math.abs(p.x-out[i-1]!.x)<1e-4&&Math.abs(p.y-out[i-1]!.y)<1e-4&&Math.abs(p.x-out[i+1]!.x)<1e-4&&Math.abs(p.y-out[i+1]!.y)<1e-4));
}
/** The crop position for every frame, as FFmpeg sendcmd lines (pixels of the top-left corner). */
export function followCommands(path:FollowPoint[],o:{fps:number;duration:number;width:number;height:number;cw:number;ch:number}){
 const lines:string[]=[],frames=Math.ceil(o.duration*o.fps);let k=0;
 for(let f=0;f<frames;f++){
  const t=f/o.fps;while(k<path.length-2&&path[k+1]!.t<=t)k++;
  const a=path[k]!,b=path[Math.min(k+1,path.length-1)]!,u=b.t>a.t?clamp((t-a.t)/(b.t-a.t),0,1):0;
  const cx=(a.x+(b.x-a.x)*u)*o.width,cy=(a.y+(b.y-a.y)*u)*o.height;
  lines.push(`${t.toFixed(4)} crop x ${Math.round(clamp(cx-o.cw/2,0,o.width-o.cw))}, crop y ${Math.round(clamp(cy-o.ch/2,0,o.height-o.ch))};`);
 }
 return lines.join('\n')+'\n';
}
/** How much the crop moves, for the edit's note. */
export function followSummary(path:FollowPoint[]){
 let travel=0;for(let i=1;i<path.length;i++)travel+=Math.abs(path[i]!.x-path[i-1]!.x);
 return {moves:path.length,travel:+travel.toFixed(3)};
}
