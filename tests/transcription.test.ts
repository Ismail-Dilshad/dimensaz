import {describe,it,expect,beforeAll} from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ffmpeg,run} from '../src/renderer/ffmpeg-encoder.js';
import {transcribe,fromResponse,ENDPOINT,type Word} from '../src/engine/transcribe.js';
import {captionsFromWords,anchorToScript,groupCues,normalizeWord} from '../src/editor/caption-builder.js';
import {planTighten,timeMap,tightenEdl} from '../src/editor/tighten.js';
import {edlSchema} from '../src/editor/edl.js';

const w=(text:string,start:number,end:number,type:Word['type']='word'):Word=>({text,start,end,type});
const sha='a'.repeat(64);

describe('ElevenLabs transcription',()=>{
 let dir='',audio='';
 beforeAll(async()=>{dir=await fs.mkdtemp(path.join(os.tmpdir(),'rw-stt-'));audio=path.join(dir,'voice.wav');
  await run(ffmpeg,['-hide_banner','-loglevel','error','-f','lavfi','-i','sine=f=300:d=1.5',audio]);},30000);

 it('converts the provider response without inventing missing times',()=>{
  const t=fromResponse({language_code:'en',language_probability:.97,text:'Hello world',words:[
   {text:'Hello',start:0,end:.4,type:'word',speaker_id:'speaker_1',logprob:-.1},{text:' ',start:.4,end:.5,type:'spacing'},
   {text:'world',start:null,end:null,type:'word'},{text:'(laughs)',start:.9,end:1.2,type:'audio_event'}]},{model:'scribe_v2',source:'x',audioSha256:sha});
  expect(t.language).toBe('en');expect(t.reviewed).toBe(false);
  expect(t.words.map(x=>x.text)).toEqual(['Hello',' ','(laughs)']);
  expect(fromResponse({language_code:'kur',text:'سڵاو',words:[]},{model:'m',source:'x',audioSha256:sha}).language).toBe('ckb');
 });

 it('sends one request with word timestamps, the Kurdish code, and caches by audio hash',async()=>{
  const calls:{url:string;body:FormData;key:string}[]=[];
  const fetcher=(async(url:string,init:RequestInit)=>{calls.push({url,body:init.body as FormData,key:(init.headers as Record<string,string>)['xi-api-key']});
   return new Response(JSON.stringify({language_code:'kur',language_probability:.8,text:'سڵاو',words:[{text:'سڵاو',start:.1,end:.6,type:'word'}]}),{status:200});}) as unknown as typeof fetch;
  const cacheDir=path.join(dir,'cache');
  const first=await transcribe(audio,{language:'ckb',apiKey:'test-key',fetcher,cacheDir});
  expect(calls).toHaveLength(1);expect(calls[0].url).toBe(ENDPOINT);expect(calls[0].key).toBe('test-key');
  expect(calls[0].body.get('timestamps_granularity')).toBe('word');expect(calls[0].body.get('language_code')).toBe('kur');
  expect(calls[0].body.get('model_id')).toBeTruthy();expect(first.cached).toBe(false);expect(first.words[0].text).toBe('سڵاو');
  const second=await transcribe(audio,{language:'ckb',apiKey:'test-key',fetcher,cacheDir});
  expect(calls).toHaveLength(1);expect(second.cached).toBe(true);
 });

 it('explains a missing key and a provider error',async()=>{
  const old=process.env.ELEVENLABS_API_KEY;delete process.env.ELEVENLABS_API_KEY;
  await expect(transcribe(audio,{cacheDir:path.join(dir,'c2')})).rejects.toThrow(/ELEVENLABS_API_KEY/);
  if(old!==undefined)process.env.ELEVENLABS_API_KEY=old;
  const fetcher=(async()=>new Response('{"detail":"quota"}',{status:401})) as unknown as typeof fetch;
  await expect(transcribe(audio,{apiKey:'k',fetcher,cacheDir:path.join(dir,'c3')})).rejects.toThrow(/401/);
 });
});

describe('captions',()=>{
 it('groups words into readable cues split at sentences and pauses',()=>{
  const words=[w('Your',0,.2),w('team',.25,.5),w('is',.55,.6),w('drowning.',.65,1.1),w('Updates',2.2,2.6),w('in',2.65,2.7),w('five',2.75,3),w('apps.',3.05,3.4)];
  const {cues}=captionsFromWords(words);
  expect(cues.map(c=>c.text)).toEqual(['Your team is drowning.','Updates in five apps.']);
  expect(cues[0].start).toBe(0);expect(cues[0].end).toBeLessThan(cues[1].start);
  const long=groupCues(Array.from({length:30},(_,i)=>({text:'word'+i,start:i*.3,end:i*.3+.25})),{maxCharsPerLine:20});
  expect(long.every(c=>c.text.split('\n').length<=2&&c.text.split('\n').every(l=>l.length<=26))).toBe(true);
  expect(long.every(c=>c.end-c.start<=4.7)).toBe(true);
 });
 it('anchors Kurdish captions to the exact script despite recogniser spelling',()=>{
  expect(normalizeWord('ڕۆژ')).toBe(normalizeWord('روژ'));
  const script='سڵاو، ئەمڕۆ ڕۆژێکی باشە.';
  const words=[w('سلاو',0,.5),w('ئەمرۆ',.6,1),w('روژیکی',1.1,1.5),w('باشه',1.6,2)];
  const {tokens,matched}=anchorToScript(words,script);
  expect(matched).toBe(4);expect(tokens.map(t=>t.text).join(' ')).toBe(script);
  const r=captionsFromWords(words,{script,language:'ckb'});
  expect(r.cues.map(c=>c.text.replace('\n',' ')).join(' ')).toBe(script);
  expect(r.source).toBe('script');
 });
});

describe('tightening',()=>{
 const words=[w('Hello',.8,1.2),w('um',1.4,1.6),w('there.',1.9,2.3),w('Second',4,4.4),w('point.',4.5,5)];
 it('cuts fillers, long pauses and dead air but keeps breaths',()=>{
  const p=planTighten(words,7,'en');
  expect(p.cuts.map(c=>c.reason)).toEqual(['start','filler','pause','end']);
  expect(p.fillerCount).toBe(1);
  const pause=p.cuts.find(c=>c.reason==='pause')!;expect(pause.start).toBeCloseTo(2.48,2);expect(pause.end).toBeCloseTo(3.82,2);
  expect(planTighten(words,7,'en',{fillers:false}).cuts.some(c=>c.reason==='filler')).toBe(false);
 });
 it('retimes captions onto the tightened edit and builds a valid edit list',()=>{
  const p=planTighten(words,7,'en');const map=timeMap(p.cuts);
  expect(map(0)).toBe(0);expect(map(4)).toBeCloseTo(4-(p.cuts[0].end-p.cuts[0].start)-(p.cuts[1].end-p.cuts[1].start)-(p.cuts[2].end-p.cuts[2].start),3);
  const edl=edlSchema.parse(tightenEdl('in.mp4',p.cuts,{cues:[{start:.8,end:2.3,text:'Hello there.'},{start:4,end:5,text:'Second point.'}],language:'en'}));
  expect(edl.operations.map(o=>o.op)).toEqual(['cut','captions']);
 });
});
