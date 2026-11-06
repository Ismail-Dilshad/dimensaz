import {resolveLanguage} from '../engine/languages.js';
import os from 'node:os';
import {it,expect} from 'vitest';
import {requestSchema,produce} from '../engine/production.js';
import {projectSchema} from '../engine/schema.js';
import {create,load} from '../engine/project.js';
import {productionPresets} from '../engine/production-presets.js';
import {animationNames} from '../animations/animation-registry.js';
import {eligibleSfx} from '../engine/sfx.js';
it('validates requests strictly, geometry consistently, and detects Sorani from the script',()=>{
 const r=requestSchema.parse({schemaVersion:1,title:'Test',script:'سڵاو'});
 expect(r.language).toBe('auto');expect(resolveLanguage(r.language,r.script)).toBe('ckb');expect(r.preset).toBe('reference-style-1');
 expect(()=>requestSchema.parse({...r,typo:true})).toThrow();
 expect(()=>requestSchema.parse({...r,resolution:{width:640,height:360}})).toThrow();
});
it('loads legacy project manifests without modifying their appearance',async()=>{
 const p=await create('manifest-legacy-test','Hello');const {schemaVersion,...legacy}=p;
 const loaded=projectSchema.parse(legacy);expect(loaded.schemaVersion).toBe(1);expect(loaded.config).toEqual(p.config);
});
it('maps all named presets to implemented animations',()=>{for(const p of Object.values(productionPresets))expect(animationNames).toContain(p.animation);});
it('never auto-selects unknown-license audio',()=>{
 expect(eligibleSfx([{file:'test',sha256:'0',duration:.1,category:'clicks',license:null,rmsDb:-20}])).toEqual([]);
});
it('rejects approval of a newly created uninspected job',async()=>{
 await expect(produce({manifest:'unused',approve:true})).rejects.toThrow(/Inspect/);
});
it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('retains stable project ID and plan when resuming a preview job',async()=>{
 const a=await produce({manifest:'examples/production-request.json',legacyStyle:true});
 expect(a.status).toBe('preview-review');const original=await load(a.job);
 const b=await produce({resume:a.job});expect(b.job).toBe(a.job);
 expect((await load(a.job)).scenes).toEqual(original.scenes);
},30000);
it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('recovers a bad embedded alignment using an explicit correction',async()=>{
 const fs=await import('node:fs/promises'),path=await import('node:path');
 const {createHash}=await import('node:crypto');const {ffmpeg,run}=await import('../renderer/ffmpeg-encoder.js');
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'timing-recovery-'));const audio=path.join(base,'fixture.wav');
 await run(ffmpeg,['-v','error','-n','-f','lavfi','-i','sine=frequency=440:duration=2',audio]);
 const evidence={audioSha256:'0'.repeat(64),method:'manual-review',source:'Synthetic sine fixture; not speech alignment',reviewed:true,words:[{text:'Hello',start:.2,end:1.5}]};
 const manifest=path.join(base,'request.json');await fs.writeFile(manifest,JSON.stringify({schemaVersion:1,title:'timing recovery test',script:'Hello',voiceover:audio,resolution:{width:360,height:640},wordAlignment:evidence}));
 let job='';try{await produce({manifest,legacyStyle:true});}catch(error){job=String(error).match(/Job (\S+) failed:/)?.[1]||'';}
 expect(job).not.toBe('');
 evidence.audioSha256=createHash('sha256').update(await fs.readFile(audio)).digest('hex');
 const correction=path.join(base,'reviewed.json');await fs.writeFile(correction,JSON.stringify(evidence));
 const result=await produce({resume:job,alignment:correction});expect(result.status).toBe('preview-review');
 if(!('project' in result))throw new Error('Expected preview project');
 const retry=await produce({resume:job,revision:result.project});expect(retry.status).toBe('preview-review');
},30000);

it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('resumes an incomplete reference storyboard without creating a second project or bypassing asset review',async()=>{
 const fs=await import('node:fs/promises'),path=await import('node:path');
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'reference-recovery-'));
 const manifest=path.join(folder,'request.json');
 const script='  One exact sentence.\nAnother sentence!  ';
 await fs.writeFile(manifest,JSON.stringify({schemaVersion:1,purpose:'test',title:'Reference recovery fixture',script}));
 const a=await produce({manifest});expect(a.status).toBe('asset-review');
 const b=await produce({resume:a.job,approve:true});expect(b.status).toBe('asset-review');expect(b.job).toBe(a.job);
 expect((await load(a.job)).script).toBe(script);
 const invalid=path.join(folder,'bad-storyboard.json');await fs.writeFile(invalid,JSON.stringify({scenes:[]}));
 await expect(produce({resume:a.job,storyboard:invalid})).rejects.toThrow();
 expect((await produce({resume:a.job})).status).toBe('asset-review');
},30000);
