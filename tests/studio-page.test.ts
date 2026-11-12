// The Studio page: requests, the agent's inbox, step ratings that score only that step's lessons,
// picking between two looks, and the page's server.
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tl-studio-'));
const env={VIDEO_WORKSPACE:path.join(tmp,'ws'),TEMPOLOOM_BRAIN_DIR:path.join(tmp,'brain'),TEMPOLOOM_BRAIN_DB:path.join(tmp,'brain.db'),TEMPOLOOM_KNOWLEDGE_DIR:path.join(tmp,'know')},before={...process.env};
type S=typeof import('../src/engine/studio.js');type R=typeof import('../src/engine/studio-requests.js');type B=typeof import('../src/engine/brain/brain.js');
let st:S,rq:R,brain:B,closeDb:()=>void;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
beforeAll(async()=>{
 Object.assign(process.env,env);fs.mkdirSync(env.TEMPOLOOM_KNOWLEDGE_DIR,{recursive:true});
 st=await import('../src/engine/studio.js');rq=await import('../src/engine/studio-requests.js');brain=await import('../src/engine/brain/brain.js');closeDb=(await import('../src/engine/brain/db.js')).closeDb;
 brain.sync();
 for(const [id,tags] of [['t-look-a','design'],['t-look-b','design'],['t-look-both','color'],['t-scene','motion']] as const)
  brain.add({id,title:'Lesson '+id,body:'A lesson used by one step of a job, for the test.',kind:'technique',domain:'motion',tags:[tags],source:'job:x',status:'trial'});
});
afterAll(()=>{closeDb();for(const k of Object.keys(env))before[k]===undefined?delete process.env[k]:process.env[k]=before[k];fs.rmSync(tmp,{recursive:true,force:true});});
const out=(job:string,name:string,text='x')=>{const f=path.join(st.jobDir(job),name);fs.writeFileSync(f,text);return f;};
/** Does a task the way a role would. */
const run=(job:string,task:string,o:Parameters<S['done']>[2]={})=>{const s=st.start(job,task) as {writeTo?:string};
 return st.done(job,task,{applied:['none'],...(s.writeTo?{output:out(job,path.basename(s.writeTo),task==='script'?'Hook line.\nSecond line.\nCall to action.':task)}:{}),...o});};

describe('the Studio page',()=>{
 let job='';
 it('takes a motion request with only a link, and an edit with no instructions',()=>{
  const a=rq.newRequest();
  expect(()=>rq.submit(a.id,{mode:'motion'})).toThrow(/script, a prompt, a topic or a link/);
  const logo=rq.filePath(a.id,'logo','My Logo.png');fs.writeFileSync(logo,png);rq.addFile(a.id,'logo',logo);
  expect(()=>rq.filePath(a.id,'logo','two.png')).toThrow(/At most 1 logo/);
  expect(()=>rq.filePath(a.id,'footage','evil.exe')).toThrow(/must be a video/);
  rq.submit(a.id,{mode:'motion',link:'https://example.com/product',seconds:30,shape:'vertical',colors:{accent:'#FF6B4A'}});
  const e=rq.newRequest();
  expect(()=>rq.submit(e.id,{mode:'edit'})).toThrow(/Add the footage/);
  const clip=rq.filePath(e.id,'footage','talk.mp4');fs.writeFileSync(clip,'video');rq.addFile(e.id,'footage',clip);
  rq.submit(e.id,{mode:'edit'});
  const box=rq.inbox();expect(box.newRequests.map(r=>r.mode)).toEqual(['motion','edit']);
  const t=rq.take(a.id);job=t.job;
  const p=st.readPlan(job);
  expect(p.options).toEqual(['write','pick']);expect(p.request).toContain('build the video from the link');expect(p.request).toContain('Logo: ');expect(p.request).toContain('accent #FF6B4A');
  expect(p.tasks.some(x=>x.id==='style-pick'&&x.gate)).toBe(true);
  expect(()=>rq.take(a.id)).toThrow(/Already taken/);
  const ed=st.readPlan(rq.take(e.id).job);
  expect(ed.type).toBe('footage-edit');expect(ed.request).toContain('gave no instructions: decide everything');expect(ed.options).toEqual(['visuals']);
  expect(rq.inbox().newRequests).toHaveLength(0);
 });

 it('shows a step with its files, and a bad rating scores only that step and reopens only it',async()=>{
  for(const t of ['intake','brief','research','facts'])run(job,t);
  const pic=out(job,'frame.png');fs.writeFileSync(pic,png);
  run(job,'script',{applied:['t-scene'],show:[pic]});
  expect(()=>st.done(job,'script',{show:[path.join(tmp,'missing.png')]})).toThrow(/No such file to show/);
  let v=rq.overview().jobs.find(j=>j.job===job)!;
  expect(v.waitingFor).toBe('you');
  const step=v.tasks.find(t=>t.id==='script')! as {output:string;show:{name:string;type:string}[];canRate:boolean;lessons:{id:string}[]};
  expect(step.output).toContain('Hook line.');expect(step.show).toEqual([{k:0,name:'frame.png',type:'image'}]);expect(step.canRate).toBe(true);expect(step.lessons.map(l=>l.id)).toEqual(['t-scene']);
  expect(rq.shownFile(job,st.readPlan(job).tasks.findIndex(t=>t.id==='script'),'show-0')).toBe(pic);
  expect(()=>rq.shownFile(job,0,'show-9')).toThrow();
  await expect(st.rate(job,'script',{rating:'bad'})).rejects.toThrow(/Say what is wrong/);
  await expect(st.rate(job,'script-ok',{rating:'good'})).rejects.toThrow(/approval/);
  const r=await st.rate(job,'script',{rating:'ok',parts:[{part:'line 2',rating:'bad',note:'too long'}],reasons:['words']}) as {rating:string;reopened:string[];savedRule:string;goesTo:string[]};
  expect(r.rating).toBe('bad'); // a flagged part makes the step bad
  expect(r.reopened).toEqual(['script']);expect(r.goesTo).toEqual(['Scriptwriter']);expect(r.savedRule).toContain('line 2');
  expect(brain.getKnowledge('t-scene')).toMatchObject({losses:1,wins:0});
  const p=st.readPlan(job);
  expect(p.tasks.find(t=>t.id==='research')!.status).toBe('done'); // other steps are untouched
  expect(rq.inbox().jobs.find(j=>j.job===job)!.ready[0]).toMatchObject({task:'script',redo:true});
  // Redone, then rated good: a new version takes a new rating; the same version cannot be rated twice.
  run(job,'script',{applied:['t-scene']});
  expect((await st.rate(job,'script',{rating:'good'}) as {scored:{id:string}[]}).scored.map(x=>x.id)).toEqual(['t-scene']);
  await expect(st.rate(job,'script',{rating:'good'})).rejects.toThrow(/already rated/);
  expect(brain.getKnowledge('t-scene')).toMatchObject({losses:1,wins:1});
  st.approve(job,'script-ok');
 });

 it('lets the user pick one of two looks: its lessons win, the other\'s lose',()=>{
  st.start(job,'style');
  const a=out(job,'a.png'),b=out(job,'b.png');fs.writeFileSync(a,png);fs.writeFileSync(b,png);
  expect(()=>st.done(job,'style',{output:out(job,'style.md'),applied:['none']})).toThrow(/two versions/);
  st.done(job,'style',{output:out(job,'style.md'),applied:['t-look-both'],choices:[`A: Calm paper|${a}|t-look-a`,`B: Bold neon|${b}|t-look-b`]});
  expect(()=>st.approve(job,'style-pick')).toThrow(/chooses a version/);
  expect(rq.overview().jobs.find(j=>j.job===job)!.waitingFor).toBe('you');
  const r=st.pick(job,'style','B');
  expect(r).toMatchObject({picked:'B: Bold neon',won:['t-look-b'],lost:['t-look-a']});
  expect(brain.getKnowledge('t-look-b')!.wins).toBe(1);expect(brain.getKnowledge('t-look-a')!.losses).toBe(1);expect(brain.getKnowledge('t-look-both')).toMatchObject({wins:0,losses:0});
  expect(()=>st.pick(job,'style','A')).toThrow(/already picked/);
  st.approve(job,'style-pick');
  const s=st.start(job,'storyboard') as {inputs:{from:string;note?:string}[]};
  expect(s.inputs.find(i=>i.from==='style')!.note).toContain('The user picked "B: Bold neon"');
 });

 it('finishes: the final rating gives the verdict without scoring rated steps twice',async()=>{
  st.done(job,'storyboard',{output:out(job,'storyboard.md'),applied:['t-scene']});
  for(const t of ['sound','design'])run(job,t);
  st.approve(job,'design-ok');for(const t of ['build','review'])run(job,t);st.approve(job,'preview-ok');
  await expect(rq.finalRating(job,{rating:'good'})).rejects.toThrow(/not finished/);
  run(job,'final',{applied:['t-look-both']});
  const before=brain.getKnowledge('t-scene')!;
  await rq.finalRating(job,{rating:'good'});
  expect(st.readPlan(job).verdict).toBe('approved');
  expect(brain.getKnowledge('t-look-both')!.wins).toBe(1);   // the final step's own lesson, once
  expect(brain.getKnowledge('t-scene')!.wins).toBe(before.wins); // already scored by the script's rating: one job never scores a lesson twice
  expect(brain.getKnowledge('t-look-b')!.wins).toBe(1); // scored by the pick, not again by the verdict
  const o=rq.overview();expect(o.scores.steps.find(s=>s.step==='script')).toMatchObject({good:1,bad:1});expect(o.scores.rules.length).toBe(1);
 });

 it('serves the Studio page: brief, files, ratings, and only files a step showed',async()=>{
  const {serve}=await import('../src/teach/server.js');const s=await serve({port:0});
  try{
   const base=`http://127.0.0.1:${s.port}`,h={'x-teach-key':s.key},jh={...h,'content-type':'application/json'};
   expect((await fetch(base+'/studio?k='+s.key)).headers.get('content-type')).toContain('text/html');
   expect((await fetch(base+'/app.css')).status).toBe(200);
   expect((await fetch(base+'/api/studio/state')).status).toBe(403);
   const r=await (await fetch(base+'/api/studio/requests',{method:'POST',headers:h})).json() as {id:string};
   expect((await fetch(base+`/api/studio/requests/${r.id}/files?kind=logo&name=x.exe`,{method:'POST',headers:h,body:png})).status).toBe(400);
   expect((await fetch(base+`/api/studio/requests/${r.id}/files?kind=logo&name=logo.png`,{method:'POST',headers:h,body:png})).status).toBe(200);
   expect((await fetch(base+`/studio-file/request/${r.id}/logo.png`,{headers:h})).headers.get('content-type')).toBe('image/png');
   expect((await fetch(base+`/api/studio/requests/${r.id}/submit`,{method:'POST',headers:jh,body:JSON.stringify({mode:'motion'})})).status).toBe(400);
   expect((await fetch(base+`/api/studio/requests/${r.id}/submit`,{method:'POST',headers:jh,body:JSON.stringify({mode:'motion',text:'A topic: why sleep matters',seconds:30})})).status).toBe(200);
   const state=await (await fetch(base+'/api/studio/state',{headers:h})).json() as {requests:{id:string;status:string}[];jobs:{job:string;finished:boolean}[];totals:{waitingForAgent:number}};
   expect(state.requests.find(x=>x.id===r.id)!.status).toBe('waiting');expect(state.totals.waitingForAgent).toBeGreaterThan(0);
   const idx=st.readPlan(job).tasks.findIndex(t=>t.id==='script');
   expect((await fetch(base+`/studio-file/job/${job}/${idx}/show-0`,{headers:h})).status).toBe(200);
   expect((await fetch(base+`/studio-file/job/${job}/${idx}/show-5`,{headers:h})).status).toBe(404);
   expect((await fetch(base+`/api/studio/jobs/${job}/rate/sound`,{method:'POST',headers:jh,body:JSON.stringify({rating:'ok'})})).status).toBe(200);
   expect((await fetch(base+`/api/studio/jobs/${job}/rate/sound`,{method:'POST',headers:jh,body:JSON.stringify({rating:'good'})})).status).toBe(400);
   expect((await fetch(base+`/api/studio/requests/${r.id}`,{method:'DELETE',headers:h})).status).toBe(200);
  }finally{await s.close();}
 });
});
