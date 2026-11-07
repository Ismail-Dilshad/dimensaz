import {describe,it,expect,beforeAll} from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ffmpeg,run} from '../src/renderer/ffmpeg-encoder.js';
import {edlSchema} from '../src/editor/edl.js';
import {runEdl,mediaInfo,measureLoudness} from '../src/editor/editor.js';
import {parseSrt,writeSrt,retime} from '../src/editor/srt.js';

let dir='';
const src=()=>path.join(dir,'src.mp4');
const out=(name:string)=>path.join(dir,'out',name+'.mp4');
const edit=(operations:unknown[],name:string,extra:object={})=>runEdl({version:1,input:'src.mp4',output:'out/'+name+'.mp4',operations,...extra},dir);

beforeAll(async()=>{
 dir=await fs.mkdtemp(path.join(os.tmpdir(),'rw-editor-'));
 await run(ffmpeg,['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=s=320x180:r=30:d=3','-f','lavfi','-i','sine=f=440:d=3:sample_rate=48000','-shortest','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',src()]);
 await run(ffmpeg,['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc=s=160x120:r=25:d=1','-c:v','libx264','-pix_fmt','yuv420p',path.join(dir,'silent.mp4')]);
},60000);

describe('edit decision list schema',()=>{
 it('validates operations strictly',()=>{
  expect(edlSchema.parse({version:1,input:'a.mp4',operations:[{op:'trim',start:1}]}).export.preset).toBe('social');
  expect(()=>edlSchema.parse({version:1,input:'a.mp4',operations:[{op:'cut',ranges:[{start:2,end:1}]}]})).toThrow();
  expect(()=>edlSchema.parse({version:1,input:'a.mp4',operations:[{op:'captions',srt:'a.srt',cues:[{start:0,end:1,text:'x'}]}]})).toThrow(/exactly one/);
  expect(()=>edlSchema.parse({version:1,input:'a.mp4',operations:[{op:'warp'}]})).toThrow();
  expect(()=>edlSchema.parse({version:1,input:'a.mp4',operations:[{op:'fade'}]})).toThrow(/fade/);
 });
 it('parses and writes SRT without changing caption text',()=>{
  const text='1\r\n00:00:00,500 --> 00:00:02,000\r\nسڵاو، ئەمە ڕۆژە\r\n\r\n2\r\n00:00:02,250 --> 00:00:03,000\r\nTwo\r\nlines\r\n';
  const cues=parseSrt(text);
  expect(cues).toEqual([{start:.5,end:2,text:'سڵاو، ئەمە ڕۆژە'},{start:2.25,end:3,text:'Two\nlines'}]);
  expect(parseSrt(writeSrt(cues))).toEqual(cues);
  expect(retime(cues,t=>t<1?null:t-1)).toEqual([{start:1.25,end:2,text:'Two\nlines'}]);
 });
});

describe('editor',()=>{
 it('trims, cuts, splits and keeps the frame rate',async()=>{
  const r=await edit([{op:'trim',start:.5,end:2.5},{op:'cut',ranges:[{start:.5,end:1}]},{op:'split',at:[.5],keep:[1,0]}],'cut');
  expect(r.steps.map(s=>s.duration)).toEqual([expect.closeTo(2,1),expect.closeTo(1.5,1),expect.closeTo(1.5,1)]);
  expect(r.info).toMatchObject({fps:30,width:320,height:180,hasAudio:true});
  expect(r.info.duration).toBeCloseTo(1.5,1);
 },60000);
 it('reframes 16:9 to 9:16, crops, resizes, zooms and changes speed',async()=>{
  const r=await edit([{op:'reframe',aspect:'9:16',width:180,height:320},{op:'zoom',scale:1.2,start:.5,end:2,ramp:.25},{op:'speed',factor:2}],'reframe');
  expect(r.info).toMatchObject({width:180,height:320});expect(r.info.duration).toBeCloseTo(1.5,1);
  const c=await edit([{op:'crop',x:0,y:0,width:.5,height:.5},{op:'resize',width:400,height:400,mode:'pad'}],'crop');
  expect(c.steps[0]).toMatchObject({width:160,height:90});expect(c.info).toMatchObject({width:400,height:400});
 },60000);
 it('concatenates clips of different size, rate and missing audio',async()=>{
  const r=await edit([{op:'concat',files:['silent.mp4'],position:'before'}],'concat');
  expect(r.info).toMatchObject({width:320,height:180,fps:30,hasAudio:true});
  expect(r.info.duration).toBeCloseTo(4,1);
 },60000);
 it('normalizes loudness close to the target and applies fades and gain',async()=>{
  const r=await edit([{op:'volume',gainDb:-12},{op:'fade',in:.3,out:.3},{op:'loudness',target:-16}],'loud');
  expect(r.steps[2].note).toMatch(/two-pass/);
  expect(Math.abs(await measureLoudness(r.output)-(-16))).toBeLessThan(1.5);
 },60000);
 it('never overwrites, never writes onto an input, and leaves the source untouched',async()=>{
  const before=await fs.readFile(src());
  const r=await edit([{op:'trim',start:0,end:1}],'once');
  await expect(edit([{op:'trim',start:0,end:1}],'once')).rejects.toThrow(/never overwrites/);
  await expect(runEdl({version:1,input:'src.mp4',output:'src.mp4',operations:[]},dir)).rejects.toThrow(/inputs/);
  expect(Buffer.compare(before,await fs.readFile(src()))).toBe(0);
  const receipt=JSON.parse(await fs.readFile(r.receipt,'utf8'));
  expect(receipt.edl.operations[0].op).toBe('trim');
 },60000);
 it('skips audio-only operations on silent footage with a note',async()=>{
  const r=await runEdl({version:1,input:'silent.mp4',output:'out/silent-vol.mp4',operations:[{op:'volume',gainDb:3}]},dir);
  expect(r.steps[0].note).toMatch(/no audio/);expect((await mediaInfo(out('silent-vol'))).hasAudio).toBe(false);
 },60000);
 it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('burns in right-to-left captions with an allowed font',async()=>{
  const r=await edit([{op:'captions',cues:[{start:0,end:1.5,text:'سڵاو، ئەمە ڕۆژە'},{start:1.5,end:3,text:'Hello 2026!'}]}],'captions');
  expect(r.steps[0].note).toMatch(/2 captions, ckb/);
  expect(r.info).toMatchObject({width:320,height:180});
 },60000);
});
