// The art director's pass over a video before its preview: every visual the designer made is
// measured (renderer/art-director.ts), and a weak one is fixed the way a designer would:
//   1. first its layout, keeping the composition: moved to sit centred when its weight is off to
//      one side, scaled down when crowded, scaled up when sparse;
//   2. then the same composition drawn again (another arrangement and colouring of it), which keeps
//      exactly what it shows;
//   3. then, if it is still weak, another composition from the designer for the same sentence,
//      avoiding the compositions around it, and only one that shows the sentence nearly as well
//      (never neatness for meaning).
// A change is kept only when it measures better and the quality checks find no new problem in it. Visuals the agent or the user wrote are never
// touched. A replaced composition counts a little against itself in the brain (pd-<name>).
import type {Project} from './schema.js';
import type {Piece} from './scene-pieces-schema.js';
import {judgeScenes,WEAK,type SceneDesign} from '../renderer/art-director.js';
import {openRenderer} from '../renderer/browser-renderer.js';
import {redesignLine} from './storyboard.js';

export type ArtDirection={rounds:number;before:number;after:number;
 changes:{scene:number;how:'layout'|'variant'|'composition';from:string;to:string;scoreBefore:number;scoreAfter:number;fixed:string[]}[];
 kept:{scene:number;archetype:string;score:number;issues:string[]}[]};
const mean=(d:SceneDesign[])=>d.length?Math.round(d.reduce((a,x)=>a+x.score,0)/d.length):100;
/** A new composition must show the sentence at least this well, relative to the one it replaces. */
const KEEP_MEANING=.75;
const LAYOUT=new Set(['off-balance','crowded','sparse']);

async function judge(p:Project){const r=await openRenderer(p,.5);try{return await judgeScenes(r.page,p);}finally{await r.close();}}

type L=Record<string,unknown>&{x?:number;y?:number;w?:number;h?:number;size?:number};
/** The same visual, moved and scaled inside its box (positions are 0..1 of the box). Limits come
 *  from where it is actually drawn (measured), not from its layers' boxes. */
export function relayout(piece:Piece,d:SceneDesign,rtl:boolean):Piece|undefined{
 const layers=piece.layers as unknown as L[];
 const [x0,y0,x1,y1]=d.stats.bounds,kinds=new Set(d.issues.map(i=>i.kind));
 let k=1;if(kinds.has('crowded'))k=.86;else if(kinds.has('sparse'))k=Math.min(1.25,.94/Math.max(x1-x0,y1-y0,.01));
 // Centre the visual's weight, as seen.
 let vx=kinds.has('off-balance')?-d.stats.cx*.9:0,vy=kinds.has('off-balance')?-d.stats.cy*.9:0;
 // A container that already spans its box (a card, a panel) stays centred along that direction.
 if(x1-x0>.8)vx=0;if(y1-y0>.8)vy=0;
 // Keep it inside its box after scaling about the centre and moving.
 const sx0=.5+(x0-.5)*k,sx1=.5+(x1-.5)*k,sy0=.5+(y0-.5)*k,sy1=.5+(y1-.5)*k;
 vx=Math.max(.02-sx0,Math.min(.98-sx1,vx));vy=Math.max(.02-sy0,Math.min(.98-sy1,vy));
 if(k===1&&Math.abs(vx)<.01&&Math.abs(vy)<.01)return undefined;
 // Layers are placed from the start side: a right-to-left visual is drawn mirrored.
 let dx=rtl?-vx:vx,dy=vy;const r3=(n:number)=>Number(n.toFixed(3));
 // Text boxes (often wider than their words) must stay inside the box too.
 for(const l of layers)if((l.type==='text'||l.type==='number')&&typeof l.x==='number'){
  const w=l.w??.9,h=l.h??.12,lx0=.5+(l.x-.5)*k,lx1=lx0+w*k,ly0=.5+((l.y??0)-.5)*k,ly1=ly0+h*k;
  dx=Math.max(-lx0,Math.min(1-lx1,dx));dy=Math.max(-ly0,Math.min(1-ly1,dy));}
 if(k===1&&Math.abs(dx)<.01&&Math.abs(dy)<.01)return undefined;
 return {...piece,layers:layers.map(l=>({...l,
  ...(typeof l.x==='number'?{x:r3(.5+(l.x-.5)*k+dx)}:{}),...(typeof l.y==='number'?{y:r3(.5+(l.y-.5)*k+dy)}:{}),
  ...(typeof l.w==='number'?{w:r3(l.w*k)}:{}),...(typeof l.h==='number'?{h:r3(l.h*k)}:{}),...(typeof l.size==='number'&&k!==1?{size:r3(l.size*k)}:{})})) as unknown as Piece['layers']};
}

/** Changes `p` in place (only scenes whose visual the designer made) and reports what it did. */
export async function artDirect(p:Project,o:{seed:string;learned?:Record<string,number>;rounds?:number;perRound?:number;evidence?:string}):Promise<ArtDirection>{
 const lines=p.scenes.map(s=>s.text),genome=p.config.pieces?.genome;
 const arch=(i:number)=>p.scenes[i]?.piece?.designed?.archetype;
 let judged=await judge(p);const before=mean(judged),tried=new Map<number,Set<string>>(),relaid=new Set<number>(),varied=new Set<number>(),changes:ArtDirection['changes']=[];let rounds=0;
 for(let round=1;round<=(o.rounds??3);round++){
  const weak=judged.filter(d=>d.score<WEAK).sort((a,b)=>a.score-b.score).slice(0,o.perRound??3);
  if(!weak.length)break;
  const old=new Map<number,{piece:Piece;design:SceneDesign;how:'layout'|'variant'|'composition'}>();
  for(const d of weak){const s=p.scenes[d.index]!,cur=s.piece!;
   // 1. The layout, when that is all that is wrong (once per scene).
   if(!relaid.has(d.index)&&d.issues.every(i=>LAYOUT.has(i.kind)||i.kind==='busy'||i.kind==='static')){relaid.add(d.index);
    const rtl=(cur.direction==='auto'?s.direction:cur.direction)==='rtl',moved=relayout(cur,d,rtl);
    if(moved){old.set(d.index,{piece:cur,design:d,how:'layout'});s.piece=moved;continue;}}
   const others=p.scenes.map((_,k)=>k).filter(k=>k!==d.index&&k!==d.index-1).map(arch).filter((x):x is string=>!!x);
   const prev=arch(d.index-1),next=arch(d.index+1);
   // 2. The same composition drawn again (once per scene).
   if(!varied.has(d.index)){varied.add(d.index);
    const v=redesignLine(lines,d.index,{seed:o.seed+'#variant'+round,genome,learned:o.learned,current:d.archetype,around:[],exclude:[],only:d.archetype});
    if(v.piece.designed?.archetype===d.archetype){old.set(d.index,{piece:cur,design:d,how:'variant'});s.piece={...cur,layers:v.piece.layers,designed:v.piece.designed} as Piece;continue;}}
   // 3. Another composition that shows the sentence nearly as well.
   const t=tried.get(d.index)??new Set([d.archetype]);tried.set(d.index,t);
   const pl=redesignLine(lines,d.index,{seed:o.seed+'#'+round,genome,learned:o.learned,current:d.archetype,around:[...others,...(prev?[prev]:[])],exclude:[...t,...(next?[next]:[])]});
   const to=pl.piece.designed!.archetype;if(t.has(to))continue;t.add(to);
   if(pl.fit<pl.currentFit*KEEP_MEANING)continue;
   old.set(d.index,{piece:cur,design:d,how:'composition'});
   // Only the visual's layers change: its transition, placement, size and timing stay.
   s.piece={...cur,layers:pl.piece.layers,designed:pl.piece.designed} as Piece;}
  if(!old.size)break;rounds=round;
  const after=await judge(p);let kept=0;
  for(const [i,{piece,design,how}] of old){const n=after.find(x=>x.index===i);
   // Better by design, and never less readable (the quality checks find no new hard problem).
   if(n&&n.score>design.score&&n.stats.qualityHard<=design.stats.qualityHard){kept++;changes.push({scene:i,how,from:design.archetype,to:n.archetype,scoreBefore:design.score,scoreAfter:n.score,fixed:design.issues.filter(x=>!n.issues.some(y=>y.kind===x.kind)).map(x=>x.kind)});
    if(how==='composition'&&o.evidence)try{(await import('./brain/brain.js')).nudge(['pd-'+design.archetype],false,`${o.evidence}:scene${i}:${design.issues.map(x=>x.kind).join('+')}`);}catch{/* the brain learns next time */}}
   else p.scenes[i]!.piece=piece;}
  judged=kept?await judge(p):judged;
 }
 return {rounds,before,after:mean(judged),changes,
  kept:judged.filter(d=>d.issues.length).map(d=>({scene:d.index,archetype:d.archetype,score:d.score,issues:d.issues.map(x=>`${x.kind}: ${x.detail}`)}))};
}
