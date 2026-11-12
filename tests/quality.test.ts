import {it,expect} from 'vitest';
import fs from 'node:fs/promises';
import {sceneScore,summarize,checkFrame,spread} from '../src/renderer/visual-qa.js';
import {create,save} from '../src/engine/project.js';
import {planProject} from '../src/engine/timeline-builder.js';
import {openRenderer} from '../src/renderer/browser-renderer.js';
import {pieceSchema} from '../src/engine/scene-pieces-schema.js';
import {runHarness,markdown} from '../src/engine/quality-harness.js';
import {contrast,on,readableOn} from '../src/components/pieces/kit.js';
import {judgeScenes} from '../src/renderer/art-director.js';
import {artDirect} from '../src/engine/art-direction.js';
import {research,brief,checkScript,type Research} from '../src/engine/script-writer.js';
import http from 'node:http';
import path from 'node:path';

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
 p.scenes=planProject(p);p.scenes[0]!.piece=pieceSchema.parse({kind:'compose',layers:[{type:'card',x:.05,y:.1,w:.9,h:.6},{type:'text',text:'One and two',x:.1,y:.3,w:.8,h:.12,size:6}]});
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
 const script='tests/fixtures/quality/saas.txt';
 const a=await runHarness({styles:1,seed:'test-a',scripts:[script]});const b=await runHarness({styles:1,seed:'test-a',scripts:[script]});
 expect(a.report.rows).toHaveLength(1);expect(a.report.rows[0]!.score).toBeGreaterThan(60);expect(a.report.rows[0]!.sound.bedLufs).not.toBeNull();
 expect(b.report.previous?.delta).toBe(0);expect(markdown(b.report)).toContain('| saas |');
 for(const d of [a.dir,b.dir]){expect((await fs.stat(d+'/report.md')).isFile()).toBe(true);await fs.rm(d,{recursive:true,force:true});}
},300000);

it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('the art director finds weak visuals and fixes their layout, never the agent\'s own',async()=>{
 const lines=['A well placed card','A tiny lonely mark','Everything packed in','Pushed to one side','Words over the icon','Words over the icon again','Written by hand on one side'];
 const p=await create('art-director',lines.join('\n'),{width:540,height:960,fps:12,fontSize:40,minFontSize:20});p.scenes=planProject(p);
 const designed={archetype:'statement',description:'test'};
 const pieces=[
  [{type:'card',x:.1,y:.15,w:.8,h:.6},{type:'text',text:'Well placed',x:.2,y:.38,w:.6,h:.12,size:6,align:'center'}],
  [{type:'icon',icon:'bolt',x:.47,y:.47,w:.05,color:'primary'}],
  [{type:'shape',shape:'rect',x:0,y:0,w:1,h:1,fill:'primary'},{type:'text',text:'Packed',x:.1,y:.4,w:.8,h:.12,size:6,color:'white'}],
  [{type:'icon',icon:'bolt',x:.03,y:.3,w:.16,fill:'accent',color:'white'},{type:'text',text:'Side',x:.03,y:.55,w:.25,h:.08,size:4}],
  [{type:'icon',icon:'bolt',x:.35,y:.3,w:.3,fill:'accent',color:'white'},{type:'text',text:'Over the icon',x:.3,y:.38,w:.4,h:.08,size:4.4}],
  [{type:'icon',icon:'bolt',x:.35,y:.3,w:.3,fill:'accent',color:'white'},{type:'text',text:'Over the icon',x:.3,y:.38,w:.4,h:.08,size:4.4}],
  [{type:'icon',icon:'bolt',x:.03,y:.3,w:.16,fill:'accent',color:'white'},{type:'text',text:'Side',x:.03,y:.55,w:.25,h:.08,size:4}],
 ];
 pieces.forEach((layers,i)=>{p.scenes[i]!.piece=pieceSchema.parse({kind:'compose',layers,...(i<6?{designed}:{})});});
 await save(p);
 const r=await openRenderer(p,.5);let j;try{j=await judgeScenes(r.page,p);}finally{await r.close();}
 const kinds=(i:number)=>j.find(d=>d.index===i)?.issues.map(x=>x.kind)??[];
 expect(kinds(0)).toEqual([]);
 expect(kinds(1)).toContain('sparse');
 expect(kinds(2)).toContain('crowded');
 expect(kinds(3)).toContain('off-balance');
 expect(kinds(4)).toContain('collision');
 expect(kinds(5)).toContain('same');
 expect(j.some(d=>d.index===6)).toBe(false); // the agent's own visual is not judged
 const own=structuredClone(p.scenes[6]!.piece);
 const a=await artDirect(p,{seed:'test',rounds:2,perRound:6});
 const moved=a.changes.find(c=>c.scene===3);
 expect(moved?.how).toBe('layout');expect(moved!.scoreAfter).toBeGreaterThan(moved!.scoreBefore);
 expect(p.scenes[3]!.piece!.designed?.archetype).toBe('statement'); // same composition, moved
 const unjammed=a.changes.find(c=>c.scene===4);
 expect(['variant','composition']).toContain(unjammed?.how);expect(unjammed!.fixed).toContain('collision');
 expect(p.scenes[6]!.piece).toEqual(own);
},300000);

it('plans a script and checks it: length, hook, call to action, nothing invented',()=>{
 const r:Research={kind:'url',input:'https://example.com',url:'https://example.com/',title:'Ledgerly',language:'en',notes:[],facts:[
  {id:'name1',kind:'name',text:'Ledgerly',source:'Ledgerly'},
  {id:'n1',kind:'number',text:'Teams using Ledgerly save 6 hours a month on bookkeeping.',source:'Teams using Ledgerly save 6 hours a month on bookkeeping.'},
  {id:'p1',kind:'price',text:'Plans start at $12 per month, with a free 14-day trial.',source:'Plans start at $12 per month, with a free 14-day trial.'},
  {id:'q1',kind:'quote',text:'We finally stopped guessing about cash flow.',source:'We finally stopped guessing about cash flow. — Sara'}]};
 const b=brief(r,{seconds:30});
 expect(b.beats[0]!.beat).toBe('hook');expect(b.beats.at(-1)!.beat).toBe('cta');expect(b.beats.some(x=>x.beat==='proof')).toBe(true);
 const good=['Do you know where your money is right now?','Cash, bills and payroll hide in different places.','Meet Ledgerly, calm money management for small teams.',
  'It turns scattered accounts into one quiet dashboard.','Teams using Ledgerly save 6 hours a month.','Start your free 14-day trial today.'].join('\n');
 const ok=checkScript(good,b);expect(ok.issues.filter(i=>i.severity==='hard')).toEqual([]);expect(ok.passed).toBe(true);
 expect(ok.seconds.silent).toBeLessThan(30*1.3);expect(ok.lines.at(-1)!.visual).toBe('action');expect(ok.lines[1]!.visual).not.toBe('statement');
 const bad=checkScript(['Hi everyone, welcome to the channel.','Ledgerly is the best finance app.','It saves teams 20 hours every week.','"Ledgerly changed my life."','Thanks for watching.'].join('\n'),b);
 const d=bad.issues.filter(i=>i.severity==='hard').map(i=>i.detail).join(' | ');
 expect(bad.passed).toBe(false);
 for(const k of ['greets','call to action','superlative','"20"','quotation'])expect(d).toContain(k);
 // A topic has no facts: any figure is flagged.
 const t=checkScript('Shops lose customers every day.\nMost shops lose 40% of buyers.\nTry it today.',brief({kind:'topic',input:'shops',title:'shops',language:'en',facts:[],notes:[]}));
 expect(t.issues.some(i=>i.detail.includes('"40%"'))).toBe(true);
});

it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('reads a product page and a Kurdish page into facts, without menus or footers',async()=>{
 const dir=path.resolve('tests/fixtures/write');
 const server=http.createServer(async(req,res)=>{try{res.setHeader('content-type','text/html; charset=utf-8');res.end(await fs.readFile(path.join(dir,path.basename(req.url??''))));}catch{res.statusCode=404;res.end();}});
 await new Promise<void>(ok=>server.listen(0,'127.0.0.1',ok));const port=(server.address() as {port:number}).port;
 const prev=process.env.TEMPOLOOM_REACH_ALLOW_LOCAL;process.env.TEMPOLOOM_REACH_ALLOW_LOCAL='1';
 try{
  const r=await research(`http://127.0.0.1:${port}/product.html`);
  const of=(k:string)=>r.facts.filter(f=>f.kind===k);
  expect(r.language).toBe('en');expect(of('name')[0]?.text).toBe('Ledgerly');
  expect(of('quote').map(f=>f.text)).toEqual(['We finally stopped guessing about cash flow.']);expect(of('quote')[0]!.source).toContain('Sara');
  expect(of('price').some(f=>f.text.includes('$12'))).toBe(true);
  expect(of('number').some(f=>f.text.includes('6 hours'))).toBe(true);
  expect(r.facts.some(f=>f.text.includes('scanned from a photo'))).toBe(true); // added by the page's own script
  expect(r.facts.some(f=>/cookie|Log in|All rights|Why teams switch/i.test(f.text))).toBe(false);
  expect(new Set(r.facts.map(f=>f.id)).size).toBe(r.facts.length);
  const k=await research(`http://127.0.0.1:${port}/kurdish.html`);
  expect(k.language).toBe('ckb');expect(k.facts.filter(f=>f.kind==='feature')).toHaveLength(3);
  expect(k.facts.some(f=>f.kind==='number'&&f.text.includes('٥'))).toBe(true);expect(k.facts.some(f=>f.kind==='price')).toBe(true);
 }finally{if(prev===undefined)delete process.env.TEMPOLOOM_REACH_ALLOW_LOCAL;else process.env.TEMPOLOOM_REACH_ALLOW_LOCAL=prev;server.close();}
},120000);
