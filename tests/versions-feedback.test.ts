// Versions and feedback: every version of a step kept, compared and brought back; comments on a
// moment of a video that reopen only its scene; one history of changes to lessons, taste and
// ratings with Undo; and work that stopped continuing where it stopped (renders, edits, jobs).
import {describe,it,expect,beforeAll,afterAll,vi} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ffmpeg,ffprobe,run} from '../src/renderer/ffmpeg-encoder.js';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tl-versions-'));
const env={VIDEO_WORKSPACE:path.join(tmp,'ws'),TEMPOLOOM_BRAIN_DIR:path.join(tmp,'brain'),TEMPOLOOM_BRAIN_DB:path.join(tmp,'brain.db'),TEMPOLOOM_KNOWLEDGE_DIR:path.join(tmp,'know'),
 TEMPOLOOM_SETTINGS_DIR:path.join(tmp,'local'),TEMPOLOOM_STATE_FILE:path.join(tmp,'state.json'),TEMPOLOOM_BACKUP_DIR:path.join(tmp,'backups')},before={...process.env};
let closeDb:()=>void;
beforeAll(async()=>{Object.assign(process.env,env);fs.mkdirSync(env.TEMPOLOOM_KNOWLEDGE_DIR,{recursive:true});closeDb=(await import('../src/engine/brain/db.js')).closeDb;(await import('../src/engine/brain/brain.js')).sync();});
afterAll(()=>{closeDb();for(const k of Object.keys(env))before[k]===undefined?delete process.env[k]:process.env[k]=before[k];fs.rmSync(tmp,{recursive:true,force:true});});

const image=async(name:string,color:string)=>{const f=path.join(tmp,name);await run(ffmpeg,['-v','error','-y','-f','lavfi','-i',`color=c=${color}:s=64x64`,'-frames:v','1',f]);return f;};
/** Three scenes of 1.2 s each, in three colours: red, white, navy. */
const threeScenes=async(name:string)=>{const f=path.join(tmp,name);
 await run(ffmpeg,['-v','error','-y',...['red','white','navy'].flatMap(c=>['-f','lavfi','-i',`color=c=${c}:s=180x320:r=25:d=1.2`]),'-filter_complex','[0][1][2]concat=n=3:v=1:a=0','-pix_fmt','yuv420p','-c:v','libx264','-preset','ultrafast',f]);return f;};
type St=typeof import('../src/engine/studio.js');
/** Marks every step before `upTo` finished (with a small output), so a test can start there. */
function finishUpTo(st:St,job:string,upTo:string){
 const p=st.readPlan(job);
 for(const t of p.tasks){if(t.id===upTo)break;t.status='done';if(t.produces){t.output=path.join(st.jobDir(job),t.produces);fs.writeFileSync(t.output,t.id);}}
 fs.writeFileSync(path.join(st.jobDir(job),'plan.json'),JSON.stringify(p));
}
const finish=(st:St,job:string,task:string,text:string,o:Record<string,unknown>={})=>{const s=st.start(job,task) as unknown as {writeTo:string};fs.writeFileSync(s.writeTo,text);return st.done(job,task,{output:s.writeTo,applied:['none'],...o});};

describe('every version of a step',()=>{
 it('keeps each finished version, compares them and brings an earlier one back',async()=>{
  const st=await import('../src/engine/studio.js'),V=await import('../src/engine/studio-versions.js');
  const job=st.plan('A teaser for the app',{type:'script-to-motion',job:'kept-versions'}).job;
  expect(finish(st,job,'intake','First reading of the brief',{show:[await image('one.png','red')]})).toMatchObject({version:1});
  await st.rate(job,'intake',{rating:'bad',note:'Read the brief again: it is a teaser'});
  expect(st.readPlan(job).tasks.find(t=>t.id==='intake')!.status).toBe('redo');
  expect(finish(st,job,'intake','Second reading: a 15 second teaser',{show:[await image('two.png','blue')]})).toMatchObject({version:2});
  finish(st,job,'brief','The brief');
  const view=V.versionsView(job,'intake');
  expect(view.versions.map(v=>[v.n,v.current])).toEqual([[2,true],[1,false]]);
  expect(view.versions[1]).toMatchObject({text:'First reading of the brief',rating:{rating:'bad'},kept:true});
  // The kept copies are the files as they were, not the ones the redo wrote over.
  const v1=V.versionFile(job,'intake',1,'show-0'),v2=V.versionFile(job,'intake',2,'show-0');
  expect(path.dirname(v1)).toContain(path.join('versions','intake','v1'));expect(fs.readFileSync(v1).equals(fs.readFileSync(v2))).toBe(false);
  expect(fs.readFileSync(V.versionFile(job,'intake',1,'output'),'utf8')).toBe('First reading of the brief');
  expect(()=>V.bringBack(job,'intake',2)).toThrow(/already the current one/);
  const back=V.bringBack(job,'intake',1);
  expect(back).toMatchObject({current:3,from:1,reopened:['brief']});
  const p=st.readPlan(job),t=p.tasks.find(x=>x.id==='intake')!;
  expect(fs.readFileSync(t.output!,'utf8')).toBe('First reading of the brief');expect(t).toMatchObject({status:'done',rounds:2});expect(t.show![0]).toBe(v1);
  expect(V.versionsView(job,'intake').versions[0]).toMatchObject({n:3,current:true,from:1,rating:null});
  // A version brought back is rated like any other.
  await expect(st.rate(job,'intake',{rating:'good'})).resolves.toMatchObject({rating:'good'});
 });
});

describe('comments on a moment of a video',()=>{
 it('finds the scene at that moment and redoes only that scene',async()=>{
  const st=await import('../src/engine/studio.js'),V=await import('../src/engine/studio-versions.js'),R=await import('../src/engine/studio-requests.js'),H=await import('../src/engine/history.js');
  // The motion project the job made: three scenes of 1.2 s.
  const pid='2026-11-14_teaser_001',pdir=path.join(env.VIDEO_WORKSPACE,'projects',pid);fs.mkdirSync(pdir,{recursive:true});
  const project={scenes:[{id:'s1',text:'Cold brew',start:0,duration:1.2},{id:'s2',text:'Ready before you are',start:1.2,duration:1.2},{id:'s3',text:'Salim Street',start:2.4,duration:1.2}]};
  const save=()=>fs.writeFileSync(path.join(pdir,'project.json'),JSON.stringify(project));save();
  const job=st.plan('A teaser for the cold brew',{type:'script-to-motion',job:'comments'}).job;finishUpTo(st,job,'build');
  const video=await threeScenes('preview.mp4');
  finish(st,job,'build','The preview',{show:[video],link:pid});
  const index=st.readPlan(job).tasks.findIndex(t=>t.id==='build'),tl=await V.timeline(job,index,'show-0');
  expect(tl.source).toBe('scenes');expect(tl.scenes.map(s=>[s.n,s.start,s.end])).toEqual([[1,0,1.2],[2,1.2,2.4],[3,2.4,3.6]]);
  const card=R.overview().jobs.find(j=>j.job===job)!.tasks.find(t=>t.id==='build') as {canComment:boolean;versions:number};
  expect(card).toMatchObject({canComment:true,versions:1});
  await expect(V.comment(job,'build',[{slot:'show-0',time:9,text:'x y z'}])).rejects.toThrow(/not inside the video/);
  const r=await V.comment(job,'build',[{slot:'show-0',time:1.5,text:'Hold the green scene a little longer'},{slot:'show-0',time:2,text:'and make its words bigger'}]);
  expect(r).toMatchObject({scenes:[2],note:expect.stringMatching(/Only scene 2/)});
  const t=st.readPlan(job).tasks.find(x=>x.id==='build')!;
  expect(t.status).toBe('redo');expect(t.scope!.scenes.map(s=>s.n)).toEqual([2]);expect(Object.keys(t.scope!.keep!)).toEqual(['s1','s3']);
  expect(H.history({job}).entries[0]).toMatchObject({kind:'ratings',title:'You commented on 2 moments of Build the preview'});
  // The redo is told which scene and what the user said.
  const s=st.start(job,'build') as unknown as {onlyScenes:{scenes:{scene:number;userSaid:string[]}[]}};
  expect(s.onlyScenes.scenes).toEqual([expect.objectContaining({scene:2,userSaid:['0:01: Hold the green scene a little longer','0:02: and make its words bigger']})]);
  // Changing another scene is caught; changing only the commented one finishes.
  project.scenes[2]!.text='Visit us today';save();
  expect(()=>finish(st,job,'build','The preview, again',{show:[video]})).toThrow(/scene 3 changed too/);
  project.scenes[2]!.text='Salim Street';project.scenes[1]!.duration=1.6;project.scenes[2]!.start=2.8;save();
  expect(finish(st,job,'build','The preview, again',{show:[video]})).toMatchObject({status:'done',version:2});
  const q=st.readPlan(job);expect(q.tasks.find(x=>x.id==='build')!.scope).toBeUndefined();expect(q.comments!.every(c=>c.answered===1)).toBe(true);
  const view=R.jobView(q).tasks.find(x=>x.id==='build') as {comments:{answered:number|null;version:number}[]};
  expect(view.comments[0]).toMatchObject({version:1,answered:2});
 },60000);
 it('uses the cuts in the picture when the video is not a project\'s render',async()=>{
  const st=await import('../src/engine/studio.js'),V=await import('../src/engine/studio-versions.js');
  const job=st.plan('An edit of my footage',{type:'footage-edit',job:'cuts'}).job;
  finish(st,job,'intake','Read',{show:[await threeScenes('footage.mp4')]});
  const tl=await V.timeline(job,0,'show-0');
  expect(tl.source).toBe('cuts');expect(tl.scenes.length).toBe(3);expect(tl.scenes[1]!.start).toBeCloseTo(1.2,1);expect(tl.scenes[1]!.label).toBe('shot 2');
 },30000);
});

describe('the history, with Undo',()=>{
 it('undoes a change to a taste profile, and the undo can be undone',async()=>{
  const Taste=await import('../src/engine/taste.js'),H=await import('../src/engine/history.js');
  Taste.setLine('main','some-lesson',false);
  const e=H.history({kind:'taste'}).entries[0]!;expect(e.title).toMatch(/My taste: line switched off/);expect(e.items[0]!.what).toEqual(['1 line switched off']);
  await H.undo(e.id);expect(Taste.profile('main').off).toEqual([]);
  await expect(H.undo(e.id)).rejects.toThrow(/already undone/);
  const redo=H.history({kind:'taste'}).entries[0]!;expect(redo.title).toMatch(/^Undid: /);
  await H.undo(redo.id);expect(Taste.profile('main').off).toEqual(['some-lesson']);
  expect(H.history({kind:'taste'}).entries[0]!.title).toMatch(/^Redid: My taste/);
 });
 it('gives back only what one rating added, and leaves later changes alone',async()=>{
  const st=await import('../src/engine/studio.js'),brain=await import('../src/engine/brain/brain.js'),db=await import('../src/engine/brain/db.js'),H=await import('../src/engine/history.js');
  const L=brain.add({id:'tec-hold-hook',title:'Hold the hook for two seconds',body:'Hold the opening line on screen for two seconds before the first cut.',source:'study:test',status:'trial',tags:['pacing']}).knowledge.id;
  const job=st.plan('A teaser',{type:'script-to-motion',job:'undo-ratings'}).job;
  for(const task of ['intake','brief']){const s=st.start(job,task) as unknown as {writeTo:string};fs.writeFileSync(s.writeTo,task);st.done(job,task,{output:s.writeTo,applied:[L]});}
  await st.rate(job,'intake',{rating:'good'});const first=H.history({job}).entries[0]!;
  await st.rate(job,'brief',{rating:'good'});
  expect(db.getKnowledge(L)).toMatchObject({wins:2,status:'proven'});
  await H.undo(first.id);
  // The first rating's win is gone; the second one's win and the status it earned stay.
  expect(db.getKnowledge(L)).toMatchObject({wins:1,status:'proven'});
  expect(st.readPlan(job).ratings!.map(r=>r.task)).toEqual(['brief']);
  await expect(st.rate(job,'intake',{rating:'ok'})).resolves.toMatchObject({rating:'ok'});
 });
 it('undoes a bad rating: the rule it saved, the step it reopened and the rating itself',async()=>{
  const st=await import('../src/engine/studio.js'),fb=await import('../src/engine/feedback.js'),db=await import('../src/engine/brain/db.js'),H=await import('../src/engine/history.js');
  const job=st.plan('Another teaser',{type:'script-to-motion',job:'undo-bad'}).job;finish(st,job,'intake','Read');
  const rules=await fb.listLessons();
  const r=await st.rate(job,'intake',{rating:'bad',note:'The colours clash with the brand palette'}) as {savedRule:string};
  const rule=(await fb.listLessons()).find(l=>l.rule===r.savedRule)!;expect(rule).toBeTruthy();expect(db.getKnowledge(rule.id)).toBeTruthy();
  expect(st.readPlan(job).tasks[0]!.status).toBe('redo');
  const e=H.history({job}).entries[0]!;expect(e.items.map(i=>i.store).sort()).toEqual(expect.arrayContaining(['lesson','plan','rule']));
  const u=await H.undo(e.id);expect(u.kept).toBeUndefined();
  // The rules and the lessons are as they were before the rating.
  expect(await fb.listLessons()).toEqual(rules);expect(db.getKnowledge(rule.id)?.title??null).not.toBe(r.savedRule.slice(0,100));
  const p=st.readPlan(job);expect(p.tasks[0]!.status).toBe('done');expect(p.ratings).toEqual([]);expect(p.feedback).toEqual([]);
 });
 it('keeps a rule a later change strengthened, giving back only one "seen"',async()=>{
  const fb=await import('../src/engine/feedback.js'),H=await import('../src/engine/history.js');
  await fb.addFeedback({said:'The captions are too small to read on a phone'});const first=H.history().entries[0]!;
  await fb.addFeedback({said:'The captions are too small to read on a phone, again'});
  const id=(await fb.listLessons()).find(l=>/captions are too small/.test(l.rule))!.id;
  expect((await fb.listLessons()).find(l=>l.id===id)!.count).toBe(2);
  const u=await H.undo(first.id);
  expect(u.kept!.join(' ')).toMatch(/later change uses it/);expect((await fb.listLessons()).find(l=>l.id===id)!.count).toBe(1);
 });
 it('is on the page, kept in backups, and undone from there',async()=>{
  const {serve}=await import('../src/teach/server.js'),Taste=await import('../src/engine/taste.js'),Bk=await import('../src/engine/backup.js');
  Taste.addLine('main','pacing','Cut on the beat in the first five seconds.');
  const s=await serve({port:0});
  try{const base=`http://127.0.0.1:${s.port}`,h={'x-teach-key':s.key,'content-type':'application/json'};
   expect((await fetch(base+'/history.js')).status).toBe(200);
   const list=await (await fetch(base+'/api/history?kind=taste',{headers:h})).json() as {entries:{id:string;title:string}[];counts:Record<string,number>};
   expect(list.entries[0]!.title).toMatch(/own line added/);expect(list.counts.ratings).toBeGreaterThan(0);
   const u=await (await fetch(`${base}/api/history/${list.entries[0]!.id}/undo`,{method:'POST',headers:h,body:'{}'})).json() as {note:string};
   expect(u.note).toBe('Undone.');expect(Taste.profile('main').added).toEqual([]);
   expect((await fetch(`${base}/api/history/h-nothing/undo`,{method:'POST',headers:h,body:'{}'})).status).toBe(400);
  }finally{await s.close();}
  expect(Bk.backupBytes().manifest.files.map(f=>f.path)).toContain('local/history.json');
 },30000);
});

describe('work that stopped continues where it stopped',()=>{
 it('splits a video into scene pieces that cover every frame once',async()=>{
  const {sceneRanges}=await import('../src/renderer/scene-render.js');
  expect(sceneRanges({scenes:[{start:0},{start:1.2},{start:2.4}]} as never,{fps:30},3.6)).toEqual([{scene:1,from:0,to:36},{scene:2,from:36,to:72},{scene:3,from:72,to:108}]);
  expect(sceneRanges({scenes:[{start:.5},{start:.5}]} as never,{fps:10},1)).toEqual([{scene:1,from:0,to:5},{scene:2,from:5,to:10}]);
 });
 it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('renders scene by scene; a render that failed continues from its last finished scene',async()=>{
  const {chromium}=await import('playwright'),{chromiumExecutable}=await import('../src/renderer/browser-path.js'),S=await import('../src/renderer/scene-render.js'),{validateVideo}=await import('../src/renderer/ffmpeg-encoder.js');
  const b=await chromium.launch({executablePath:chromiumExecutable()});
  const page=async(failAfter=Infinity)=>{const p=await b.newPage({viewport:{width:160,height:288}});
   await p.setContent(`<body style="margin:0"><div id="s" style="width:100vw;height:100vh"></div><script>window.render=t=>{if(t>=${failAfter===Infinity?'1e9':failAfter})throw new Error('the browser crashed');document.getElementById('s').style.background=t<1.2?'red':t<2.4?'green':'blue';};</script></body>`);return p;};
  const projectDir=path.join(tmp,'render-project'),c={fps:30,width:160,height:288,codec:'libx264',preset:'ultrafast',crf:30,pixelFormat:'yuv420p'} as never;
  const p={scenes:[{start:0},{start:1.2},{start:2.4}]} as never,o={projectDir,fingerprint:'f'.repeat(64)};
  try{
   await expect(S.renderByScene([await page(1.5)],p,c,3.6,path.join(tmp,'first.mp4'),o)).rejects.toThrow(/crashed/);
   expect(await S.piecesLeft(projectDir,o.fingerprint,'libx264')).toBe(1);
   const log=vi.spyOn(console,'error').mockImplementation(()=>{});
   const r=await S.renderByScene([await page()],p,c,3.6,path.join(tmp,'second.mp4'),o),said=log.mock.calls.flat().join(' ');log.mockRestore();
   expect(r).toMatchObject({scenes:3,reused:1,rendered:2});expect(said).toMatch(/Continuing from scene 2 of 3/);
   await expect(validateVideo(path.join(tmp,'second.mp4'),{width:160,height:288,fps:30,duration:3.6,audio:false})).resolves.toMatchObject({decodedFrames:108});
   // The first scene came from the stopped render, and it is in the right place.
   const at=async(t:number)=>(await run(ffmpeg,['-v','error','-ss',String(t),'-i',path.join(tmp,'second.mp4'),'-frames:v','1','-vf','scale=1:1','-f','rawvideo','-pix_fmt','rgb24','-'])).length;
   expect(await at(.5)).toBeGreaterThan(0);
   await S.dropPieces(r.dir);expect(fs.existsSync(r.dir)).toBe(false);
   expect(await S.dropStalePieces(projectDir,'0'.repeat(64))).toEqual([]);
  }finally{await b.close();}
 },60000);
 it('an edit that failed continues from its last finished step',async()=>{
  const {runEdl}=await import('../src/editor/editor.js');
  const input=path.join(tmp,'talk.mp4');await run(ffmpeg,['-v','error','-y','-f','lavfi','-i','testsrc2=s=320x240:d=2:r=25','-f','lavfi','-i','sine=d=2','-shortest','-pix_fmt','yuv420p','-c:v','libx264','-preset','ultrafast',input]);
  const edl={version:1,input,operations:[{op:'speed',factor:2},{op:'overlay',file:'logo.png',start:0,end:.5}],export:{preset:'draft'}};
  await expect(runEdl(edl,tmp,{output:path.join(tmp,'edit.mp4')})).rejects.toThrow(/1 finished step is kept/);
  await run(ffmpeg,['-v','error','-y','-f','lavfi','-i','color=c=white:s=64x64','-frames:v','1',path.join(tmp,'logo.png')]);
  const log=vi.spyOn(console,'error').mockImplementation(()=>{});
  const r=await runEdl(edl,tmp,{output:path.join(tmp,'edit.mp4')}),said=log.mock.calls.flat().join(' ');log.mockRestore();
  expect(said).toMatch(/Continued the edit from step 2/);
  expect(r.info.duration).toBeCloseTo(1,0);
 },60000);
 it('a studio job that stopped in a step says so, and how to continue',async()=>{
  const st=await import('../src/engine/studio.js'),L=await import('../src/engine/studio-live.js'),ev=await import('../src/engine/studio-events.js');
  const job=st.plan('A teaser that stopped',{type:'script-to-motion',job:'stopped'}).job;
  st.start(job,'intake');ev.say(job,'intake','director','Reading the brief');
  fs.writeFileSync(path.join(st.jobDir(job),'intake.md'),'half of it');
  expect(L.live(job).driver.state).toBe('working');
  // Two hours of silence.
  const old=new Date(Date.now()-2*3600_000).toISOString(),f=ev.eventsFile(job);
  fs.writeFileSync(f,fs.readFileSync(f,'utf8').split('\n').filter(Boolean).map(l=>JSON.stringify({...JSON.parse(l),at:old})).join('\n')+'\n');
  const p=st.readPlan(job);p.tasks[0]!.started=old;fs.writeFileSync(path.join(st.jobDir(job),'plan.json'),JSON.stringify(p));
  const v=L.live(job);expect(v.driver).toMatchObject({state:'stopped',label:expect.stringMatching(/^Stopped during: Read the request/)});
  expect(v.continueWith).toMatch(/studio resume stopped/);expect(v.team.find(m=>m.id==='director')!.face).toBe('sleeping');
  const r=st.resume(job);
  expect(r.stopped[0]).toMatchObject({task:'intake',lastSaid:'Reading the brief',outputSoFar:path.join(st.jobDir(job),'intake.md'),continue:'pnpm tempoloom studio start stopped intake'});
 });
});
