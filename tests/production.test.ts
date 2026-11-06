import {beforeAll,afterAll,it,expect} from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {create,dir,writeJSON} from '../engine/project.js';
import {fingerprint,approvePreview,preview,render} from '../renderer/render-controller.js';
import {plan} from '../engine/scene-planner.js';
import {planProject} from '../engine/timeline-builder.js';
import {validateWordAlignment} from '../engine/voice-alignment.js';
let temp:string;
const oldWS=process.env.VIDEO_WORKSPACE,oldOutput=process.env.VIDEO_OUTPUT;
beforeAll(async()=>{temp=await fs.mkdtemp(path.join(os.tmpdir(),'production-regression-'));process.env.VIDEO_WORKSPACE=path.join(temp,'workspace');process.env.VIDEO_OUTPUT=path.join(temp,'mp2');});
afterAll(()=>{if(oldWS===undefined)delete process.env.VIDEO_WORKSPACE;else process.env.VIDEO_WORKSPACE=oldWS;if(oldOutput===undefined)delete process.env.VIDEO_OUTPUT;else process.env.VIDEO_OUTPUT=oldOutput;});
it('invalidates preview approval when source bytes change at the same path',async()=>{
 const p=await create('content-fingerprint','Hello');
 const file=path.join(dir(p.id,p.config),'input','fixture.txt');
 await fs.writeFile(file,'unit fingerprint bytes, not an image');
 p.media=[{id:'unit',path:'input/fixture.txt',kind:'image',at:0}];
 const initial=await fingerprint(p);
 await writeJSON(path.join(dir(p.id,p.config),'preview.json'),{fingerprint:initial});
 p.exports.push('export-receipt');expect(await fingerprint(p)).toBe(initial);
 await fs.writeFile(file,'different unit fingerprint bytes');
 expect(await fingerprint(p)).not.toBe(initial);
 await expect(approvePreview(p)).rejects.toThrow(/stale/);
});
it('uses phrase holds for unaligned voice plans in the direct CLI too',async()=>{
 const p=await create('estimated','Hello world\nAnother phrase');
 p.media=[{id:'fixture',path:'not-read.wav',kind:'voice',at:0,metadata:{format:{duration:'5'}}}];
 expect(planProject(p).every(s=>s.animation==='phrase-rise'&&!s.wordCues)).toBe(true);
});
it('rejects invalid probed audio duration instead of accepting unchecked cues',()=>{
 const fixture={audioSha256:'0'.repeat(64),method:'manual-review',source:'unit test only',reviewed:true,words:[{text:'Hello',start:0,end:1}]};
 for(const duration of [NaN,Infinity,0,-1])expect(()=>validateWordAlignment('Hello',fixture,duration)).toThrow(/duration/);
});
it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('never implicitly approves a regenerated preview and samples short scenes inside their bounds',async()=>{
 const p=await create('stale-approval','Hello',{width:360,height:640,fontSize:40,minFontSize:22,useReferences:false});
 p.scenes=plan(p.script,p.config);p.scenes[0].duration=1/p.config.fps;
 const pv=await preview(p);
 expect(pv.times.every(t=>t>=0&&t<p.scenes[0].duration)).toBe(true);
 p.config.primary='#FF0000';
 await expect(render(p,true)).rejects.toThrow(/missing or stale/);
 const next=JSON.parse(await fs.readFile(path.join(dir(p.id,p.config),'preview.json'),'utf8'));
 expect(next.approved).not.toBe(true);
 expect(next.fingerprint).not.toBe(pv.fingerprint);
},30000);
