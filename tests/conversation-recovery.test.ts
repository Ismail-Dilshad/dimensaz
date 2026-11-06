import {beforeAll,afterAll,beforeEach,it,expect,vi} from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const mock=vi.hoisted(()=>({preview:vi.fn(),analysis:vi.fn()}));
vi.mock('../renderer/render-controller.js',()=>({preview:mock.preview,render:vi.fn()}));
vi.mock('../engine/audio-analysis.js',()=>({analyzeProjectAudio:mock.analysis}));
vi.mock('../motion-library/library.js',()=>({updateLibrary:vi.fn()}));
// Deliberately stub probe metadata; these tests exercise session recovery, not media validity.
vi.mock('../renderer/ffmpeg-encoder.js',()=>({probe:vi.fn(async()=>({format:{duration:'5'},streams:[{codec_type:'audio'}]}))}));
import {beginBrief,prepareBrief,finishBrief} from '../engine/conversation.js';
import {load} from '../engine/project.js';
let temp:string,voice:string;
const oldWS=process.env.VIDEO_WORKSPACE,oldOutput=process.env.VIDEO_OUTPUT;
beforeAll(async()=>{
 temp=await fs.mkdtemp(path.join(os.tmpdir(),'brief-recovery-'));process.env.VIDEO_WORKSPACE=path.join(temp,'workspace');process.env.VIDEO_OUTPUT=path.join(temp,'mp2');
 voice=path.join(temp,'unit-stub.wav');await fs.writeFile(voice,'Mock probe fixture. Not audio.');
});
afterAll(()=>{if(oldWS===undefined)delete process.env.VIDEO_WORKSPACE;else process.env.VIDEO_WORKSPACE=oldWS;if(oldOutput===undefined)delete process.env.VIDEO_OUTPUT;else process.env.VIDEO_OUTPUT=oldOutput;});
beforeEach(()=>{mock.preview.mockReset();mock.preview.mockResolvedValue({sheet:'unit-preview-stub'});mock.analysis.mockReset();mock.analysis.mockRejectedValue(new Error('Python dependency unavailable'));});
it('keeps an exact-sync design preview available when Python analysis cannot start',async()=>{
 const brief=await beginBrief({legacyStyle:true,title:'blocked voice',script:'Hello world',auto:true,language:'en',media:[{file:voice,kind:'voice'}]});
 const result=await prepareBrief(brief.session),p=await load(result.projectId);
 expect(p.config.language).toBe('en');expect(p.config.voiceTiming).toBe('required');
 expect(p.scenes.every(s=>s.animation==='phrase-rise')).toBe(true);
 expect(p.alignmentEvidence).toBeUndefined();
 expect(result.limitations.join(' ')).toContain('Python dependency unavailable');
 expect(result.limitations.join(' ')).toContain('EXACT SYNC BLOCKED');
});
it('keeps explicitly estimated voice drafts on phrases without invoking an aligner',async()=>{
 const brief=await beginBrief({legacyStyle:true,title:'estimated voice',script:'Hello world',auto:true,sync:'estimated',media:[{file:voice,kind:'voice'}]});
 const result=await prepareBrief(brief.session),p=await load(result.projectId);
 expect(p.config.voiceTiming).toBe('estimated');expect(p.scenes.every(s=>s.animation==='phrase-rise')).toBe(true);
 expect(mock.analysis).not.toHaveBeenCalled();
});
it('retains a failed attempt, blocks finishing it, and prepares a distinct recoverable project',async()=>{
 const brief=await beginBrief({legacyStyle:true,title:'retry',script:'Hello world',auto:true});
 mock.preview.mockRejectedValueOnce(new Error('Browser startup failed'));
 await expect(prepareBrief(brief.session)).rejects.toThrow(/Browser/);
 const file=path.join(process.env.VIDEO_WORKSPACE!,'briefs',brief.session+'.json');
 const failed=JSON.parse(await fs.readFile(file,'utf8'));
 await expect(finishBrief(brief.session,true)).rejects.toThrow(/Prepare/);
 const retry=await prepareBrief(brief.session);
 expect(retry.projectId).not.toBe(failed.projectId);
 expect((await load(failed.projectId)).script).toBe('Hello world');
 expect((await prepareBrief(brief.session)).projectId).toBe(retry.projectId);
});
import {answerBrief} from '../engine/conversation.js';
import {readDirector} from '../engine/style-director.js';
import {factoryStyle} from '../engine/style-director-schema.js';
it('preserves legacy numbered answers through the unified question workflow',async()=>{
 const b=await beginBrief({legacyStyle:true,title:'Legacy preferences',script:'Hello world'});
 await answerBrief(b.session,'1 Minimal, 2 White Grid, 3 High Energy, 4 Text Only, 5 16:9');
 const s=await readDirector(b.directorSession!);expect(s.style.resolved.creativeDirection).toBe('minimal');expect(s.style.resolved.animation.energy).toBe(.85);expect(s.style.resolved.export.width).toBe(1920);expect(s.style.resolved.illustrations).toBe('none');
});
it('allows style confirmation after preparation and refreshes preview evidence',async()=>{
 const b=await beginBrief({legacyStyle:true,title:'Confirm after preview',script:'Hello world',director:{mode:'quick',values:factoryStyle}});
 const first=await prepareBrief(b.session);expect((await load(first.projectId)).config.director?.confirmed).toBe(false);
 await answerBrief(b.session,'Confirm');const refreshed=await prepareBrief(b.session);expect(refreshed.projectId).toBe(first.projectId);expect((await load(first.projectId)).config.director?.confirmed).toBe(true);
});
