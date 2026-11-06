import {expect,it} from 'vitest';
import {cardNames,referenceStyleSchema,referencePartSchema} from '../src/engine/reference-motion-schema.js';
import {collectionCards,cardForReference,cardLock,layerPlanIssues} from '../src/engine/collection-cards.js';
import {planReference} from '../src/engine/reference-storyboard.js';
import {defaultProductionPreset} from '../src/engine/reference-policy.js';
import {referenceEvidence} from '../src/engine/reference-production.js';
import {defaults} from '../src/engine/config.js';
import {openRenderer} from '../src/renderer/browser-renderer.js';
import {create} from '../src/engine/project.js';
import {selectedAssetIds} from '../src/engine/reference-styles.js';
import {referenceStyles,assertReferenceScenes} from '../src/engine/reference-styles.js';
import type {Scene} from '../src/engine/schema.js';
import {requestSchema} from '../src/engine/production.js';

function layerScene():Scene{
 const scene=planReference('ئامانجەکەت هەڵبژێرە.','style-1','Blue Editorial').request.scenes[0];
 scene.duration=6; // This fixture's authored keyframes span six seconds.
 scene.asset='target';const r=scene.referenceMotion!;
 r.metaphor='A dart reaches its target.';r.layers=[referencePartSchema.parse({asset:'dart',role:'part',x:.55,y:.54,width:.25,height:.2,loop:'none',action:'Tip seats in the target',beat:{start:.5,duration:.5,fromX:.12}})];
 return scene;
}
it('validates independent hero and part tracks, deliberate holds and overlapping actions',()=>{
 const s=layerScene(),r=s.referenceMotion!,part=r.layers[0];delete part.beat;
 r.holdArtwork=true;expect(layerPlanIssues(s)).toEqual([]);delete r.holdArtwork;
 const track=referencePartSchema.parse({...part,origin:{x:.2,y:.8},keyframes:[
  {at:0,x:-.1},{at:5/60},{at:50/60},{at:55/60,y:-.07}]}).keyframes!;
 r.heroMotion={origin:{x:.2,y:.8},action:'Arrive, hold, then lift',keyframes:track};
 expect(layerPlanIssues(s)).toEqual([]);
 part.keyframes=track;part.origin={x:.5,y:.5};
 expect(layerPlanIssues(s).join()).toMatch(/Stagger/);
});
it('validates individually chosen durations for packet scenes',async()=>{
 const s=layerScene(),p=await create('Scene score format fixture',s.text,{...await defaults({language:'ckb'}),width:1080,height:1920,fps:60});
 p.config.referenceStyle=cardLock('Blue Editorial');p.scenes=[s];s.referenceMotion!.scoreFrames=360;
 expect(()=>assertReferenceScenes(p)).not.toThrow();
 p.config.fps=30;expect(()=>assertReferenceScenes(p)).toThrow(/60 fps/);
 p.config.fps=60;s.duration=5;expect(()=>assertReferenceScenes(p)).toThrow(/frame count/);
 s.referenceMotion!.scoreFrames=300;expect(()=>assertReferenceScenes(p)).not.toThrow();
 delete s.referenceMotion!.scoreFrames;expect(()=>assertReferenceScenes(p)).not.toThrow();
});
it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('samples a focal entrance, hold and exit independently of its receiver',async()=>{
 const s=layerScene(),r=s.referenceMotion!,part=r.layers[0];delete part.beat;
 r.heroMotion={origin:{x:.25,y:.8},action:'Arrive and depart',keyframes:referencePartSchema.parse({
  ...part,keyframes:[{at:0,x:-.1},{at:5/60},{at:50/60},{at:55/60,rotation:-15,opacity:0}]}).keyframes!};
 const p=await create('Layered hero track fixture',s.text,{...await defaults({language:'ckb'}),width:360,height:640});
 p.config.referenceStyle=cardLock('Blue Editorial');p.scenes=[s];
 const view=await openRenderer(p,.5,['target','dart'].map(id=>({id,path:'assets/claymorphism/objects/communication.svg',source:'test fixture',license:'fixture',tags:['test'],width:128,height:128})));
 try{
  const sample=async(t:number)=>{await view.page.evaluate(time=>window.render(time),t);return view.page.locator('[data-reference-layer]').evaluateAll(els=>els.map(el=>{const css=(el as HTMLElement).style;return [css.transform,css.opacity,css.transformOrigin];}));};
  const start=await sample(0),mid=await sample(.25),settled=await sample(.5),end=await sample(5.6);
  expect(start[0]).not.toEqual(mid[0]);expect(settled).toEqual(await sample(3));
  expect(end[0][1]).toBe('0');expect(start[0][2]).toBe('25% 80%');expect(start[1]).toEqual(end[1]);expect(await sample(.25)).toEqual(mid);
 }finally{await view.close();}
});
it('defaults to Blue Editorial and resolves every named card with its own real evidence',async()=>{
 expect(cardForReference(defaultProductionPreset.slice(10) as 'style-1')).toBe('Blue Editorial');
 // Each catalog family must resolve to actual, hash-verified source material.
 for(const name of cardNames){
  const style=referenceStyleSchema.parse(cardLock(name));expect(style.card).toBe(name);
  expect(requestSchema.parse({schemaVersion:1,title:'Card fixture',script:'سڵاو',styleCard:name}).preset).toBe('reference-'+style.id);
  expect((await referenceEvidence(collectionCards[name].base,name)).images.length).toBeGreaterThan(0);
 }
 expect(()=>cardLock('Lavender Glass','style-1')).toThrow(/conflicts/);
 expect(referenceStyles['style-1'].card).toBeUndefined();
});
it('requires distinct content and a settled, staggered action in each collection scene',()=>{
 const s=layerScene();expect(layerPlanIssues(s)).toEqual([]);
 const first=s.referenceMotion!.layers[0];first.asset=s.asset!;expect(layerPlanIssues(s).join()).toMatch(/distinct/);
 first.asset='dart';s.referenceMotion!.layers.push({...first,asset:'signal'});expect(layerPlanIssues(s).join()).toMatch(/Stagger/);
 first.loop='float';expect(layerPlanIssues(s).join()).toMatch(/static hold/);
});
it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('keeps the receiving object stationary, settles the mover smoothly and reproduces the same pose after seeking',async()=>{
 const s=layerScene(),p=await create('Layer motion timing fixture',s.text,{...await defaults({language:'ckb'}),width:360,height:640});
 p.config.referenceStyle=cardLock('Blue Editorial');p.config.textTreatment='kinetic';p.scenes=[s];
 expect(selectedAssetIds(p)).toEqual(['target','dart']);
 // Synthetic geometry fixtures exercise motion, not reference fidelity.
 const names=['target','dart'];const r=await openRenderer(p,.5,names.map(id=>({id,path:'assets/claymorphism/objects/communication.svg',source:'test fixture',license:'fixture',tags:['test'],width:128,height:128})));
 try {
  const positions=async(t:number)=>{await r.page.evaluate(time=>window.render(time),t);return r.page.locator('[data-reference-layer]').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().x));};
  const a=await positions(.5),near=await positions(.51),mid=await positions(.75),end=await positions(1),hold=await positions(2);
  expect(a[0]).toBe(end[0]);expect(a[1]).toBeGreaterThan(mid[1]);expect(mid[1]).toBeGreaterThan(end[1]);expect(end).toEqual(hold);
  expect(Math.abs(near[1]-a[1])).toBeLessThan(.05);expect(await positions(.75)).toEqual(mid);
 }finally{await r.close();}
});
