// Screen recording polish: the cursor is found in the picture (or read from a recorder's log), a
// soft highlight follows it, the frame zooms in where a click changes the screen and back out after,
// and the waiting (nothing moves, the cursor rests) is trimmed. It reads the recording only; the
// result is an ordinary edit list (cursor, zooms, cut).
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import {ffmpeg,probe} from '../renderer/ffmpeg-encoder.js';
import type {Operation} from './edl.js';

export type Point={t:number;x:number;y:number};
export type Zoom={start:number;end:number;x:number;y:number;scale:number};
export type ScreenPlan={file:string;seconds:number;width:number;height:number;cursor:Point[];clicks:(Point&{why:string})[];
 zooms:Zoom[];waits:{start:number;end:number}[];found:'picture'|'log'|'none';notes:string[]};

// ---------- the cursor: an arrow, found by its outline (light or dark, at any of a few sizes) ----------
const ARROW=[[0,0],[0,17],[4,13.2],[7,20],[9.6,19],[6.6,12.2],[12,12.2]] as const;
function inside(px:number,py:number,poly:readonly (readonly [number,number])[]){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i]!,[xj,yj]=poly[j]!;if(((yi>py)!==(yj>py))&&px<(xj-xi)*(py-yi)/(yj-yi)+xi)c=!c;}return c;}
type Tpl={w:number;h:number;v:Float32Array;mean:number;norm:number};
/** The arrow's outline at a height in pixels, as a pattern of edges to look for. */
function template(height:number):Tpl{
 const k=height/20,poly=ARROW.map(([x,y])=>[x*k,y*k] as const),w=Math.ceil(12*k)+3,h=Math.ceil(20*k)+3,fill=new Uint8Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)fill[y*w+x]=inside(x-1+.5,y-1+.5,poly)?1:0;
 const v=new Float32Array(w*h);for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;v[i]=Math.abs(fill[i+1]!-fill[i-1]!)+Math.abs(fill[i+w]!-fill[i-w]!);}
 const mean=v.reduce((a,b)=>a+b,0)/v.length;let n=0;for(const x of v)n+=(x-mean)**2;return {w,h,v,mean,norm:Math.sqrt(n)};
}
/** The best place for the arrow (its tip) inside a window of the frame's edges, and how well it fits (0..1). */
function match(edges:Float32Array,W:number,H:number,tpls:Tpl[],win:{x0:number;y0:number;x1:number;y1:number}){
 let best={score:0,x:0,y:0};
 for(const t of tpls){
  for(let y=Math.max(0,Math.round(win.y0));y<=Math.min(H-t.h,Math.round(win.y1));y++)for(let x=Math.max(0,Math.round(win.x0));x<=Math.min(W-t.w,Math.round(win.x1));x++){
   let s=0,s2=0,st=0;for(let j=0;j<t.h;j++){const r=(y+j)*W+x,q=j*t.w;for(let i=0;i<t.w;i++){const e=edges[r+i]!;s+=e;s2+=e*e;st+=e*t.v[q+i]!;}}
   const n=t.w*t.h,mean=s/n,varE=s2-n*mean*mean;if(varE<=1e-6)continue;
   const score=(st-mean*t.mean*n)/(Math.sqrt(varE)*t.norm);if(score>best.score)best={score,x:x+1,y:y+1};}
 }
 return best;
}
const edgesOf=(g:Uint8Array,W:number,H:number)=>{const e=new Float32Array(W*H);for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x;e[i]=(Math.abs(g[i+1]!-g[i-1]!)+Math.abs(g[i+W]!-g[i-W]!))/255;}return e;};

type Blob={x0:number;y0:number;x1:number;y1:number;cells:number};
/** What changed from one frame to the next, as blobs of 8 px cells. */
function changes(a:Uint8Array,b:Uint8Array,W:number,H:number):Blob[]{
 const C=8,cw=Math.ceil(W/C),ch=Math.ceil(H/C),hot=new Uint16Array(cw*ch);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(Math.abs(a[i]!-b[i]!)>24)hot[(y/C|0)*cw+(x/C|0)]!++;}
 const seen=new Uint8Array(cw*ch),out:Blob[]=[];
 for(let s=0;s<hot.length;s++){if(hot[s]!<2||seen[s])continue;const q=[s];seen[s]=1;const bl={x0:1e9,y0:1e9,x1:-1,y1:-1,cells:0};
  while(q.length){const c=q.pop()!,cx=c%cw,cy=c/cw|0;bl.cells++;bl.x0=Math.min(bl.x0,cx*C);bl.y0=Math.min(bl.y0,cy*C);bl.x1=Math.max(bl.x1,cx*C+C);bl.y1=Math.max(bl.y1,cy*C+C);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const){const nx=cx+dx,ny=cy+dy,n=ny*cw+nx;if(nx>=0&&ny>=0&&nx<cw&&ny<ch&&!seen[n]&&hot[n]!>=2){seen[n]=1;q.push(n);}}}
  out.push(bl);}
 return out;
}
/** Reads gray frames of a video at `fps`, one at a time. */
async function eachFrame(file:string,W:number,H:number,fps:number,f:(g:Uint8Array,i:number)=>void){
 const size=W*H;
 await new Promise<void>((resolve,reject)=>{const c=spawn(ffmpeg,['-v','error','-i',file,'-an','-vf',`fps=${fps},scale=${W}:${H},format=gray`,'-f','rawvideo','-'],{windowsHide:true});
  let buf:Buffer=Buffer.alloc(0),i=0,err='';c.stderr.on('data',d=>err+=d);
  c.stdout.on('data',(d:Buffer)=>{buf=(buf.length?Buffer.concat([buf,d]):d) as Buffer;while(buf.length>=size){f(new Uint8Array(buf.subarray(0,size)),i++);buf=buf.subarray(size);}});
  c.on('error',reject);c.on('close',code=>code===0?resolve():reject(new Error('Reading the recording failed: '+err)));});
}
type Log={cursor?:{t:number;x:number;y:number}[];clicks?:{t:number;x:number;y:number}[]};

/** Finds the cursor, the clicks and the waiting in a screen recording, and plans the polish. A
 *  recorder's log ({cursor:[{t,x,y}],clicks:[{t,x,y}]}, in pixels or fractions) is used as it is. */
export async function analyzeScreen(file:string,o:{log?:string;fps?:number;wait?:number;maxZoom?:number}={}):Promise<ScreenPlan>{
 const p=await probe(file),v=(p.streams as {codec_type:string;width?:number;height?:number}[]).find(s=>s.codec_type==='video');if(!v)throw new Error('Not a video: '+file);
 const width=Number(v.width),height=Number(v.height),seconds=Number(p.format?.duration)||0,fps=o.fps??10;
 const W=Math.min(960,width)&~1,H=Math.round(height*W/width)&~1,tpls=[12,15,19,24].map(template),notes:string[]=[];
 const log=o.log?JSON.parse(await fs.readFile(o.log,'utf8')) as Log:null;
 const frac=(pt:{t:number;x:number;y:number})=>({t:+pt.t.toFixed(3),x:+(pt.x>1?pt.x/width:pt.x).toFixed(4),y:+(pt.y>1?pt.y/height:pt.y).toFixed(4)});
 let cursor:Point[]=log?.cursor?.map(frac)??[];
 const frames:{t:number;activity:number;change:Blob|null}[]=[];
 let prev:Uint8Array|null=null,last:{x:number;y:number}|null=null;
 await eachFrame(file,W,H,fps,(g,i)=>{
  const t=i/fps;
  if(!prev){prev=g;frames.push({t,activity:0,change:null});return;}
  const blobs=changes(prev,g,W,H),small=blobs.filter(b=>b.x1-b.x0<=56&&b.y1-b.y0<=56);
  if(!log?.cursor){
   // The arrow, looked for where it was and where something small moved.
   const wins=[...(last?[{x0:last.x-40,y0:last.y-40,x1:last.x+40,y1:last.y+40}]:[]),...small.map(b=>({x0:b.x0-20,y0:b.y0-20,x1:b.x1+4,y1:b.y1+4}))];
   if(!last&&!small.length&&i%Math.round(fps)===0)wins.push({x0:0,y0:0,x1:W,y1:H});
   if(wins.length&&(small.length||!last)){const e=edgesOf(g,W,H);let best={score:0,x:0,y:0};for(const w of wins){const m=match(e,W,H,tpls,w);if(m.score>best.score)best=m;}
    if(best.score>.5){last={x:best.x,y:best.y};cursor.push({t:+t.toFixed(3),x:+(best.x/W).toFixed(4),y:+(best.y/H).toFixed(4)});}}
  }
  // What changed, apart from the cursor: the biggest such change is where a click may have acted.
  const cur=log?.cursor?nearest(cursor,t):last?{x:last.x/W,y:last.y/H}:null;
  const near=(b:Blob)=>!!cur&&cur.x*W>=b.x0-24&&cur.x*W<=b.x1+24&&cur.y*H>=b.y0-24&&cur.y*H<=b.y1+24&&b.x1-b.x0<=56&&b.y1-b.y0<=56;
  const rest=blobs.filter(b=>!near(b)),activity=rest.reduce((a,b)=>a+b.cells,0);
  frames.push({t,activity,change:rest.sort((a,b)=>b.cells-a.cells)[0]??null});prev=g;});
 const found:ScreenPlan['found']=log?.cursor?'log':cursor.length?'picture':'none';
 if(found==='none')notes.push('No cursor was found in the picture; give the recorder\'s log (--log) for the highlight and the clicks. The waiting is trimmed anyway.');
 // Clicks: the cursor rests, then the screen changes around it within 0.8 s (or the log says so).
 const clicks:(Point&{why:string})[]=log?.clicks?log.clicks.map(c=>({...frac(c),why:'from the recorder\'s log'})):[];
 if(!log?.clicks&&cursor.length)for(const f of frames){if(!f.change||f.change.cells<6)continue;
  const at=nearest(cursor,f.t-.1);if(!at)continue;const cx=at.x*W,cy=at.y*H,b=f.change;
  const by=Math.hypot(Math.max(b.x0-cx,0,cx-b.x1),Math.max(b.y0-cy,0,cy-b.y1))<W*.12;
  const still=cursor.filter(c=>c.t>=f.t-.6&&c.t<=f.t).every(c=>Math.hypot((c.x-at.x)*W,(c.y-at.y)*H)<6);
  if(by&&still&&!clicks.some(c=>Math.abs(c.t-f.t)<.8))clicks.push({t:+Math.max(0,f.t-.15).toFixed(3),x:at.x,y:at.y,why:'the cursor rested and the screen changed next to it'});}
 // Zooms: in where each click acts, sized to what changed, out before the next.
 const maxZoom=o.maxZoom??1.8,zooms:Zoom[]=[];
 for(const [k,c] of clicks.entries()){
  const f=frames.find(x=>x.t>=c.t&&x.t<=c.t+1&&x.change&&x.change.cells>=6),b=f?.change;
  const cx=b?((b.x0+b.x1)/2/W+c.x)/2:c.x,cy=b?((b.y0+b.y1)/2/H+c.y)/2:c.y,span=b?Math.max((b.x1-b.x0)/W,(b.y1-b.y0)/H,.15):.3;
  const start=Math.max(0,c.t-.35),end=Math.min(seconds,c.t+3,clicks[k+1]?clicks[k+1]!.t-.45:Infinity);if(end-start<.9)continue;
  zooms.push({start:+start.toFixed(3),end:+end.toFixed(3),x:+cx.toFixed(4),y:+cy.toFixed(4),scale:+Math.min(maxZoom,Math.max(1.3,.7/span)).toFixed(2)});}
 // Waiting: nothing changes but the cursor resting, for longer than `wait` seconds (0.3 s kept each side).
 const waitMin=o.wait??1.5,waits:{start:number;end:number}[]=[],cmoved=(t:number)=>{const a=(log?.cursor?along:nearest)(cursor,t-1/fps),b=(log?.cursor?along:nearest)(cursor,t);return !!a&&!!b&&Math.hypot((a.x-b.x)*W,(a.y-b.y)*H)>2;};
 let from:number|null=null;
 for(const f of [...frames,{t:seconds,activity:1e9,change:null}]){const idle=f.activity<3&&!cmoved(f.t)&&!clicks.some(c=>Math.abs(c.t-f.t)<.5);
  if(idle&&from===null)from=f.t;else if(!idle&&from!==null){if(f.t-from>=waitMin)waits.push({start:+(from+.3).toFixed(3),end:+(f.t-.3).toFixed(3)});from=null;}}
 // A zoom keeps its waiting: the viewer is reading what the click opened. The rest of a wait goes.
 let kept=waits;for(const z of zooms)kept=kept.flatMap(w=>w.end<=z.start||w.start>=z.end?[w]:[{start:w.start,end:z.start},{start:z.end,end:w.end}]);
 kept=kept.filter(w=>w.end-w.start>=.6).map(w=>({start:+w.start.toFixed(3),end:+w.end.toFixed(3)}));
 return {file,seconds:+seconds.toFixed(2),width,height,cursor,clicks,zooms,waits:kept,found,notes};
}
/** Where a logged cursor is at a time, between its logged points. */
function along(points:Point[],t:number){const k=points.findIndex(p=>p.t>t);if(k<=0)return k===0?points[0]!:points.at(-1)??null;
 const a=points[k-1]!,b=points[k]!,u=(t-a.t)/(b.t-a.t||1);return {t,x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u};}
function nearest(points:Point[],t:number){let best:Point|null=null;for(const p of points){if(p.t>t+1e-6)break;best=p;}return best??points[0]??null;}

/** The edit list for a plan: the highlight and click rings, the zooms, then the waiting cut out. */
export function screenOps(plan:ScreenPlan,o:{highlight?:boolean;zooms?:boolean;trim?:boolean}={}):Operation[]{
 const ops:Operation[]=[];
 if(o.highlight!==false&&plan.cursor.length)ops.push({op:'cursor',path:plan.cursor.slice(0,20000),clicks:plan.clicks.map(c=>c.t),size:.045,color:'#FFD400',opacity:.38});
 if(o.zooms!==false&&plan.zooms.length)ops.push({op:'zooms',items:plan.zooms.slice(0,60),ramp:.4});
 if(o.trim!==false&&plan.waits.length)ops.push({op:'cut',ranges:plan.waits.map(w=>({start:w.start,end:w.end}))});
 return ops;
}
