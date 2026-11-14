// The motion kit: caption styles (word by word, karaoke, key word, ways of coming in, your own),
// transitions chosen by what a scene says, the sound layer under the voice, perfect loops, a
// product photo in motion, maps and routes from place names, and screenshots in a moving device.
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ffmpeg,run} from '../src/renderer/ffmpeg-encoder.js';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tl-kit-'));
const env={VIDEO_WORKSPACE:path.join(tmp,'ws'),TEMPOLOOM_BRAIN_DIR:path.join(tmp,'brain'),TEMPOLOOM_BRAIN_DB:path.join(tmp,'brain.db'),TEMPOLOOM_KNOWLEDGE_DIR:path.join(tmp,'know'),
 TEMPOLOOM_SETTINGS_DIR:path.join(tmp,'local'),TEMPOLOOM_STATE_FILE:path.join(tmp,'state.json'),VIDEO_OUTPUT:path.join(tmp,'out')},before={...process.env};
beforeAll(()=>{Object.assign(process.env,env);fs.mkdirSync(env.TEMPOLOOM_KNOWLEDGE_DIR,{recursive:true});});
afterAll(()=>{for(const k of Object.keys(env))before[k]===undefined?delete process.env[k]:process.env[k]=before[k];fs.rmSync(tmp,{recursive:true,force:true});});
const clip=async(name:string,size='360x640',seconds=4)=>{const f=path.join(tmp,name);await run(ffmpeg,['-v','error','-y','-f','lavfi','-i',`color=c=#203040:s=${size}:d=${seconds}:r=25`,'-f','lavfi','-i',`sine=f=200:d=${seconds}`,'-shortest','-pix_fmt','yuv420p','-c:v','libx264','-preset','ultrafast',f]);return f;};
/** The pixels of one frame, as RGB bytes. */
const frame=(file:string,t:number,crop:string)=>spawnSync(ffmpeg,['-v','error','-ss',String(t),'-i',file,'-frames:v','1','-vf',`crop=${crop},format=rgb24`,'-f','rawvideo','-'],{maxBuffer:1<<26}).stdout;
const count=(buf:Buffer,test:(r:number,g:number,b:number)=>boolean)=>{let n=0;for(let i=0;i+2<buf.length;i+=3)if(test(buf[i]!,buf[i+1]!,buf[i+2]!))n++;return n;};
const yellow=(r:number,g:number,b:number)=>r>200&&g>160&&b<60;

describe('caption styles',()=>{
 it('has built-in styles and saves your own; an edit list names one with preset',async()=>{
  const C=await import('../src/editor/caption-styles.js'),{edlSchema}=await import('../src/editor/edl.js');
  expect(C.captionStyles().default).toBe('clean');expect(C.captionStyles().styles.map(s=>s.name)).toEqual(expect.arrayContaining(['karaoke','word-pop','build-up','key-word','boxed']));
  const mine=C.saveStyle('Bold cyan',{from:'word-pop',fields:{highlight:'#00E5FF',size:.08},makeDefault:true});
  expect(mine).toMatchObject({name:'bold-cyan',yours:true,fields:{style:'word',reveal:'pop',highlight:'#00E5FF',size:.08}});
  expect(C.captionStyles().default).toBe('bold-cyan');expect(C.styleFields()).toMatchObject({style:'word',highlight:'#00E5FF'});
  expect(()=>C.saveStyle('karaoke')).toThrow(/built-in/);expect(()=>C.saveStyle('x2',{fields:{reveal:'spin'}})).toThrow(/reveal is/);
  const edl=edlSchema.parse({version:1,input:'a.mp4',operations:[{op:'captions',preset:'karaoke',reveal:'pop',cues:[{start:0,end:1,text:'Hi'}]}]});
  expect(edl.operations[0]).toMatchObject({style:'karaoke',highlight:'#FFD400',reveal:'pop'}); // the operation's own field wins
  C.removeStyle('bold-cyan');expect(C.captionStyles().default).toBe('clean');
 });
 it('keeps each word\'s time in the cues, through an edit',async()=>{
  const {groupCues}=await import('../src/editor/caption-builder.js'),{retime}=await import('../src/editor/srt.js'),{keyWord}=await import('../src/editor/captions.js');
  const cues=groupCues([{text:'Cold',start:0,end:.3},{text:'brew',start:.3,end:.6},{text:'takes',start:.6,end:.9},{text:'18',start:.9,end:1.2},{text:'hours.',start:1.2,end:1.5}]);
  expect(cues[0]!.words!.map(w=>w.text)).toEqual(['Cold','brew','takes','18','hours.']);
  expect(retime(cues,t=>t<.3?null:t-.3)).toEqual([]); // its start was cut
  expect(retime(cues,t=>t+1)[0]!.words![3]).toEqual({text:'18',start:1.9,end:2.2});
  expect(keyWord(['Cold','brew','takes','18','hours'])).toBe(3);expect(keyWord(['It','is','absolutely','worth','it'])).toBe(2);
 });
 it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('lights the word being said (karaoke), and shows one word at a time',async()=>{
  const {runEdl}=await import('../src/editor/editor.js');const input=await clip('talk.mp4');
  const cues=[{start:.2,end:2,text:'Cold brew takes hours',words:[{text:'Cold',start:.2,end:.6},{text:'brew',start:.6,end:1},{text:'takes',start:1,end:1.4},{text:'hours',start:1.4,end:2}]}];
  const k=await runEdl({version:1,input,operations:[{op:'captions',cues,language:'en',preset:'karaoke',safeArea:false,margin:.3}],export:{preset:'draft'}},tmp,{output:path.join(tmp,'karaoke.mp4')});
  expect(k.steps[0]!.note).toMatch(/karaoke, fade in/);
  // While "Cold" is said the lit word is at the start of the line; while "hours" is said, further along.
  const band='360:150:0:340',litX=(t:number)=>{const b=frame(k.output,t,band),xs:number[]=[];for(let i=0;i+2<b.length;i+=3)if(yellow(b[i]!,b[i+1]!,b[i+2]!))xs.push((i/3)%360);return xs.reduce((a,x)=>a+x,0)/Math.max(1,xs.length);};
  expect(litX(.45)).toBeLessThan(130);expect(litX(1.8)).toBeGreaterThan(litX(.45)+60);
  const w=await runEdl({version:1,input,operations:[{op:'captions',cues,language:'en',preset:'word-pop',safeArea:false,margin:.3}],export:{preset:'draft'}},tmp,{output:path.join(tmp,'words.mp4')});
  const white=(t:number)=>count(frame(w.output,t,band),(r,g,b)=>r>230&&g>230&&b>230);
  expect(white(.5)).toBeGreaterThan(50);expect(white(.5)).toBeLessThan(count(frame(k.output,.5,band),(r,g,b)=>r>230&&g>230&&b>230)); // one word, not the line
  expect(white(2.6)).toBe(0); // after the cue, nothing
 },120000);
});

describe('transitions that match what a scene says',()=>{
 it('opens gently, wipes on a turn, reveals an answer, pushes on to the next step, brings the call to action forward',async()=>{
  const {designScenes}=await import('../src/engine/storyboard.js');
  const lines=['Are you drowning in tasks every week?','But there is a better way to work.','It saves your team 10 hours a week.','Then it reminds everyone before a deadline.','Start your free trial today.'];
  const plans=designScenes(lines,{seed:'t1'});
  const ts=plans.map(p=>p.piece.transition);
  expect(ts[0]).toBe('fade');expect(['wipe','mask-reveal']).toContain(ts[1]);expect(['circle-reveal','zoom-through','mask-reveal']).toContain(ts[2]);
  expect(['push','wipe']).toContain(ts[3]);expect(['zoom-through','circle-reveal','push']).toContain(ts[4]);
  expect(plans[1]!.why).toMatch(/a turn, so a clean cut across/);expect(plans[2]!.why).toMatch(/revealed/);
 });
});

describe('the sound layer of an edit',()=>{
 it('places sounds where something moves, and keeps them under the voice',async()=>{
  const {cuesFromOps}=await import('../src/editor/sound-design.js'),{runEdl}=await import('../src/editor/editor.js');
  const cues=cuesFromOps([{op:'overlays',items:[{file:'a.mov',start:1,end:3,x:.5,y:.5,width:.6},{file:'b.mp4',start:2,end:3,x:.5,y:.5,width:1}]},{op:'punch',ranges:[{start:2.2,end:3,scale:1.2}],focusX:.5,focusY:.4}] as never,{joins:[.3]});
  // Two cues closer than 0.35 s: the stronger stays (b-roll cutting in, not the punch-in).
  expect(cues.map(c=>[c.time,c.sound])).toEqual([[.3,'impact'],[1,'pop'],[2,'whoosh']]);
  const input=await clip('voice.mp4');
  const r=await runEdl({version:1,input,operations:[{op:'sounds',cues:cues.map(c=>({time:c.time,sound:c.sound,gain:c.gain}))}],export:{preset:'draft'}},tmp,{output:path.join(tmp,'sounds.mp4')});
  expect(r.steps[0]!.note).toBe('3 sounds (library, under the voice)');
 },60000);
});

describe('perfect loops',()=>{
 it('crossfades the end into the start, and measures the seam',async()=>{
  const {runEdl}=await import('../src/editor/editor.js'),{loopSeam}=await import('../src/editor/loop.js');
  const f=path.join(tmp,'moving.mp4');await run(ffmpeg,['-v','error','-y','-f','lavfi','-i','testsrc2=s=320x240:d=4:r=25','-f','lavfi','-i','sine=d=4','-shortest','-pix_fmt','yuv420p','-c:v','libx264','-preset','ultrafast',f]);
  expect((await loopSeam(f)).seamless).toBe(false);
  const r=await runEdl({version:1,input:f,operations:[{op:'loop',crossfade:.6}],export:{preset:'draft'}},tmp,{output:path.join(tmp,'loop.mp4')});
  expect(r.steps[0]!.note).toBe('a loop with a 0.6 s crossfade (seamless)');expect(r.info.duration).toBeCloseTo(3.4,1);
  expect((await loopSeam(r.output)).seamless).toBe(true);
  await expect(runEdl({version:1,input:f,operations:[{op:'loop',crossfade:2}],export:{preset:'draft'}},tmp,{output:path.join(tmp,'loop2.mp4')})).rejects.toThrow(/too short/);
 },60000);
});

describe('places for maps',()=>{
 it('knows the region\'s cities by any of their names, asks OpenStreetMap once for others, and takes coordinates given',async()=>{
  const P=await import('../src/engine/motion-kit/places.js'),M=await import('../src/engine/motion-kit/map.js');
  expect(await P.findPlace('هەولێر')).toMatchObject({lat:36.19,lon:44.01,source:'built-in'});expect(await P.findPlace('Hewler')).toMatchObject({lat:36.19});
  expect(await P.findPlace('Our shop@36.2,44.05')).toMatchObject({name:'Our shop',lat:36.2,lon:44.05,source:'you'});
  await expect(P.findPlace('Nowhere town',{online:false})).rejects.toThrow(/@LATITUDE,LONGITUDE/);
  let asked=0;const fetcher=(async()=>{asked++;return new Response(JSON.stringify([{lat:'37.2741',lon:'42.9886'}]),{status:200});}) as unknown as typeof fetch;
  expect(await P.findPlace('Semel',{fetcher})).toMatchObject({lat:37.2741,source:'openstreetmap'});await P.findPlace('Semel',{fetcher});expect(asked).toBe(1);
  const v=M.viewFor([{lat:36.19,lon:44.01},{lat:41.01,lon:28.98}],1080,1920),a=v.project(44.01,36.19),b=v.project(28.98,41.01);
  for(const p of [a,b]){expect(p.x).toBeGreaterThan(0);expect(p.x).toBeLessThan(1080);expect(p.y).toBeGreaterThan(0);expect(p.y).toBeLessThan(1920);}
  expect(M.landPaths(v,1080,1920).length).toBeGreaterThan(3);
 });
});

describe.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('clips drawn by the motion kit',()=>{
 it('a product photo turns, floats and catches the light; without a cut-out it is a card',async()=>{
  const {productMotion}=await import('../src/engine/motion-kit/product.js'),{validateVideo}=await import('../src/renderer/ffmpeg-encoder.js');
  const png=path.join(tmp,'bottle.png');
  await run(ffmpeg,['-v','error','-y','-f','lavfi','-i','color=c=black@0:s=200x400,format=rgba','-vf',"geq=r='40':g='120':b='220':a='if(lt(abs(X-100),55)*gt(Y,70),255,0)'",'-frames:v','1',png]);
  const r=await productMotion(png,{out:path.join(tmp,'kit','product.mp4'),seconds:2,shape:'1:1',draft:true,title:'Cold brew'});
  expect(r).toMatchObject({cutOut:true,move:'orbit',width:1080,height:1080});
  await expect(validateVideo(r.file,{width:1080,height:1080,fps:30,duration:2})).resolves.toMatchObject({decodedFrames:60});
  // It moves: the first and the last frame differ.
  expect(frame(r.file,0,'1080:1080:0:0').equals(frame(r.file,1.9,'1080:1080:0:0'))).toBe(false);
 },120000);
 it('a map of places with the route drawn as it is travelled',async()=>{
  const {mapMotion}=await import('../src/engine/motion-kit/map.js');
  const r=await mapMotion(['Erbil','Duhok'],{out:path.join(tmp,'kit','map.mp4'),seconds:3,shape:'1:1',draft:true});
  expect(r.places.map(p=>p.from)).toEqual(['built-in','built-in']);expect(r.route).toBe(true);
  const accent=(t:number)=>count(frame(r.file,t,'1080:1080:0:0'),(R,G,B)=>R>220&&G>80&&G<140&&B<110);
  expect(accent(2.8)).toBeGreaterThan(accent(.6)); // more of the route at the end
 },120000);
 it('screenshots inside a moving phone',async()=>{
  const {mockupMotion}=await import('../src/engine/motion-kit/mockup.js');
  const shot=path.join(tmp,'screen.png');await run(ffmpeg,['-v','error','-y','-f','lavfi','-i','color=c=#22c55e:s=390x844','-frames:v','1',shot]);
  const r=await mockupMotion([shot],{out:path.join(tmp,'kit','phone.mp4'),seconds:2,shape:'1:1',draft:true});
  expect(r).toMatchObject({device:'phone',screenshots:1});
  expect(count(frame(r.file,1.5,'1080:1080:0:0'),(R,G,B)=>G>150&&R<80&&B<120)).toBeGreaterThan(20000); // the screenshot is on the screen
 },120000);
});
