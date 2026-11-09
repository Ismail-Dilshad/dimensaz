import {it,expect} from 'vitest';
import {pieceSchema,sceneVisualSchema,sceneIndexFor} from '../src/engine/scene-pieces-schema.js';
import {designScenes} from '../src/engine/storyboard.js';
import {requestSchema} from '../src/engine/production.js';
import {create,save} from '../src/engine/project.js';
import {planProject} from '../src/engine/timeline-builder.js';
import {openRenderer} from '../src/renderer/browser-renderer.js';

const layer={type:'text',text:'Hello',in:{from:'type'}};

it('only accepts visuals composed from layers',()=>{
 const p=pieceSchema.parse({kind:'compose',layers:[layer]});expect(p).toMatchObject({placement:'center',size:.56,transition:'wipe',delay:.15});
 expect(pieceSchema.safeParse({kind:'compose',layers:[]}).success).toBe(false);
 expect(pieceSchema.safeParse({kind:'compose',layers:[layer],colour:'red'}).success).toBe(false);
 // Ready-made pieces, devices, saved templates and named styles are gone.
 for(const old of [{kind:'counter',to:5},{kind:'phone',screen:{kind:'compose',layers:[layer]}},{kind:'compose',template:'stat-hero'},{kind:'compose',layers:[layer],style:'neon'},{kind:'compose',layers:[layer],layout:'grid'}])
  expect(pieceSchema.safeParse(old).success,JSON.stringify(old)).toBe(false);
});

it('attaches visuals to scenes by index or by words of the sentence',()=>{
 const scenes=[{text:'Your team drowns in tasks.\n'},{text:'Flowly assigns them automatically.'}];
 expect(sceneIndexFor({match:'ASSIGNS them'},scenes)).toBe(1);
 expect(sceneIndexFor({scene:0},scenes)).toBe(0);
 expect(()=>sceneIndexFor({match:'nothing here'},scenes)).toThrow(/no scene contains.*0: Your team/);
 expect(()=>sceneIndexFor({scene:5},scenes)).toThrow(/has 2 scenes/);
 const piece={kind:'compose',layers:[layer]};
 expect(sceneVisualSchema.safeParse({piece}).success).toBe(false);
 expect(sceneVisualSchema.safeParse({scene:0,match:'x x',piece}).success).toBe(false);
 const req=requestSchema.parse({schemaVersion:1,title:'t',script:'a\nb',preset:'kinetic',sceneVisuals:[{match:'a b',piece}],pieceTheme:{accent:'#FF6B4A'},look:'calm paper'});
 expect(req.sceneVisuals[0]!.piece.kind).toBe('compose');expect(req.scenePieces).toBe('auto');
 expect(requestSchema.safeParse({schemaVersion:1,title:'t',script:'a',pieceStyle:'neon'}).success).toBe(false); // no named looks
});

const LINES=['Your team is drowning in messages, tasks and deadlines.','Meet Flowly, the workspace that keeps everything in one place.','Revenue grew 40% in three months.',
 'Solar panels turn sunlight into power.','No more spreadsheets, lost emails or missed deadlines.','Deliver to Erbil, Duhok and Sulaimani.','"It saved our launch," says Maya.','Start your free trial today.'];

it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('renders designed visuals, moves over time and repeats frames exactly',async()=>{
 const p=await create('pieces-integration',LINES.join('\n'),{width:360,height:640,fps:12,fontSize:40,minFontSize:18});
 p.scenes=planProject(p);for(const pl of designScenes(p.scenes.map(s=>s.text),{seed:'render'}))p.scenes[pl.index]!.piece=pl.piece;
 p.config.pieces={primary:'#0B3B3C',accent:'#FF6B4A',surface:'#FFFFFF',background:'#FFF1D6',text:'#0B3B3C',muted:'#6B7280',radius:18};
 await save(p);const r=await openRenderer(p);
 try{
  for(const s of p.scenes){
   await r.page.evaluate(t=>window.render(t),s.start+.3);const early=await r.page.screenshot();
   await r.page.evaluate(t=>window.render(t),s.start+s.duration*.8);const late=await r.page.screenshot();
   expect(late.equals(early),s.text).toBe(false);
   // The sound cues use the same timing as the animation.
   const lens=await r.page.evaluate(()=>[...document.querySelectorAll<HTMLElement>('[data-dom-length]')].map(e=>[e.dataset.length,e.dataset.domLength]));
   expect(lens.length).toBeGreaterThan(0);for(const [a,b] of lens)expect(a,s.text).toBe(b);
   await r.page.evaluate(t=>window.render(t),s.start+.3);expect((await r.page.screenshot()).equals(early),s.text).toBe(true);
  }
 }finally{await r.close();}
},120000);

it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('mirrors visuals for right-to-left languages and keeps a forced direction',async()=>{
 const p=await create('pieces-rtl','لیستی ئەمڕۆ تەواو بوو.\nئەپەکە بە ئینگلیزی.',{width:360,height:640,fps:12,fontSize:40,minFontSize:18});
 p.scenes=planProject(p);expect(p.scenes.map(s=>s.direction)).toEqual(['rtl','rtl']);
 const at=(text:string,direction='auto')=>pieceSchema.parse({kind:'compose',direction,layers:[{type:'card',x:.05,y:.1,w:.9,h:.8},{type:'text',text,x:.1,y:.4,w:.3,h:.1,size:6}]});
 p.scenes[0]!.piece=at('یەکەم');p.scenes[1]!.piece=at('First','ltr');
 await save(p);const r=await openRenderer(p);
 try{
  const box=(t:string)=>r.page.evaluate(t=>{const el=[...document.querySelectorAll('div')].find(d=>d.textContent===t&&!d.children.length)!;return {x:el.getBoundingClientRect().left,dir:el.closest('[dir="rtl"],[dir="ltr"]')?.getAttribute('dir')};},t);
  await r.page.evaluate(t=>window.render(t),p.scenes[0]!.start+p.scenes[0]!.duration*.8);
  const k=await box('یەکەم');expect(k.dir).toBe('rtl');expect(k.x).toBeGreaterThan(180); // a layer at the start sits on the right
  await r.page.evaluate(t=>window.render(t),p.scenes[1]!.start+p.scenes[1]!.duration*.8);
  const e=await box('First');expect(e.dir).toBe('ltr');expect(e.x).toBeLessThan(180);
 }finally{await r.close();}
},120000);
