// Checks before you look: platform safe areas (the numbers, motion layouts, edited captions and
// watermarks, the frame check, the self-check sheet) and the second opinion with a different taste.
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ffmpeg,run} from '../src/renderer/ffmpeg-encoder.js';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tl-checks-'));
const env={VIDEO_WORKSPACE:path.join(tmp,'ws'),TEMPOLOOM_BRAIN_DIR:path.join(tmp,'brain'),TEMPOLOOM_BRAIN_DB:path.join(tmp,'brain.db'),TEMPOLOOM_KNOWLEDGE_DIR:path.join(tmp,'know'),
 TEMPOLOOM_SETTINGS_DIR:path.join(tmp,'local'),TEMPOLOOM_STATE_FILE:path.join(tmp,'state.json'),TEMPOLOOM_BACKUP_DIR:path.join(tmp,'backups')},before={...process.env};
let closeDb:()=>void;
const clip=async(name:string,size:string,seconds=2)=>{const f=path.join(tmp,name);await run(ffmpeg,['-v','error','-y','-f','lavfi','-i',`testsrc2=s=${size}:d=${seconds}:r=25`,'-f','lavfi','-i',`sine=d=${seconds}`,'-shortest','-pix_fmt','yuv420p','-c:v','libx264','-preset','ultrafast',f]);return f;};
const setPlatforms=(list:string[])=>{fs.mkdirSync(env.TEMPOLOOM_SETTINGS_DIR,{recursive:true});fs.writeFileSync(path.join(env.TEMPOLOOM_SETTINGS_DIR,'settings.json'),JSON.stringify({version:1,platforms:list}));};
beforeAll(async()=>{Object.assign(process.env,env);fs.mkdirSync(env.TEMPOLOOM_KNOWLEDGE_DIR,{recursive:true});closeDb=(await import('../src/engine/brain/db.js')).closeDb;(await import('../src/engine/brain/brain.js')).sync();});
afterAll(()=>{closeDb();for(const k of Object.keys(env))before[k]===undefined?delete process.env[k]:process.env[k]=before[k];fs.rmSync(tmp,{recursive:true,force:true});});

describe('platform safe areas',()=>{
 it('keeps the widest of the chosen platforms clear, and says which one a box sits under',async()=>{
  const S=await import('../src/engine/safe-areas.js');
  expect(S.platforms()).toEqual(['tiktok','reels','shorts']); // all three until the user chooses
  expect(S.margins()).toEqual({top:.15,bottom:.35,left:.0602,right:.1778});
  setPlatforms(['tiktok']);expect(S.margins()).toEqual({top:.0677,bottom:.2521,left:.0407,right:.1296});
  expect(S.captionMargin()).toBe(.272);
  // Captions 8% from the bottom sit under the TikTok caption and buttons; a line in the middle does not.
  const low=S.unsafe({x:.1,y:.84,w:.8,h:.08});expect(low.share).toBe(1);expect(S.describe(low.hits)).toMatch(/TikTok caption and buttons \(bottom, right\)/);
  expect(S.unsafe({x:.2,y:.45,w:.6,h:.08}).share).toBe(0);
  expect(S.isVertical(1080,1920)).toBe(true);expect(S.isVertical(1080,1080)).toBe(false);
 });
 it('lays motion videos out inside the safe area, only when vertical and when the request did not choose',async()=>{
  setPlatforms(['tiktok','reels','shorts']);
  const {defaults}=await import('../src/engine/config.js');
  const v=await defaults({width:1080,height:1920} as never),h=await defaults({width:1920,height:1080} as never),own=await defaults({width:1080,height:1920,safeBottom:.2} as never);
  expect(v.safeBottom).toBe(.36);expect(v.safeTop).toBe(.16);expect(v.safeX).toBe(.188);
  expect(h.safeBottom).toBe(.22);expect(own.safeBottom).toBe(.2);
 });
 it('moves edited captions and the watermark of a vertical video clear of the buttons, unless told not to',async()=>{
  setPlatforms(['tiktok']);
  const {runEdl}=await import('../src/editor/editor.js');const input=await clip('talk.mp4','360x640');
  const cues=[{start:0,end:1.5,text:'Hello there'}];
  const r=await runEdl({version:1,input,operations:[{op:'captions',cues,language:'en',margin:.07}],export:{preset:'draft'}},tmp,{output:path.join(tmp,'safe.mp4')});
  expect(r.steps[0]!.note).toMatch(/moved clear of the platforms' buttons \(7% to 27% from the bottom\)/);
  const kept=await runEdl({version:1,input,operations:[{op:'captions',cues,language:'en',margin:.07,safeArea:false}],export:{preset:'draft'}},tmp,{output:path.join(tmp,'kept.mp4')});
  expect(kept.steps[0]!.note).not.toMatch(/moved/);
  const wide=await runEdl({version:1,input:await clip('wide.mp4','640x360'),operations:[{op:'captions',cues,language:'en',margin:.07}],export:{preset:'draft'}},tmp,{output:path.join(tmp,'wide-out.mp4')});
  expect(wide.steps[0]!.note).not.toMatch(/moved/);
 },120000);
 it('shades the button areas on frames of a vertical video, and the self-check looks at them',async()=>{
  setPlatforms(['tiktok','reels','shorts']);
  const S=await import('../src/engine/safe-areas.js'),{selfCheck}=await import('../src/engine/selfcheck.js');
  const v=await clip('vertical.mp4','540x960',3);
  const sheet=await S.safeSheet(v,path.join(tmp,'safe.jpg'));
  expect(sheet).toMatchObject({platforms:['TikTok','Instagram Reels','YouTube Shorts']});expect(fs.statSync(sheet!.file).size).toBeGreaterThan(2000);
  expect(await S.safeSheet(await clip('flat.mp4','640x360'),path.join(tmp,'flat.jpg'))).toBeNull();
  const {result}=await selfCheck(v,path.join(tmp,'self'));
  expect(result.sheets.some(s=>s.file.endsWith('safe-areas.jpg'))).toBe(true);
  expect(result.look[0]).toMatch(/under the shaded TikTok, Instagram Reels, YouTube Shorts buttons/);
 },120000);
 it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('flags text that sits under a platform\'s buttons in a rendered frame',async()=>{
  const {chromium}=await import('playwright'),{chromiumExecutable}=await import('../src/renderer/browser-path.js'),{checkFrame}=await import('../src/renderer/visual-qa.js');
  const b=await chromium.launch({executablePath:chromiumExecutable()});
  try{const p=await b.newPage({viewport:{width:540,height:960}});
   await p.setContent(`<div id="stage" style="position:absolute;inset:0;background:#111"><p style="position:absolute;left:40px;top:420px;margin:0;color:#fff;font:600 40px sans-serif">In the middle</p><p style="position:absolute;left:40px;bottom:30px;margin:0;color:#fff;font:600 40px sans-serif">Down at the bottom</p></div>`);
   const zones=[{label:'TikTok',top:130/1920,bottom:484/1920,left:44/1080,right:140/1080}];
   const r=await checkFrame(p,zones);const unsafe=r.issues.filter(i=>i.kind==='unsafe');
   expect(unsafe).toHaveLength(1);expect(unsafe[0]).toMatchObject({severity:'hard'});expect(unsafe[0]!.detail).toMatch(/"Down at the bottom" sits under the TikTok buttons/);
   expect((await checkFrame(p,[])).issues.some(i=>i.kind==='unsafe')).toBe(false);
  }finally{await b.close();}
 },60000);
 it('lets you choose the platforms in settings, and the page gets their areas',async()=>{
  const Set=await import('../src/engine/models/settings.js'),{home}=await import('../src/engine/home.js');
  expect(()=>Set.update({platforms:[]})).toThrow(/at least one platform/);
  expect(Set.update({platforms:['reels','reels']}).settings.platforms).toEqual(['reels']);
  const h=home();expect(h.safe.chosen).toEqual(['reels']);expect(h.safe.platforms.shorts).toMatchObject({label:'YouTube Shorts',right:192/1080});
 });
});

describe('the second opinion',()=>{
 const md=(s:string)=>s;
 it('reads where it disagrees, or that it agrees with everything',async()=>{
  const {opinionOf}=await import('../src/engine/studio.js');
  expect(opinionOf(md('# Second opinion\n\n## Disagree\n- 0:04 The logo is too small to read on a phone (style)\n- Scene 3 holds two seconds too long (scenes)\n\n## Agree\n- The hook works.\n'))).toEqual({points:['0:04 The logo is too small to read on a phone (style)','Scene 3 holds two seconds too long (scenes)'],none:false,agree:['The hook works.']});
  expect(opinionOf('No disagreement: the review covers everything a first-time viewer would notice.')).toMatchObject({points:[],none:true});
  expect(opinionOf('Looks good.')).toMatchObject({points:[],none:false});
 });
 it('runs after the first review with a different taste, and the user sees it before approving',async()=>{
  const st=await import('../src/engine/studio.js'),Taste=await import('../src/engine/taste.js'),R=await import('../src/engine/studio-requests.js');
  const job=st.plan('A teaser for the app',{type:'script-to-motion',job:'two-views',options:['second']}).job;
  const p=st.readPlan(job);
  expect(p.tasks.find(t=>t.id==='second')).toMatchObject({role:'critic',needs:['review']});
  expect(p.tasks.find(t=>t.id==='preview-ok')!.needs).toEqual(['review','second']);
  expect(st.plan('Another',{type:'script-to-motion',job:'one-view'}).tasks.some(t=>t.id==='second')).toBe(false);
  // Move the job to the second opinion.
  for(const t of p.tasks){if(t.id==='second')break;t.status='done';if(t.produces){t.output=path.join(st.jobDir(job),t.produces);fs.writeFileSync(t.output,t.id==='review'?'# Review\nVerdict: pass\n':'x');}}
  fs.writeFileSync(path.join(st.jobDir(job),'plan.json'),JSON.stringify(p));
  const start=st.start(job,'second') as unknown as {lens?:string;taste?:unknown;writeTo:string;inputs:{from:string}[];delegate:string};
  expect(start.lens).toMatch(/general viewer/);expect(start.taste).toBeUndefined();expect(start.inputs.map(i=>i.from)).toContain('review');expect(start.delegate).toMatch(/tempoloom-reviewer/);
  fs.writeFileSync(start.writeTo,'Fine.');
  expect(()=>st.done(job,'second',{output:start.writeTo,applied:['none']})).toThrow(/## Disagree/);
  fs.writeFileSync(start.writeTo,'## Disagree\n- 0:04 The logo is too small to read on a phone (style)\n\n## Agree\n- The hook works.\n');
  expect(st.done(job,'second',{output:start.writeTo,applied:['none']})).toMatchObject({status:'done'});
  const view=R.overview().jobs.find(j=>j.job===job)!.tasks.find(t=>t.id==='second') as {opinion:{points:string[]}};
  expect(view.opinion.points).toEqual(['0:04 The logo is too small to read on a phone (style)']);
  // With another of the user's profiles, the second reviewer judges with that one.
  Taste.create('Client A');const other=Taste.profiles().find(x=>x.name==='Client A')!.id;
  const r=R.newRequest();R.submit(r.id,{mode:'motion',text:'A teaser for the app',second:true,secondProfile:other} as never);
  const j2=R.take(r.id).job,p2=st.readPlan(j2);
  expect(p2).toMatchObject({secondProfile:other});expect(p2.options).toContain('second');
  for(const t of p2.tasks){if(t.id==='second')break;t.status='done';if(t.produces){t.output=path.join(st.jobDir(j2),t.produces);fs.writeFileSync(t.output,'x');}}
  fs.writeFileSync(path.join(st.jobDir(j2),'plan.json'),JSON.stringify(p2));
  const s2=st.start(j2,'second') as unknown as {lens?:string;taste?:{note:string}};
  expect(s2.lens).toBeUndefined();expect(s2.taste!.note).toContain(`"${other}" profile`);
 });
});
