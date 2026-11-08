import {it,expect} from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ffmpeg,run} from '../src/renderer/ffmpeg-encoder.js';
import {runEdl,mediaInfo} from '../src/editor/editor.js';
import {exportFormats,makeThumbnail} from '../src/editor/finishing.js';
import {synthesize,wordsFromAlignment,listVoices} from '../src/engine/voiceover.js';
import {voiceAlignmentSchema} from '../src/engine/voice-alignment.js';
import {requestSchema} from '../src/engine/production.js';

const tmp=()=>fs.mkdtemp(path.join(os.tmpdir(),'dz-finish-'));
const level=async(file:string,from:number,to:number)=>{
 const r=spawnSync(ffmpeg,['-hide_banner','-ss',String(from),'-to',String(to),'-i',file,'-vn','-af','bandpass=f=880:width_type=h:w=60,volumedetect','-f','null','-'],{encoding:'utf8'});
 return Number(/mean_volume: (-?[\d.]+) dB/.exec(r.stderr)?.[1]);
};

it('lowers music under speech and brings it back in the gaps',async()=>{
 const d=await tmp();
 await run(ffmpeg,['-v','error','-f','lavfi','-i','color=c=blue:s=320x240:d=8:r=25','-f','lavfi','-i','sine=f=300:d=8','-filter_complex',"[1:a]volume='if(between(t,2,5),1,0)':eval=frame[a]",'-map','0:v','-map','[a]','-c:v','libx264','-c:a','aac',path.join(d,'voice.mp4')]);
 await run(ffmpeg,['-v','error','-f','lavfi','-i','sine=f=880:d=3',path.join(d,'music.wav')]);
 const r=await runEdl({version:1,input:'voice.mp4',output:'out.mp4',operations:[{op:'music',file:'music.wav',gainDb:-10,duckDb:15}]},d);
 expect(r.steps[0]!.note).toMatch(/lowered about 15 dB under speech/);
 const quiet=await level(r.output,.5,1.5),speech=await level(r.output,3,4),after=await level(r.output,6,7);
 expect(speech).toBeLessThan(quiet-6); // ducked under speech
 expect(Math.abs(after-quiet)).toBeLessThan(3); // back up afterwards; the 3 s music loops
 expect((await mediaInfo(r.output)).duration).toBeCloseTo(8,0);
},60000);

it('exports other shapes: crop for narrower, fit over blur for wider',async()=>{
 const d=await tmp(),src=path.join(d,'promo.mp4');
 await run(ffmpeg,['-v','error','-f','lavfi','-i','testsrc2=s=540x960:d=2:r=25','-f','lavfi','-i','sine=f=440:d=2','-c:v','libx264','-c:a','aac','-shortest',src]);
 const r=await exportFormats(src,{to:['1:1','16:9','9:16']});
 const by=Object.fromEntries(r.formats.map(f=>[f.format,f]));
 expect(by['9:16']).toMatchObject({skipped:expect.stringMatching(/same shape/)});
 expect(by['1:1']).toMatchObject({mode:'fit',width:960,height:960});expect(by['16:9']).toMatchObject({mode:'fit',width:960,height:540});
 for(const f of ['1:1','16:9'])expect(await mediaInfo(by[f]!.file!)).toMatchObject({width:by[f]!.width,height:by[f]!.height,hasAudio:true});
 const wide=path.join(d,'wide.mp4');await run(ffmpeg,['-v','error','-f','lavfi','-i','testsrc2=s=1280x720:d=1:r=25',wide]);
 const v=(await exportFormats(wide,{to:['9:16'],focusX:.3})).formats[0]!;
 expect(v).toMatchObject({mode:'crop',width:720,height:1280});
 expect(path.basename(v.file!)).toBe('wide_9x16.mp4');
 expect(path.basename((await exportFormats(wide,{to:['9:16']})).formats[0]!.file!)).toBe('wide_9x16-2.mp4'); // never overwrites
},60000);

it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('makes a thumbnail from the sharpest frame with a title',async()=>{
 const d=await tmp(),src=path.join(d,'clip.mp4');
 // Blurry first half, sharp second half: the thumbnail must come from the second half.
 await run(ffmpeg,['-v','error','-f','lavfi','-i','testsrc2=s=640x360:d=4:r=25','-vf',"boxblur=enable='lt(t,2)':luma_radius=12",src]);
 const t=await makeThumbnail(src,{title:'Ship faster every week'});
 expect(t.at).toBeGreaterThan(2);expect(t.size).toBe('1280x720');
 const png=await fs.readFile(t.png);expect(png.readUInt32BE(16)).toBe(1280);
 const k=await makeThumbnail(src,{title:'تیمەکەت ڕزگار بکە',size:'9:16',logo:false});
 expect((await fs.readFile(k.png)).readUInt32BE(20)).toBe(1920);
},90000);

it('makes an ElevenLabs voice-over with word timings that video:create accepts, and caches it',async()=>{
 const d=await tmp();process.env.VIDEO_WORKSPACE=path.relative(path.resolve('.'),d);
 const text='Ship faster.';const chars=[...text];
 const body={audio_base64:Buffer.from('ID3fake-mp3-bytes').toString('base64'),alignment:{characters:chars,character_start_times_seconds:chars.map((_,i)=>i*.1),character_end_times_seconds:chars.map((_,i)=>i*.1+.1)}};
 let calls=0;const fetcher=(async(url:string,init:RequestInit)=>{calls++;expect(url).toContain('/text-to-speech/voice-1/with-timestamps');expect((init.headers as Record<string,string>)['xi-api-key']).toBe('k');
  expect(JSON.parse(String(init.body))).toMatchObject({text,model_id:'eleven_multilingual_v2'});return new Response(JSON.stringify(body));}) as unknown as typeof fetch;
 const r=await synthesize(text,{voiceId:'voice-1',apiKey:'k',fetcher});
 expect(r).toMatchObject({words:2,cached:false});
 const a=voiceAlignmentSchema.parse(JSON.parse(await fs.readFile(r.alignment,'utf8')));
 expect(a.words.map(w=>w.text)).toEqual(['Ship','faster.']);expect(a.words[1]!.start).toBeCloseTo(.5);
 expect((await synthesize(text,{voiceId:'voice-1',apiKey:'k',fetcher})).cached).toBe(true);expect(calls).toBe(1);
 await expect(synthesize(text,{apiKey:'k',fetcher})).rejects.toThrow(/Choose a voice/);
 const keep=process.env.ELEVENLABS_API_KEY;delete process.env.ELEVENLABS_API_KEY;
 await expect(synthesize(text,{voiceId:'v',fetcher})).rejects.toThrow(/ELEVENLABS_API_KEY/);
 await expect(listVoices({fetcher})).rejects.toThrow(/ELEVENLABS_API_KEY/);
 if(keep)process.env.ELEVENLABS_API_KEY=keep;delete process.env.VIDEO_WORKSPACE;
 expect(wordsFromAlignment({characters:[...'a  b'],character_start_times_seconds:[0,.1,.2,.3],character_end_times_seconds:[.1,.2,.3,.3]})).toEqual([{text:'a',start:0,end:.1},{text:'b',start:.3,end:.35}]);
});

it('accepts finishing options in a video request',()=>{
 const r=requestSchema.parse({schemaVersion:1,title:'t',script:'a',formats:['1:1','16:9'],thumbnail:{title:'Hi'}});
 expect(r).toMatchObject({formats:['1:1','16:9'],thumbnail:{title:'Hi'}});
 expect(requestSchema.safeParse({schemaVersion:1,title:'t',script:'a',formats:['2:1']}).success).toBe(false);
});
