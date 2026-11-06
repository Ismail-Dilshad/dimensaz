import {it,expect} from 'vitest';
import {requestSchema} from '../engine/production.js';
import {directorPresets} from '../engine/director-presets.js';
import {create,save,load,dir} from '../engine/project.js';
import {referenceStyleIds,referenceSceneSchema,referenceStyleSchema} from '../engine/reference-motion-schema.js';
import {referenceStyles,applyReferenceStyle,assertReferenceScenes,selectedAssetIds} from '../engine/reference-styles.js';
import {planReference} from '../engine/reference-storyboard.js';
import {referenceLayerSample} from '../animations/reference-motion.js';
import {applyPreset} from '../engine/production-presets.js';
import {projectSchema,sceneSchema} from '../engine/schema.js';
import {lockAssets} from '../engine/asset-locks.js';
import {fingerprint} from '../renderer/render-controller.js';
import {openRenderer} from '../renderer/browser-renderer.js';
import fs from 'node:fs/promises';
import path from 'node:path';

it('preserves every source character across multilingual storyboard beats',()=>{
 for(const script of ['  سڵاو، متمانە گرنگە؟\r\nبەڵێ!  ','Hello there. Another sentence!\nFinal line','  \nکاک اسماعیل\n\n']){
  const plan=planReference(script,'style-1');
  expect(plan.request.scenes.map(s=>s.text).join('')).toBe(script);
  expect(plan.request.scenes.every(s=>!s.asset)).toBe(true);
  expect(plan.status).toBe('storyboard-needs-assets');
 }
});
it('gives silent cuts different reading holds and carries each duration into the packet',()=>{
 const plan=planReference('Why? A longer demonstration gives the viewer time to see how both objects move.','style-1','Blue Editorial');
 const [hook,demo]=plan.request.scenes;
 expect(hook.duration).toBeLessThan(demo.duration);
 expect(demo.start).toBe(hook.duration);
 expect(plan.packetDraft.scenes.map(s=>s.scoreFrames)).toEqual(plan.request.scenes.map(s=>Math.round(s.duration*60)));
});
it('validates all seven complete style snapshots and rejects invalid layers and clipped headlines',()=>{
 for(const s of Object.values(referenceStyles))expect(referenceStyleSchema.parse(s)).toEqual(s);
 const s=planReference('Whole words only.','style-1').request.scenes[0];
 expect(()=>sceneSchema.parse({...s,referenceMotion:{...s.referenceMotion,headline:{from:1,to:3}}})).toThrow(/complete source words/);
 const layer={asset:'shopping',role:'accent',x:.5,y:.5,width:.1,height:.1};
 expect(()=>referenceSceneSchema.parse({...s.referenceMotion,layers:[layer,layer,layer]})).toThrow(/two supporting/);
 expect(()=>referenceSceneSchema.parse({...s.referenceMotion,layers:[{...layer,x:9}]})).toThrow();
});
it('samples layers independently with no elapsed-state dependency',()=>{
 const first=referenceLayerSample(.6,6,'pop',0);
 referenceLayerSample(5,6,'right',.4);
 expect(referenceLayerSample(.6,6,'pop',0)).toEqual(first);
 expect(referenceLayerSample(.6,6,'pop',.4).opacity).toBe(0);
 expect(referenceLayerSample(.6,6,'pop',.4,true)).toEqual({x:0,y:0,scale:1,opacity:1});
});
it('keeps legacy manifests unchanged and persists every reference layer across reloads',async()=>{
 const p=await create('reference schema test','Hello.',{renderPurpose:'test'});
 const legacy=projectSchema.parse(p);expect(legacy.config.referenceStyle).toBeUndefined();
 p.scenes=planReference(p.script,'style-5').request.scenes;
 applyPreset(p,'reference-style-5');
 expect(()=>assertReferenceScenes(p)).toThrow(/explicit hero/);
 p.scenes[0].asset='communication';
 expect(()=>assertReferenceScenes(p)).toThrow(/placeholder metaphor/);
 expect(p.styleDNA!.material).toBe(referenceStyles['style-5'].material);
 p.scenes[0].referenceMotion!.metaphor='A communication device with an independently appearing shopping cue';
 p.scenes[0].referenceMotion!.layers=[referenceSceneSchema.parse({metaphor:'test',layout:'headline-top',layers:[{asset:'shopping',role:'part',x:.6,y:.6,width:.2,height:.2}]}).layers[0]];
 expect(selectedAssetIds(p)).toEqual(['communication','shopping']);
 await lockAssets(p);await save(p);
 const reloaded=await load(p.id);expect(reloaded.config.referenceStyle).toEqual(p.config.referenceStyle);
 expect(reloaded.assetLocks!.map(a=>a.id)).toEqual(['communication','shopping']);
 expect(await fingerprint(reloaded)).toBe(await fingerprint(p));
 const pinned=reloaded.assetLocks!.find(a=>a.id==='shopping')!;
 const file=path.join(dir(p.id,p.config),pinned.path),bytes=await fs.readFile(file);
 try{await fs.writeFile(file,Buffer.concat([bytes,Buffer.from(' ')]));await expect(fingerprint(p)).rejects.toThrow(/integrity|changed/i);}
 finally{await fs.writeFile(file,bytes);}
});
const browserTest=it.skipIf(process.env.RUN_BROWSER_TESTS!=='1');
browserTest('renders seven styles with independent parts, line counts, RTL and seek-stable frames',async()=>{
 for(const id of referenceStyleIds){
  const p=await create('reference browser '+id,'متمانە گرنگە.',{renderPurpose:'test',width:360,height:640,fontSize:36,minFontSize:18});
  p.scenes=planReference(p.script,id).request.scenes;p.scenes[0].asset='communication';
  p.scenes[0].referenceMotion!.metaphor='A communication hero with an independent product cue';
  p.scenes[0].referenceMotion!.layers=referenceSceneSchema.parse({metaphor:'test',layout:'headline-top',layers:[{asset:'shopping',role:'part',x:.68,y:.65,width:.2,height:.2,delay:.25,travelX:.1}]}).layers;
  applyReferenceStyle(p,id);await lockAssets(p);
  const r=await openRenderer(p);
  try{
   await r.page.evaluate(()=>window.render(.6));
   expect(await r.page.locator('[data-reference-line]').count()).toBe(2);
   expect(await r.page.locator('[data-reference-layer]').count()).toBe(2);
   expect(await r.page.locator('[data-reference-layer="part"]').evaluate(el=>Number(getComputedStyle(el).opacity))).toBe(0);
   await r.page.evaluate(()=>window.render(2));
   const a=await r.page.screenshot();
   await r.page.evaluate(()=>window.render(4));await r.page.evaluate(()=>window.render(2));
   expect(await r.page.screenshot()).toEqual(a);
   const text=await r.page.locator('[data-kinetic] > div').textContent();expect(text).toBe(p.script);
   const ink=await r.page.locator('[data-word]').first().evaluate(el=>getComputedStyle(el).color);
   const rgb=(hex:string)=>'rgb('+[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')+')';
   expect(ink).toBe(rgb(referenceStyles[id].ink));
   expect(await r.page.locator('[data-reference-background]').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe(rgb(referenceStyles[id].background));
  }finally{await r.close();}
 }
},90000);


browserTest('holds reduced-motion layers still and honors a no-loop part rotation',async()=>{
 const p=await create('reference reduced motion','A complete sentence.',{renderPurpose:'test',width:360,height:640,fontSize:36,minFontSize:18,reducedMotion:true});
 p.scenes=planReference(p.script,'style-1').request.scenes;p.scenes[0].asset='reference-blue-phone';
 p.scenes[0].referenceMotion=referenceSceneSchema.parse({metaphor:'A message leaving a phone',layout:'headline-top',layers:[{asset:'reference-blue-plane',role:'part',x:.5,y:.5,width:.2,height:.2,travelX:.2,rotation:13,loop:'none'}]});
 applyReferenceStyle(p,'style-1');await lockAssets(p);
 for(const reduced of [true,false]){
  p.config.reducedMotion=reduced;const r=await openRenderer(p);
  try{
   await r.page.evaluate(()=>window.render(3));
   const a=await r.page.locator('[data-reference-layer="part"]').getAttribute('style');
   await r.page.evaluate(()=>window.render(4));
   const b=await r.page.locator('[data-reference-layer="part"]').getAttribute('style');
   if(reduced)expect(b).toBe(a);
   expect(a).toContain('rotate(13deg)');expect(b).toContain('rotate(13deg)');
  }finally{await r.close();}
 }
},30000);

browserTest('fits a selected headline without displaying omitted source whitespace',async()=>{
 const script='\n\n\nIntro\n\n\n\nChosen words\n\n\n\nFull narration preserved.';
 const p=await create('reference selected headline',script,{renderPurpose:'test',width:360,height:640,fontSize:36,minFontSize:18});
 const s=planReference('Chosen words','style-1').request.scenes[0];s.text=script;s.highlights=[];s.asset='reference-blue-phone';
 s.referenceMotion!.metaphor='A phone carries the message';
 s.referenceMotion!.headline={from:script.indexOf('Chosen'),to:script.indexOf('Chosen')+'Chosen words'.length};
 p.scenes=[sceneSchema.parse(s)];applyReferenceStyle(p,'style-1');await lockAssets(p);
 const r=await openRenderer(p);
 try{
  await r.page.evaluate(t=>window.render(t),s.duration*.7);
  const text=r.page.locator('[data-kinetic] > div');
  expect(await text.textContent()).toBe(script);
  expect(await text.innerText()).toBe('Chosen words');
  expect(await text.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(18);
 }finally{await r.close();}
},30000);

it('rejects a conflicting director style instead of silently overriding the selected reference',()=>{
 const request=planReference('A message.','style-1').request;
 const director={version:1,selection:{},resolved:directorPresets['reference-style-5'],confirmed:true,sceneOverrides:{}};
 expect(()=>requestSchema.parse({...request,director})).toThrow(/must match/);
 director.resolved=directorPresets['reference-style-1'];
 expect(requestSchema.parse({...request,director}).director?.resolved.referenceStyle).toBe('style-1');
});

browserTest('keeps the hero stationary across a cut and samples authored parts independently',async()=>{
 const p=await create('reference mechanism browser','One. Two.',{renderPurpose:'test',width:360,height:640,fontSize:36,minFontSize:18});
 p.scenes=planReference(p.script,'style-1').request.scenes;
 for(const [i,s] of p.scenes.entries()){
  s.asset='reference-blue-phone';s.start=i*3;s.duration=3;
  s.referenceMotion=referenceSceneSchema.parse({metaphor:'The phone remains while its message departs',layout:'headline-top',camera:'static',heroLoop:'none',transition:'cut',continuity:i?'carry-hero':'new',headlineRevealSeconds:.3,
   layers:[{asset:'reference-blue-plane',role:'part',x:.5,y:.55,width:.2,height:.15,keyframes:[{at:0,x:0},{at:.5,x:.1},{at:1,x:.2}]}]});
 }
 applyReferenceStyle(p,'style-1');await lockAssets(p);const r=await openRenderer(p);
 try{
  await r.page.evaluate(()=>window.render(1.5));const a=await r.page.screenshot();
  const moving=await r.page.locator('[data-reference-stage="S01"] [data-reference-layer="part"]').getAttribute('style');expect(moving?.replace(/\s/g,'')).toContain('translate(36px,0px)');
  await r.page.evaluate(()=>window.render(2.999));
  const before=await r.page.locator('[data-reference-stage="S01"] [data-reference-layer="hero"]').evaluate(el=>el.getBoundingClientRect().toJSON());
  await r.page.evaluate(()=>window.render(3));
  const after=await r.page.locator('[data-reference-stage="S02"] [data-reference-layer="hero"]').evaluate(el=>el.getBoundingClientRect().toJSON());
  expect(after).toEqual(before);
  await r.page.evaluate(()=>window.render(1.5));expect(await r.page.screenshot()).toEqual(a);
  expect(await r.page.locator('[data-reference-grid]').evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('2px');
  const opacity=await r.page.locator('[data-kinetic]').first().locator('[data-word]').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).opacity));expect(opacity.every(v=>v==='1')).toBe(true);
 }finally{await r.close();}
},30000);
