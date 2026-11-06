import {it,expect} from 'vitest';
import {defaults} from '../engine/config.js';
import {configSchema} from '../engine/schema.js';
import {parseAnswers} from '../engine/conversation.js';
import {plan} from '../engine/scene-planner.js';
import {create,save} from '../engine/project.js';
import {openRenderer} from '../renderer/browser-renderer.js';

it('preserves classic rendering when loading legacy configurations',async()=>{
 const current=await defaults();const {textTreatment,...legacy}=current;
 expect(configSchema.parse(legacy).textTreatment).toBe('classic');
 expect(current.textTreatment).toBe('kinetic');
 expect(current.background).toBe('white-grid');
 expect(parseAnswers('2 Plain White').preferences.visual).toBe('white');
});
it('plans text-first scenes without automatic cards or icons',async()=>{
 const c=await defaults({visuals:false,useReferences:false});
 const scenes=plan('Hello world\n\nA useful feature\n\nOne more scene',c);
 expect(scenes.every(s=>s.layout==='center'&&!s.asset)).toBe(true);
 expect(new Set(scenes.map(s=>s.animation)).size).toBeGreaterThan(1);
});
it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('renders complete Sorani words with emphasis and deterministic seeking',async()=>{
 const script='\u06a9\u0695\u06cc\u0627\u0631\u06d5\u06a9\u06d5\u062a \u0645\u062a\u0645\u0627\u0646\u06d5! TikTok 2026';
 const p=await create('kinetic-browser-validation',script,{width:360,height:640,fontSize:28,minFontSize:16,textTreatment:'kinetic',background:'solid',visuals:false,progress:false,useReferences:false});
 p.scenes=plan(script,p.config);p.scenes[0].duration=3;p.scenes[0].highlights=[{start:script.indexOf(' ')+1,end:script.indexOf('!')}];await save(p);
 const r=await openRenderer(p);
 try{
  const result=await r.page.evaluate(()=>{
   const text=document.querySelector('[data-kinetic]')!.firstElementChild as HTMLElement;
   const spans=[...text.querySelectorAll('[data-word]')];
   const a=spans[0].getBoundingClientRect(),b=spans[1].getBoundingClientRect();
   const emphasis=text.querySelector('[data-emphasis="true"]') as HTMLElement;
   return {rtlOrder:Math.max(a.top,b.top)<Math.min(a.bottom,b.bottom)&&a.x>b.x,text:text.textContent,color:getComputedStyle(emphasis).color,large:parseFloat(getComputedStyle(emphasis).fontSize)>parseFloat(getComputedStyle(text).fontSize),images:document.images.length,shadow:getComputedStyle(text).boxShadow,bg:getComputedStyle(document.getElementById('background')!).backgroundImage};
  });
  expect(result).toMatchObject({rtlOrder:true,text:script,color:'rgb(31, 94, 255)',large:true,images:0,shadow:'none',bg:'none'});
  await r.page.evaluate(()=>window.render(1.2));const a=await r.page.screenshot();
  await r.page.evaluate(()=>window.render(.1));await r.page.evaluate(()=>window.render(1.2));expect(await r.page.screenshot()).toEqual(a);
 }finally{await r.close();}
 p.scenes[0].animation='center-word-swap';
 const centered=await openRenderer(p);
 try{
  await centered.page.evaluate(()=>window.render(1.3));
  expect(await centered.page.locator('[data-word]').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).opacity==='1').length)).toBe(1);
  const a=await centered.page.screenshot();await centered.page.evaluate(()=>window.render(.1));await centered.page.evaluate(()=>window.render(1.3));expect(await centered.page.screenshot()).toEqual(a);
 }finally{await centered.close();}
},30000);
