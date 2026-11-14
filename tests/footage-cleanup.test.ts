// Footage clean-up: shaky clips measured, steadied or flagged as too shaky; private details blurred
// when asked (following what they cover, the speaker kept); screen recordings polished (a cursor
// highlight, zooms where clicks change the screen, the waiting trimmed).
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ffmpeg,run} from '../src/renderer/ffmpeg-encoder.js';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tl-cleanup-'));
const env={VIDEO_WORKSPACE:path.join(tmp,'ws'),TEMPOLOOM_BRAIN_DIR:path.join(tmp,'brain'),TEMPOLOOM_BRAIN_DB:path.join(tmp,'brain.db'),TEMPOLOOM_KNOWLEDGE_DIR:path.join(tmp,'know'),
 TEMPOLOOM_SETTINGS_DIR:path.join(tmp,'local'),TEMPOLOOM_STATE_FILE:path.join(tmp,'state.json'),TEMPOLOOM_BACKUP_DIR:path.join(tmp,'backups')},before={...process.env};
let closeDb:()=>void;
beforeAll(async()=>{Object.assign(process.env,env);fs.mkdirSync(env.TEMPOLOOM_KNOWLEDGE_DIR,{recursive:true});closeDb=(await import('../src/engine/brain/db.js')).closeDb;(await import('../src/engine/brain/brain.js')).sync();});
afterAll(()=>{closeDb();for(const k of Object.keys(env))before[k]===undefined?delete process.env[k]:process.env[k]=before[k];fs.rmSync(tmp,{recursive:true,force:true});});

let still='';
/** A still picture filmed by a hand that shakes by `amp` pixels (0: a tripod). */
const handheld=async(name:string,amp:number,o:{audio?:boolean}={})=>{
 if(!still){still=path.join(tmp,'still.png');await run(ffmpeg,['-v','error','-y','-f','lavfi','-i','testsrc2=s=720x420:r=30:d=1','-frames:v','1',still]);}
 const f=path.join(tmp,name);
 await run(ffmpeg,['-v','error','-y','-loop','1','-i',still,...(o.audio?['-f','lavfi','-i','sine=d=3']:[]),'-t','3','-r','30','-vf',`crop=640:360:40+${amp}*sin(t*13)+${amp/3}*sin(t*37):30+${amp*.8}*cos(t*17)`,'-pix_fmt','yuv420p','-c:v','libx264','-preset','ultrafast',...(o.audio?['-shortest','-c:a','aac']:[]),f]);return f;};

describe('shaky footage',()=>{
 it('reads the camera\'s movement and measures the shake against its smooth path',async()=>{
  const S=await import('../src/editor/steady.js');
  const moves=S.parseTrf('VID.STAB 1\n# x\nFrame 1 (List 0 [])\nFrame 2 (List 3 [(LM 4 -2 10 10 32 0.5 0.1),(LM 5 -2 40 10 32 0.5 0.1),(LM 30 9 70 10 32 0.5 0.1)])\n');
  expect(moves).toEqual([{dx:0,dy:0},{dx:5,dy:-2}]);
  expect(S.jitter(Array.from({length:30},()=>({dx:2,dy:0})),30).mean).toBeLessThan(.01); // a steady pan is not shake
  expect(S.jitter(Array.from({length:30},(_,i)=>({dx:i%2?6:-6,dy:0})),30).mean).toBeGreaterThan(2);
 });
 it('says whether a clip is steady, can be fixed, or is too shaky to save, and steadies it',async()=>{
  const S=await import('../src/editor/steady.js');
  const tripod=await S.measureShake(await handheld('tripod.mp4',0)),hand=await S.measureShake(await handheld('hand.mp4',4)),wild=await S.measureShake(await handheld('wild.mp4',30));
  expect(tripod.verdict).toBe('steady');expect(hand).toMatchObject({verdict:'fix'});expect(hand.why).toMatch(/stabilising fixes it/);
  expect(wild.verdict).toBe('too-shaky');expect(wild.why).toMatch(/^Too shaky to save/);
  const r=await S.stabilize(path.join(tmp,'hand.mp4'));
  expect(r.output).toMatch(/hand-stabilized\.mp4$/);expect(r.shakeAfter).toBeLessThan(hand.shake/2);
  await expect(S.stabilize(path.join(tmp,'hand.mp4'),{out:r.output})).rejects.toThrow(/never overwriting/);
 },120000);
 it('steadies in an edit list, keeping the sound',async()=>{
  const {runEdl}=await import('../src/editor/editor.js');
  const r=await runEdl({version:1,input:await handheld('talk.mp4',4,{audio:true}),operations:[{op:'steady'}],export:{preset:'draft'}},tmp,{output:path.join(tmp,'steady-edit.mp4')});
  expect(r.steps[0]!.note).toMatch(/^steadied: shake [\d.]+ → [\d.]+$/);expect(r.info.hasAudio).toBe(true);
 },120000);
});

describe('private details, blurred when asked',()=>{
 it('knows a phone number (in any digits) and a number plate from other text',async()=>{
  const P=await import('../src/editor/privacy.js');
  expect(P.classifyText({box:[.5,.5,.3,.05],text:'Call 0750 123 4567'})).toMatchObject({kind:'phone',text:'0750 123 4567'});
  expect(P.classifyText({box:[.1,.1,.3,.05],text:'پەیوەندی: ٠٧٥٠١٢٣٤٥٦٧'})).toMatchObject({kind:'phone'});
  expect(P.classifyText({box:[.1,.1,.15,.05],text:'AB 12 345'})).toMatchObject({kind:'plate',text:'AB12345'});
  expect(P.classifyText({box:[.1,.1,.3,.05],text:'Open at 9'})).toBeNull();
  expect(P.classifyText({box:[.1,.1,.06,.05],text:'2026'})).toBeNull();
 });
 it('follows each face but the speaker\'s through the video, and each plate and number',async()=>{
  const P=await import('../src/editor/privacy.js');
  const samples=Array.from({length:8},(_,i)=>({time:i*.5,faces:[{box:[.1,.2,.25,.4] as [number,number,number,number],score:.9},...(i>=2&&i<=5?[{box:[.7+i*.01,.2,.04,.07] as [number,number,number,number],score:.8}]:[])],
   texts:i===3?[{box:[.6,.8,.15,.05] as [number,number,number,number],text:'KRD 4521',score:.8}]:[]}));
  const r=P.regions({width:1280,height:720,step:.5,faces:true,text:true,samples,notes:[]});
  expect(r.speaker).toBe(true);expect(r.counts).toEqual({faces:1,plates:1,phones:0});
  const face=r.regions.find(x=>x.kind==='face')!;expect(face.start).toBeCloseTo(.65,2);expect(face.keys).toHaveLength(4);expect(face.keys[3]!.x).toBeGreaterThan(face.keys[0]!.x);
  expect(P.regions({width:1280,height:720,step:.5,faces:true,text:true,samples,notes:[]},{allFaces:true}).counts.faces).toBe(2);
  expect(P.regions({width:1280,height:720,step:.5,faces:true,text:true,samples,notes:[]},{plates:false}).counts.plates).toBe(0);
 });
 it('blurs an area that follows what it covers, only while it is there',async()=>{
  const {runEdl}=await import('../src/editor/editor.js');
  const src=path.join(tmp,'sharp.mp4');await run(ffmpeg,['-v','error','-y','-f','lavfi','-i','testsrc2=s=640x360:d=2:r=25','-pix_fmt','yuv420p','-c:v','libx264','-preset','ultrafast',src]);
  const out=path.join(tmp,'blurred.mp4');
  const r=await runEdl({version:1,input:src,operations:[{op:'blur',regions:[{kind:'you',start:.5,end:2,keys:[{t:.5,x:.1,y:.1,w:.3,h:.3},{t:2,x:.5,y:.4,w:.3,h:.3}]}]}],export:{preset:'draft'}},tmp,{output:out});
  expect(r.steps[0]!.note).toBe('blurred: 1 area');
  // The sharpest edge where the area is, compared with the same place in the original: lower once it is blurred.
  const {execFileSync}=await import('node:child_process');
  const detail=async(f:string,t:number,x:number,y:number)=>{const raw=execFileSync(ffmpeg,['-v','error','-ss',String(t),'-i',f,'-frames:v','1','-vf',`crop=96:64:${x}:${y},format=gray`,'-f','rawvideo','-']);
   let d=0;for(let i=1;i<raw.length;i++)if(i%96)d=Math.max(d,Math.abs(raw[i]!-raw[i-1]!));return d;}; // the sharpest edge
  expect(await detail(out,.6,80,50)).toBeLessThan(await detail(src,.6,80,50)*.6);
  expect(await detail(out,.2,80,50)).toBeGreaterThan(await detail(src,.2,80,50)*.8); // before it starts: untouched
 },60000);
 it.skipIf(process.env.RUN_MEDIA_TESTS!=='1')('finds faces, a plate and a phone number in footage with the media tools',async()=>{
  const P=await import('../src/editor/privacy.js');
  const r=await P.findPrivate(process.env.PRIVATE_SAMPLE!,{step:1});
  expect(r.counts).toMatchObject({faces:1,plates:1,phones:1});expect(r.speaker).toBe(true);
 },120000);
});

describe('screen recordings',()=>{
 it('uses a recorder\'s log for the cursor and the clicks, zooms there and trims the waiting',async()=>{
  const S=await import('../src/editor/screen.js'),{runEdl}=await import('../src/editor/editor.js');
  const rec=path.join(tmp,'screen.mp4');await run(ffmpeg,['-v','error','-y','-f','lavfi','-i','color=c=#f5f6f8:s=1280x720:d=8:r=30','-pix_fmt','yuv420p','-c:v','libx264','-preset','ultrafast',rec]);
  const log=path.join(tmp,'cursor.json');fs.writeFileSync(log,JSON.stringify({cursor:[{t:0,x:640,y:360},{t:1,x:200,y:160},{t:6,x:200,y:160},{t:7,x:900,y:440}],clicks:[{t:1.2,x:200,y:160}]}));
  const plan=await S.analyzeScreen(rec,{log});
  expect(plan.found).toBe('log');expect(plan.clicks).toEqual([{t:1.2,x:.1563,y:.2222,why:'from the recorder\'s log'}]);
  expect(plan.zooms[0]).toMatchObject({start:.85,end:4.2,x:.1563,y:.2222});
  expect(plan.waits[0]!.start).toBeCloseTo(4.2,1);expect(Math.abs(plan.waits[0]!.end-5.7)).toBeLessThan(.15); // 0.3 s before the cursor moves again
  const ops=S.screenOps(plan);expect(ops.map(o=>o.op)).toEqual(['cursor','zooms','cut']);
  const r=await runEdl({version:1,input:rec,operations:ops,export:{preset:'draft'}},tmp,{output:path.join(tmp,'polished.mp4')});
  expect(r.info.duration).toBeCloseTo(8-1.5,0);expect(r.steps.map(s=>s.note)).toEqual(['cursor highlighted, 1 click ringed','1 zoom in and out',undefined]);
 },90000);
 it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('finds the cursor and the clicks in the picture itself',async()=>{
  const {chromium}=await import('playwright'),{chromiumExecutable}=await import('../src/renderer/browser-path.js'),{frames}=await import('../src/renderer/frame-renderer.js'),S=await import('../src/editor/screen.js');
  const b=await chromium.launch({executablePath:chromiumExecutable()}),p=await b.newPage({viewport:{width:1280,height:720}});
  await p.setContent(`<body style="margin:0;font:16px sans-serif;background:#f5f6f8"><button style="position:absolute;left:120px;top:140px;width:160px;height:44px">Settings</button>
   <div id="p1" style="position:absolute;left:120px;top:200px;width:420px;height:260px;background:#fff;border:1px solid #ccc;display:none"><h3 style="margin:16px">Settings</h3></div>
   <svg id="c" width="24" height="34" viewBox="-1 -1 14 22" style="position:absolute;left:0;top:0"><path d="M0 0 L0 17 L4 13.2 L7 20 L9.6 19 L6.6 12.2 L12 12.2 Z" fill="#fff" stroke="#000" stroke-width="1.2"/></svg>
   <script>const K=[[0,640,360],[1.5,200,160],[8,200,160]];window.render=t=>{let i=0;while(i<K.length-2&&K[i+1][0]<=t)i++;const a=K[i],b=K[i+1],u=Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0]))),e=u*u*(3-2*u);
    const c=document.getElementById('c');c.style.left=(a[1]+(b[1]-a[1])*e)+'px';c.style.top=(a[2]+(b[2]-a[2])*e)+'px';document.getElementById('p1').style.display=t>=2.4?'block':'none';};</script></body>`);
  const rec=path.join(tmp,'screen-live.mp4');
  try{await frames([p],{fps:30,width:1280,height:720,codec:'libx264',preset:'ultrafast',crf:20,pixelFormat:'yuv420p'} as never,8,rec);}finally{await b.close();}
  const plan=await S.analyzeScreen(rec);
  expect(plan.found).toBe('picture');
  const at=plan.cursor.at(-1)!; // where it came to rest (points are kept while it moves)
  expect(at.x).toBeCloseTo(200/1280,1);expect(at.y).toBeCloseTo(160/720,1);
  expect(plan.clicks).toHaveLength(1);expect(plan.clicks[0]!.t).toBeGreaterThan(1.9);expect(plan.clicks[0]!.t).toBeLessThan(2.6);
  expect(plan.waits.length).toBe(1);
 },90000);
});

describe('clean-up in an edit by text',()=>{
 it('steadies the picture after measuring it, and blurs only what was asked',async()=>{
  const T=await import('../src/editor/text-edit.js');
  const words=['Steady','footage','please.'].map((w,i)=>({text:w,start:.3+i*.6,end:.8+i*.6,type:'word' as const}));
  const d=await T.createDoc(await handheld('speak.mp4',4,{audio:true}),{transcript:{language:'en',words},title:'Shaky talk'});
  const v=await T.setSteady(d.id,true);expect(v.steady).toMatchObject({on:true,verdict:'fix'});
  expect((T.setBlur(d.id,{plates:true}) as {blur:unknown}).blur).toEqual({faces:false,plates:true,phones:false,allFaces:false});
  expect((T.setBlur(d.id,{}) as {blur:unknown}).blur).toBeNull();
  const c=T.compile(T.readDoc(d.id));expect(c.edl.operations[0]).toEqual({op:'steady',smoothing:1});
  const {serve}=await import('../src/teach/server.js'),sv=await serve({port:0});
  try{const h={'x-teach-key':sv.key,'content-type':'application/json'},post=(b:object)=>fetch(`http://127.0.0.1:${sv.port}/api/text/${d.id}`,{method:'POST',headers:h,body:JSON.stringify(b)});
   expect((await (await post({action:'blur',faces:true})).json() as {blur:{faces:boolean}}).blur.faces).toBe(true);
   expect((await (await post({action:'steady',on:false})).json() as {steady:{on:boolean}}).steady.on).toBe(false);
  }finally{await sv.close();}
 },60000);
});
