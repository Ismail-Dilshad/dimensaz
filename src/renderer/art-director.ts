// The art director: looks at each designed visual the way a designer would, after the quality
// checks have made sure everything is readable. It measures what those checks do not: how much
// of its box the visual fills (sparse or crowded), whether its weight sits off to one side, text
// running into an icon or a 3D object, a scene that looks like the one before it, and a visual
// that stops moving long before its scene ends. Production redesigns the weak scenes with the
// designer (engine/production.ts) and keeps a new design only when it measures better.
import type {Page} from 'playwright';
import type {Project} from '../engine/schema.js';
import {checkFrame} from './visual-qa.js';

export type DesignIssue={kind:'unreadable'|'sparse'|'crowded'|'off-balance'|'collision'|'busy'|'same'|'static';detail:string};
export type SceneDesign={scene:string;index:number;archetype:string;score:number;issues:DesignIssue[];
 stats:{fill:number;detail:number;balance:number;cx:number;cy:number;
  /** Hard problems the quality checks find in the visual itself (a change may never add one). */
  qualityHard:number;
  /** Where the visual is drawn in its box (left, top, right, bottom; 0..1 as seen). */
  bounds:[number,number,number,number];collisions:number;texts:number;sameness?:number;motion?:number}};

const NAME_SHIM='window.__name=window.__name||(function(f){return f;})';
const PENALTY:Record<DesignIssue['kind'],number>={unreadable:30,sparse:25,crowded:20,'off-balance':15,collision:22,busy:12,same:18,static:10};
/** A scene scores below this and the art director redesigns it: any one real issue (busy text
 *  and a static ending alone are only noted). */
export const WEAK=90;

type Look={fill:number;detail:number;cx:number;cy:number;bounds:[number,number,number,number];thumb:number[]};
/** The visual's own pixels: where the frame with it differs from the same frame without it (so
 *  the style's background, gradient or pattern never counts), how much of its box that is, where
 *  its visual weight sits, and a small grey thumbnail to compare scenes and moments. */
async function look(page:Page,withIt:Buffer,without:Buffer):Promise<Look>{
 return page.evaluate(async ([a64,b64])=>{
  const read=async(b:string,w?:number)=>{const img=new Image();img.src='data:image/png;base64,'+b;await img.decode();
   const W=w??Math.min(160,img.width),H=Math.max(1,Math.round(img.height*W/img.width)),c=document.createElement('canvas');c.width=W;c.height=H;
   const x=c.getContext('2d')!;x.drawImage(img,0,0,W,H);return {w:W,h:H,d:x.getImageData(0,0,W,H).data};};
  const A=await read(a64!),B=await read(b64!,A.w),w=A.w,h=A.h,a=A.d,b=B.d;
  let ink=0,sx=0,sy=0,wsum=0,bx0=1,by0=1,bx1=0,by1=0;const T=16,thumb=new Array(T*T).fill(0),tn=new Array(T*T).fill(0);
  for(let py=0;py<h;py++)for(let px=0;px<w;px++){const i=(py*w+px)*4;
   const dd=Math.abs(a[i]!-b[i]!)+Math.abs(a[i+1]!-b[i+1]!)+Math.abs(a[i+2]!-b[i+2]!);if(dd>36)ink++;
   // Visual weight: area times how strongly it stands out, so a soft card counts as well as its text.
   if(dd>8){const wt=Math.min(dd,150)/150;wsum+=wt;sx+=wt*px/w;sy+=wt*py/h;bx0=Math.min(bx0,px/w);bx1=Math.max(bx1,(px+1)/w);by0=Math.min(by0,py/h);by1=Math.max(by1,(py+1)/h);}
   const k=Math.min(T-1,Math.floor(py/h*T))*T+Math.min(T-1,Math.floor(px/w*T));thumb[k]+=.299*a[i]!+.587*a[i+1]!+.114*a[i+2]!;tn[k]++;}
  // Detail: sharp edges (letters, strokes, outlines) per area; a flat card adds almost none.
  let edges=0;const L=(i:number)=>.299*a[i]!+.587*a[i+1]!+.114*a[i+2]!;
  for(let py=0;py<h-1;py++)for(let px=0;px<w-1;px++){const i=(py*w+px)*4;
   if(Math.abs(a[i]!-b[i]!)+Math.abs(a[i+1]!-b[i+1]!)+Math.abs(a[i+2]!-b[i+2]!)<=8)continue;
   if(Math.abs(L(i)-L(i+4))+Math.abs(L(i)-L(i+w*4))>70)edges++;}
  return {fill:ink/(w*h),detail:edges/(w*h),cx:wsum?sx/wsum-.5:0,cy:wsum?sy/wsum-.5:0,bounds:(wsum?[bx0,by0,bx1,by1]:[0,0,1,1]) as [number,number,number,number],thumb:thumb.map((v,k)=>v/Math.max(1,tn[k]))};
 },[withIt.toString('base64'),without.toString('base64')]);
}
const differ=(a:number[],b:number[])=>a.reduce((s,v,i)=>s+Math.abs(v-b[i]!),0)/a.length;

/** Where the visual is on screen now, its text-on-graphic collisions and how many texts it shows. */
async function layout(page:Page){
 await page.evaluate(NAME_SHIM);
 return page.evaluate(()=>{
  const opacity=(el:Element)=>{let o=1;for(let e:Element|null=el;e;e=e.parentElement){const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden')return 0;o*=Number(cs.opacity);}return o;};
  const wrap=[...document.querySelectorAll<HTMLElement>('[data-style]')].find(p=>opacity(p)>.5&&p.getBoundingClientRect().width>0);
  if(!wrap)return null;document.querySelectorAll('[data-judged]').forEach(e=>e.removeAttribute('data-judged'));wrap.dataset.judged='1';const b=wrap.getBoundingClientRect(),area=b.width*b.height;
  const texts=[...wrap.querySelectorAll<HTMLElement>('*')].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent!.trim().length>0)&&opacity(e)>.9).map(e=>e.getBoundingClientRect()).filter(r=>r.width>1&&r.height>1);
  // Graphics a text can run into: icons and 3D objects (not lines, cards or background shapes).
  const marks=[...wrap.querySelectorAll<Element>('svg,canvas')].filter(e=>opacity(e)>.5).map(e=>e.getBoundingClientRect()).filter(r=>r.width>2&&r.height>2&&r.width*r.height<area*.25);
  let collisions=0;
  for(const t of texts)for(const m of marks){const ov=Math.max(0,Math.min(t.right,m.right)-Math.max(t.left,m.left))*Math.max(0,Math.min(t.bottom,m.bottom)-Math.max(t.top,m.top));
   if(ov>Math.min(t.width*t.height,m.width*m.height)*.2){collisions++;break;}}
  return {box:{x:Math.max(0,b.left),y:Math.max(0,b.top),width:Math.min(innerWidth,b.right)-Math.max(0,b.left),height:Math.min(innerHeight,b.bottom)-Math.max(0,b.top)},texts:texts.length,collisions};
 });
}

/** Judges the designed scenes of a project on a page made by openRenderer (window.render(t)). */
export async function judgeScenes(page:Page,p:Project,only?:number[]):Promise<SceneDesign[]>{
 const out:SceneDesign[]=[];let prev:{index:number;thumb:number[]}|undefined;
 for(const [index,s] of p.scenes.entries()){
  const designed=s.piece?.designed?.archetype;
  if(!designed){prev=undefined;continue;}
  const fps=p.config.fps,settle=s.start+Math.min(s.duration-1/fps,Math.max(s.duration*.82,s.duration-.45));
  await page.evaluate(t=>window.render(t),settle);
  const lay=await layout(page);if(!lay||lay.box.width<4||lay.box.height<4){prev=undefined;continue;}
  const hide=(on:boolean)=>page.evaluate(v=>{const e=document.querySelector<HTMLElement>('[data-judged] > [data-layers]');if(e)e.style.visibility=v?'hidden':'';},on);
  // The quality checks' hard problems that the visual causes: with it, minus without it.
  const hard=async()=>(await checkFrame(page)).issues.filter(x=>x.severity==='hard').length;
  const withHard=await hard();await hide(true);const qualityHard=Math.max(0,withHard-await hard());await hide(false);
  const shot=async()=>{const a=await page.screenshot({clip:lay.box,type:'png'});await hide(true);const b=await page.screenshot({clip:lay.box,type:'png'});await hide(false);return look(page,a,b);};
  const now=await shot(),issues:DesignIssue[]=[];
  const balance=Math.hypot(now.cx,now.cy);
  if(qualityHard)issues.push({kind:'unreadable',detail:`${qualityHard} hard quality problem${qualityHard>1?'s':''} in the visual (text too pale, small or cut off)`});
  if(now.fill<.05)issues.push({kind:'sparse',detail:`the visual fills ${(now.fill*100).toFixed(0)}% of its space`});
  // Crowded: packed with detail (the densest good designs measure about .10), or its box almost
  // completely filled. A large calm card is not crowded.
  if(now.detail>.14||now.fill>.85)issues.push({kind:'crowded',detail:now.fill>.85?`the visual fills ${(now.fill*100).toFixed(0)}% of its space`:`dense detail (${now.detail.toFixed(2)})`});
  if(balance>.25&&now.fill>.02)issues.push({kind:'off-balance',detail:`its weight sits ${Math.round(balance*100)}% off centre`});
  if(lay.collisions)issues.push({kind:'collision',detail:`${lay.collisions} text${lay.collisions>1?'s run':' runs'} into an icon or object`});
  if(lay.texts>7)issues.push({kind:'busy',detail:`${lay.texts} pieces of text`});
  let sameness:number|undefined;
  if(prev&&prev.index===index-1){sameness=differ(now.thumb,prev.thumb);if(sameness<6)issues.push({kind:'same',detail:'looks almost the same as the scene before'});}
  let motion:number|undefined;
  // A visual that stops long before a long scene ends: compare three late moments.
  if(s.duration>=4){const ts=[.55,.75,.95].map(f=>s.start+Math.min(s.duration-1/fps,s.duration*f));const th:number[][]=[];
   for(const t of ts){await page.evaluate(x=>window.render(x),t);th.push((await shot()).thumb);}
   motion=Math.max(differ(th[0]!,th[1]!),differ(th[1]!,th[2]!));if(motion<.15)issues.push({kind:'static',detail:'nothing moves for the second half of the scene'});}
  let score=100;for(const i of issues)score-=PENALTY[i.kind];
  out.push({scene:s.id,index,archetype:designed,score:Math.max(0,score),issues,stats:{fill:Number(now.fill.toFixed(3)),detail:Number(now.detail.toFixed(3)),balance:Number(balance.toFixed(3)),qualityHard,cx:Number(now.cx.toFixed(3)),cy:Number(now.cy.toFixed(3)),bounds:now.bounds.map(v=>Number(v.toFixed(3))) as [number,number,number,number],collisions:lay.collisions,texts:lay.texts,...(sameness!==undefined?{sameness:Number(sameness.toFixed(1))}:{}),...(motion!==undefined?{motion:Number(motion.toFixed(2))}:{})}});
  prev={index,thumb:now.thumb};
 }
 return only?out.filter(d=>only.includes(d.index)):out;
}
