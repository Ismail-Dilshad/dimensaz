import {it,expect} from 'vitest';
import {layoutVariants,pickLayout,assignLayouts} from '../src/components/pieces/layouts.js';
import {pieceSchema} from '../src/engine/scene-pieces-schema.js';
import {pieceExamples} from '../src/cli/pieces-cli.js';
import {create,save} from '../src/engine/project.js';
import {planProject} from '../src/engine/timeline-builder.js';
import {openRenderer} from '../src/renderer/browser-renderer.js';
import {checkFrame} from '../src/renderer/visual-qa.js';

it('picks layouts per video, varied and learned',()=>{
 expect(Object.values(layoutVariants).every(v=>v.length>=2)).toBe(true);
 expect(pickLayout('dashboard','g-1')).toBe(pickLayout('dashboard','g-1'));
 const seen=new Set(Array.from({length:30},(_,k)=>pickLayout('dashboard','g-'+k)));expect(seen.size).toBe(3);
 for(let k=0;k<20;k++)expect(pickLayout('checklist','x'+k,{avoid:'rows'})).not.toBe('rows');
 expect(pickLayout('chart','x',{chartType:'line'})).toBeUndefined();expect(pickLayout('map','x')).toBeUndefined();
 const count=(c:number)=>Array.from({length:60},(_,k)=>pickLayout('counter','s'+k,{learned:{'pt-layout-counter-ring':c}})).filter(x=>x==='ring').length;
 expect(count(.97)).toBeGreaterThan(count(.03)+15);
 const pieces=[pieceExamples.dashboard!.piece,pieceExamples.dashboard!.piece,{kind:'browser',screen:pieceExamples.checklist!.piece},pieceExamples.map!.piece].map(x=>pieceSchema.parse(structuredClone(x)));
 const used=assignLayouts(pieces as never,'video-1');
 const l=pieces.map(p=>((p as {screen?:{layout?:string}}).screen??(p as {layout?:string})).layout);
 expect(l[0]).toBeTruthy();expect(l[1]).not.toBe(l[0]);expect(l[2]).toBeTruthy();expect(l[3]).toBeUndefined();
 expect(used.every(u=>u.startsWith('pt-layout-'))).toBe(true);
 const fixed=[pieceSchema.parse({...(pieceExamples.counter!.piece as object),layout:'split'})];assignLayouts(fixed as never,'v');expect((fixed[0] as {layout?:string}).layout).toBe('split'); // a set layout is kept
});

it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('renders every layout with its timing and no hard quality issue',async()=>{
 const list=Object.entries(layoutVariants).flatMap(([k,vs])=>vs.map(v=>[k,v] as const));
 const p=await create('layouts-all',list.map(([k,v])=>k+' '+v).join('\n'),{width:540,height:960,fps:12,fontSize:34,minFontSize:18});
 p.scenes=planProject(p);let t=0;p.scenes.forEach((s,i)=>{s.duration=4;s.start=t;t+=4;const [k,v]=list[i]!;s.piece=pieceSchema.parse({...(pieceExamples[k]!.piece as object),layout:v,transition:'none'});});
 await save(p);const r=await openRenderer(p);
 try{for(const [i,s] of p.scenes.entries()){await r.page.evaluate(x=>window.render(x),s.start+3.6);
  const q=await checkFrame(r.page);expect(q.issues.filter(x=>x.severity==='hard'),list[i]!.join('/')).toEqual([]);
  const L=await r.page.evaluate(()=>[...document.querySelectorAll<HTMLElement>('[data-style]')].filter(e=>e.offsetParent).map(e=>[e.dataset.length,e.dataset.domLength]));
  for(const [a,b] of L)expect(a,list[i]!.join('/')).toBe(b);}}
 finally{await r.close();}
},240000);
