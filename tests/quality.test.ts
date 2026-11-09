import {it,expect} from 'vitest';
import fs from 'node:fs/promises';
import {sceneScore,summarize,checkFrame,spread} from '../src/renderer/visual-qa.js';
import {create,save} from '../src/engine/project.js';
import {planProject} from '../src/engine/timeline-builder.js';
import {openRenderer} from '../src/renderer/browser-renderer.js';
import {pieceSchema} from '../src/engine/scene-pieces-schema.js';
import {runHarness,markdown} from '../src/engine/quality-harness.js';
import {contrast,on,readableOn} from '../src/components/pieces/kit.js';

it('scores scenes and decides pass or fail',()=>{
 expect(sceneScore([])).toBe(100);
 const bad=sceneScore([{kind:'contrast',detail:'',severity:'hard'},{kind:'cut-off',detail:'',severity:'hard'}]);expect(bad).toBeLessThan(60);
 expect(sceneScore([{kind:'empty',detail:'',severity:'hard'}])).toBeLessThanOrEqual(10);
 const q=summarize([{scene:'a',time:1,score:100,issues:[],stats:{minTextPx:30,minContrast:9,overlap:0,spread:30}},{scene:'b',time:2,score:80,issues:[{kind:'small-text',detail:'',severity:'soft'}],stats:{minTextPx:15,minContrast:9,overlap:0,spread:30}}]);
 expect(q).toMatchObject({score:90,passed:true,hard:0,soft:1});
 expect(summarize([{scene:'a',time:1,score:90,issues:[{kind:'contrast',detail:'',severity:'hard'}],stats:{minTextPx:30,minContrast:2,overlap:0,spread:30}}]).passed).toBe(false);
});

it('picks readable text colours',()=>{
 expect(on('#F97316')).toBe('#111827'); // dark text on orange, not white
 expect(on('#4F46E5')).toBe('#ffffff');
 expect(contrast(readableOn('#F97316','#FFFFFF',4.5),'#FFFFFF')).toBeGreaterThanOrEqual(4.5);
 expect(contrast(readableOn('#334155','#0B0F17',7),'#0B0F17')).toBeGreaterThanOrEqual(7);
});

it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('finds unreadable, cut-off, covered and empty frames',async()=>{
 const p=await create('qa-checks','Readable headline here\nSecond scene',{width:540,height:960,fps:12,fontSize:40,minFontSize:20});
 p.scenes=planProject(p);p.scenes[0]!.piece=pieceSchema.parse({kind:'checklist',items:['One','Two']});
 await save(p);const r=await openRenderer(p);
 try{
  await r.page.evaluate(t=>window.render(t),p.scenes[0]!.start+p.scenes[0]!.duration*.85);
  const ok=await checkFrame(r.page);expect(ok.issues.filter(i=>i.severity==='hard')).toEqual([]);expect(ok.stats.minContrast).toBeGreaterThan(4.5);
  // Break the frame on purpose: pale text, text pushed out of the frame, text under a box.
  await r.page.evaluate(()=>{const s=document.getElementById('stage')!;
   const pale=document.createElement('div');pale.textContent='pale words';pale.style.cssText='position:absolute;left:40px;top:40px;color:#f2f2f2;font-size:30px;z-index:50';s.append(pale);
   const out=document.createElement('div');out.textContent='outside';out.style.cssText='position:absolute;left:500px;top:300px;color:#111;font-size:40px;white-space:nowrap;z-index:50';s.append(out);
   const under=document.createElement('div');under.textContent='hidden text';under.style.cssText='position:absolute;left:40px;top:700px;color:#111;font-size:30px;z-index:50';s.append(under);
   const cover=document.createElement('div');cover.style.cssText='position:absolute;left:20px;top:690px;width:300px;height:70px;background:#222;z-index:60';s.append(cover);});
  const bad=await checkFrame(r.page);const kinds=bad.issues.map(i=>i.kind+':'+i.detail);
  expect(kinds.some(k=>k.startsWith('contrast')&&k.includes('pale words'))).toBe(true);
  expect(kinds.some(k=>k.startsWith('cut-off')&&k.includes('outside'))).toBe(true);
  expect(kinds.some(k=>k.startsWith('cut-off')&&k.includes('hidden text')&&k.includes('covered'))).toBe(true);
  await r.page.evaluate(()=>{const s=document.getElementById('stage')!;const blank=document.createElement('div');blank.style.cssText='position:absolute;inset:0;background:#fafafa;z-index:99';s.append(blank);});
  expect(await spread(r.page,await r.page.screenshot())).toBeLessThan(3.5);
 }finally{await r.close();}
},120000);

it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('runs the harness, saves a report and compares runs',async()=>{
 const script='examples/quality/saas.txt';
 const a=await runHarness({styles:1,seed:'test-a',scripts:[script]});const b=await runHarness({styles:1,seed:'test-a',scripts:[script]});
 expect(a.report.rows).toHaveLength(1);expect(a.report.rows[0]!.score).toBeGreaterThan(60);expect(a.report.rows[0]!.sound.bedLufs).not.toBeNull();
 expect(b.report.previous?.delta).toBe(0);expect(markdown(b.report)).toContain('| saas |');
 for(const d of [a.dir,b.dir]){expect((await fs.stat(d+'/report.md')).isFile()).toBe(true);await fs.rm(d,{recursive:true,force:true});}
},300000);
