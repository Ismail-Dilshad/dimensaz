import {it,expect} from 'vitest';
import {voiceAlignmentSchema,validateWordAlignment,fromCharacterAlignment,assertVoiceAlignment} from '../src/engine/voice-alignment.js';
import {sceneSchema} from '../src/engine/schema.js';
import {briefSchema} from '../src/engine/conversation.js';
import {create} from '../src/engine/project.js';
import {plan} from '../src/engine/scene-planner.js';
import {words} from '../src/engine/rtl-layout.js';
import {openRenderer} from '../src/renderer/browser-renderer.js';
const metadata={audioSha256:'0'.repeat(64),method:'provider' as const,source:'Unit-test timestamp fixture, not a speech recording',reviewed:true as const};
const fixture={...metadata,words:[{text:'Hello',start:.2,end:.6},{text:'world!',start:1.2,end:1.8}]};
it('requires complete exact reviewed words and valid acoustic time ranges',()=>{
 expect(validateWordAlignment('Hello world!',fixture,2).words).toHaveLength(2);
 expect(()=>validateWordAlignment('Hello world!',{...fixture,words:fixture.words.slice(1)},2)).toThrow(/every/);
 expect(()=>validateWordAlignment('Hello world!',{...fixture,words:[fixture.words[0],{text:'other!',start:1.2,end:1.8}]},2)).toThrow(/differs/);
 expect(()=>validateWordAlignment('Hello world!',{...fixture,words:[fixture.words[0],{text:'world!',start:.5,end:1.8}]},2)).toThrow(/overlapping/);
 expect(()=>validateWordAlignment('Hello world!',fixture,1)).toThrow(/out-of-range/);
 expect(()=>voiceAlignmentSchema.parse({...fixture,reviewed:false})).toThrow();
});
it('rejects partial or offset-mismatched scene speech cues',()=>{
 const base={id:'cue-test',text:'Hello world!',start:0,duration:2,direction:'ltr',role:'hook',animation:'word-slide-up',layout:'center',highlights:[]};
 expect(()=>sceneSchema.parse({...base,wordCues:[{from:0,to:5,start:.2,end:.6}]})).toThrow();
 expect(()=>sceneSchema.parse({...base,wordCues:[{from:0,to:5,start:.2,end:.6},{from:5,to:12,start:1,end:1.8}]})).toThrow();
});
it('converts real-shaped provider arrays without distributing time by character count',()=>{
 const a=fromCharacterAlignment('Hi all',{characters:[...'Hi all'],character_start_times_seconds:[.2,.3,.45,1,1.2,1.3],character_end_times_seconds:[.3,.4,.5,1.1,1.3,1.6]},metadata);
 expect(a.words).toEqual([{text:'Hi',start:.2,end:.4},{text:'all',start:1,end:1.6}]);
 expect(()=>fromCharacterAlignment('Different script',{characters:['X'],character_start_times_seconds:[0],character_end_times_seconds:[1]},metadata)).toThrow(/exact script/);
});
it('blocks an exact-sync render before touching media when reviewed alignment is absent',async()=>{
 await expect(assertVoiceAlignment({config:{voiceTiming:'required'},media:[{kind:'voice'}]} as any)).rejects.toThrow(/reviewed word timestamps are missing/);
 expect(briefSchema.parse({title:'voice',script:'Hello'}).sync).toBe('exact');
});
it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('reveals no words before supplied cue starts and seeks deterministically',async()=>{
 const script='\u0633\u06b5\u0627\u0648 \u0645\u062a\u0645\u0627\u0646\u06d5 TikTok 2026';
 const p=await create('cue-render-test',script,{width:360,height:640,fontSize:28,minFontSize:16,useReferences:false,background:'white-grid',backgroundDesign:{gridSize:80,gridOpacity:.06,gridColor:'#1F5EFF',glow:true,drift:0}});
 p.scenes=plan(script,p.config);const s=p.scenes[0];s.duration=4;
 s.wordCues=words(s.text).map((w,i)=>({from:w.start,to:w.end,start:.25+i*.8,end:.65+i*.8}));
 const r=await openRenderer(p);
 try{
  await r.page.evaluate(()=>window.render(.24));
  expect(await r.page.locator('[data-word]').first().evaluate(el=>getComputedStyle(el).opacity)).toBe('0');
  await r.page.evaluate(()=>window.render(.25));
  expect(await r.page.locator('[data-word]').first().evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
  await r.page.evaluate(()=>window.render(1.04));
  expect(await r.page.locator('[data-word]').nth(1).evaluate(el=>getComputedStyle(el).opacity)).toBe('0');
  await r.page.evaluate(()=>window.render(1.06));
  expect(await r.page.locator('[data-word]').nth(1).evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
  const a=await r.page.screenshot();await r.page.evaluate(()=>window.render(.1));await r.page.evaluate(()=>window.render(1.06));expect(await r.page.screenshot()).toEqual(a);
 }finally{await r.close();}
 s.animation='center-word-swap';
 const r2=await openRenderer(p);
 try{
  await r2.page.evaluate(()=>window.render(1.04));
  expect(await r2.page.locator('[data-word]').first().evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
  expect(await r2.page.locator('[data-word]').nth(1).evaluate(el=>getComputedStyle(el).opacity)).toBe('0');
  await r2.page.evaluate(()=>window.render(1.06));
  expect(await r2.page.locator('[data-word]').nth(1).evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
 }finally{await r2.close();}
 p.config.reducedMotion=true;
 const r3=await openRenderer(p);
 try{
  await r3.page.evaluate(()=>window.render(.24));
  expect(await r3.page.locator('[data-word]').first().evaluate(el=>getComputedStyle(el).opacity)).toBe('0');
  await r3.page.evaluate(()=>window.render(.26));
  expect(await r3.page.locator('[data-word]').first().evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
 }finally{await r3.close();}
},30000);
