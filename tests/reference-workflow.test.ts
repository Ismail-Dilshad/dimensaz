import {it,expect,beforeAll,afterAll,vi} from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const currentHash=vi.hoisted(()=>'a'.repeat(64));
vi.mock('../src/renderer/render-controller.js',()=>({fingerprint:async()=>currentHash}));
import {beginDirector,answerDirector,readDirector,preset} from '../src/engine/style-director.js';
import {referenceEvidence,acceptReferenceReview,assertReferenceReview,referenceReviewSchema,referenceAssetBlockers} from '../src/engine/reference-production.js';
import {assertActivePreset,activeProductionPresets,fidelityCriteria} from '../src/engine/reference-policy.js';
import {create,dir} from '../src/engine/project.js';
import {planReference} from '../src/engine/reference-storyboard.js';
import {applyReferenceStyle,assertReferenceScenes} from '../src/engine/reference-styles.js';
import {mechanismKeyframeSchema,referencePartSchema} from '../src/engine/reference-motion-schema.js';
import {mechanismSample} from '../src/animations/reference-motion.js';
const old=process.env.VIDEO_WORKSPACE;
beforeAll(async()=>{process.env.VIDEO_WORKSPACE=await fs.mkdtemp(path.join(os.tmpdir(),'reference-workflow-'));});
afterAll(()=>{if(old===undefined)delete process.env.VIDEO_WORKSPACE;else process.env.VIDEO_WORKSPACE=old;});

it('retains seven reference styles, adds the explainer entry, and rejects legacy selection without changing old sessions',async()=>{
 expect(activeProductionPresets.filter(p=>p.startsWith('reference-'))).toHaveLength(7);
 expect(()=>assertActivePreset('script-explainer')).not.toThrow();
 expect(()=>assertActivePreset('clay')).toThrow(/Unknown preset/);expect(()=>assertActivePreset('kinetic')).not.toThrow();
 const v=await beginDirector({script:'A message.'});
 expect(v.question?.options).toHaveLength(7);expect(v.question?.key).toBe('referenceStyle');
 await answerDirector(v.session,'style-5');
 const s=await readDirector(v.session);expect(s.style.resolved.palette.background).toBe('#06201A');
 await expect(answerDirector(v.session,'change palette')).rejects.toThrow(/locked/);
 const legacy=await beginDirector({legacy:true,script:'Old project',resolution:'default'});
 await preset('save','legacy-fixture',legacy.session);
 await expect(preset('load','legacy-fixture',v.session)).rejects.toThrow(/Legacy/);
});

it('round trips accepted reviews and rejects stale or mismatched reference evidence',async()=>{
 const p=await create('Pilot review regression','A message.',{renderPurpose:'test'});
 p.referenceWorkflow={version:1};applyReferenceStyle(p,'style-1');
 const evidence=await referenceEvidence('style-1');
 const file=path.join(dir(p.id,p.config),'reference-review.json');
 await fs.writeFile(path.join(dir(p.id,p.config),'pilot.json'),JSON.stringify({fingerprint:currentHash}));
 const review={version:1,fingerprint:currentHash,reviewer:'Regression fixture, not visual approval',referenceImages:[evidence.images[0].path],assessments:fidelityCriteria.map(criterion=>({criterion,result:'pass',notes:'Synthetic schema regression assessment only.'})),limitations:[],reviewed:true};
 await acceptReferenceReview(p,review);
 await expect(assertReferenceReview(p,currentHash)).resolves.toBeUndefined();
 await expect(assertReferenceReview(p,'b'.repeat(64))).rejects.toThrow(/stale/);
 const stored=JSON.parse(await fs.readFile(file,'utf8'));stored.referenceSources=[];
 await fs.writeFile(file,JSON.stringify(stored));await expect(assertReferenceReview(p,currentHash)).rejects.toThrow(/sources changed/);
 await expect(acceptReferenceReview(p,{...review,referenceImages:['unrelated.png']})).rejects.toThrow(/actual images/);
 expect(()=>referenceReviewSchema.parse({...review,assessments:review.assessments.map(a=>({...a,result:'accepted-departure'}))})).toThrow(/Disclose/);
});

it('never treats a bare pinned asset as reviewed reference provenance',async()=>{
 const p=await create('Missing evidence fixture','A message.',{renderPurpose:'test'});p.referenceWorkflow={version:1};
 p.scenes=planReference(p.script,'style-1').request.scenes;applyReferenceStyle(p,'style-1');
 p.scenes[0].asset='bare-lock';p.scenes[0].referenceMotion!.metaphor='A message leaving a phone';
 p.assetLocks=[{id:'bare-lock',path:'input/asset-locks/file.png',hash:'a'.repeat(64),source:'fixture',license:'unknown',tags:[],width:100,height:100}];
 expect(referenceAssetBlockers(p).join(' ')).toMatch(/reviewed provenance/);
});

it('samples functional motion deterministically, including holds and reduced motion',()=>{
 const frames=[{at:0,x:0},{at:.25,x:.2,easing:'linear'},{at:.75,x:.2},{at:1,x:0}].map(f=>mechanismKeyframeSchema.parse(f));
 const a=mechanismSample(.5,4,frames);expect(a.x).toBeCloseTo(.1);
 mechanismSample(3.8,4,frames);expect(mechanismSample(.5,4,frames)).toEqual(a);
 expect(mechanismSample(2,4,frames).x).toBe(.2);
 expect(mechanismSample(.1,4,frames,true).x).toBe(0);
 expect(()=>referencePartSchema.parse({asset:'dart',role:'part',x:.5,y:.5,width:.2,height:.2,keyframes:[frames[1],frames[0]]})).toThrow(/increasing/);
});

it('rejects carry continuity when hero position changes',async()=>{
 const p=await create('Carry fixture','One. Two.',{renderPurpose:'test'});p.scenes=planReference(p.script,'style-1').request.scenes;applyReferenceStyle(p,'style-1');
 for(const s of p.scenes){s.asset='phone';Object.assign(s.referenceMotion!,{metaphor:'A message remains on the phone',camera:'static',transition:'cut',heroLoop:'none',layout:'headline-top'});}
 p.scenes[1].referenceMotion!.continuity='carry-hero';expect(()=>assertReferenceScenes(p)).not.toThrow();
 p.scenes[1].referenceMotion!.layout='headline-bottom';expect(()=>assertReferenceScenes(p)).toThrow(/matching stationary/);
});
