// The taste profile, the agent's check of its own video, and its guess of the user's rating.
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ffmpeg,run} from '../src/renderer/ffmpeg-encoder.js';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tl-taste-'));
const env={VIDEO_WORKSPACE:path.join(tmp,'ws'),TEMPOLOOM_BRAIN_DIR:path.join(tmp,'brain'),TEMPOLOOM_BRAIN_DB:path.join(tmp,'brain.db'),TEMPOLOOM_KNOWLEDGE_DIR:path.join(tmp,'know')},before={...process.env};
async function clip(name:string,shot:number,beat:number){
 const out=path.join(tmp,name+'.mp4'),c=(col:string)=>['-f','lavfi','-i',`color=c=${col}:s=180x320:d=${shot}:r=25`];
 await run(ffmpeg,['-v','error','-y',...c('0x0B3B3C'),'-f','lavfi','-i',`testsrc2=s=180x320:d=${shot}:r=25`,...c('0xFF6B4A'),...c('0x334455'),...c('0xFFF1D6'),'-f','lavfi','-i',`testsrc=s=180x320:d=${shot}:r=25`,
  '-f','lavfi','-i',`aevalsrc='0.6*sin(2*PI*880*t)*exp(-30*mod(t,${beat}))':d=40:s=22050`,'-filter_complex','[0][1][2][3][4][5]concat=n=6:v=1:a=0[v]','-map','[v]','-map','6:a','-shortest','-pix_fmt','yuv420p','-c:v','libx264','-preset','ultrafast','-c:a','aac',out]);
 return out;
}
type TT=typeof import('../src/engine/teach/teach.js');type TA=typeof import('../src/engine/taste.js');type ST=typeof import('../src/engine/studio.js');
let T:TT,taste:TA,st:ST,closeDb:()=>void;const files:Record<string,string>={},ids:string[]=[];
beforeAll(async()=>{
 Object.assign(process.env,env);fs.mkdirSync(env.TEMPOLOOM_KNOWLEDGE_DIR,{recursive:true});
 T=await import('../src/engine/teach/teach.js');taste=await import('../src/engine/taste.js');st=await import('../src/engine/studio.js');closeDb=(await import('../src/engine/brain/db.js')).closeDb;
 (await import('../src/engine/brain/brain.js')).sync();
 for(const [n,s,b] of [['a',1,.5],['b',1.1,.55],['c',.96,.48],['slow',3.2,.5]] as const)files[n]=await clip(n,s,b);
 for(const n of ['a','b','c']){const d=await T.draftFromFile(files[n]!);const v=await T.teach(d.id,{title:n,verdict:'good',topics:['pacing','audio','color']});
  if(n==='a'){const l=T.learn(v.id,{text:'Cut about once a second and land each cut on a beat of the music.',topics:['pacing']});T.review(l.id!,'keep');}
  await T.finish(v.id);ids.push(v.id);}
},240000);
afterAll(()=>{closeDb();for(const k of Object.keys(env))before[k]===undefined?delete process.env[k]:process.env[k]=before[k];fs.rmSync(tmp,{recursive:true,force:true});});

describe('taste, self-check and guesses',()=>{
 it('builds the profile from examples, kept lessons and the user\'s edits',()=>{
  const b=taste.build();
  const shot=b.targets.find(t=>t.metric==='shot-length')!;
  expect(shot).toMatchObject({from:'your examples',videos:3});expect(shot.lo).toBeGreaterThan(.8);expect(shot.hi).toBeLessThan(1.3);
  expect(b.topics.find(t=>t.id==='pacing')!.lines[0]).toMatchObject({source:'lesson',on:true});
  taste.addLine('main','design','Never use stock photos of people.');
  taste.setTarget('main','brightness',{lo:20,hi:40});
  taste.setLine('main','teach-pattern-loudness',false);
  const e=taste.build();
  expect(e.targets.find(t=>t.metric==='brightness')).toMatchObject({from:'you',lo:20,hi:40});
  expect(e.targets.some(t=>t.metric==='loudness')).toBe(false);expect(e.untargeted.find(u=>u.metric==='loudness')!.offRef).toBe('teach-pattern-loudness');
  expect(e.topics.find(t=>t.id==='design')!.lines[0]).toMatchObject({source:'you',avoid:true});
  const md=taste.markdown();expect(md).toContain('Never use stock photos');expect(md).toContain('Brightness: 20 to 40');
  expect(()=>taste.setTarget('main','brightness',{lo:5,hi:1})).toThrow();
  taste.setTarget('main','brightness',null);taste.setLine('main','teach-pattern-loudness',true);
  // A profile for one client, based on two videos only: too few for patterns, so no targets from examples.
  const c=taste.create('Hawler Roasters',{videos:ids.slice(0,2)});
  expect(c.id).toBe('hawler-roasters');expect(c.targets).toHaveLength(0);expect(taste.profiles().map(p=>p.id)).toEqual(['main','hawler-roasters']);
  expect(()=>taste.remove('main')).toThrow(/main profile stays/);taste.remove('hawler-roasters');
  expect(st.start(st.plan('A 30 second ad',{type:'script-to-motion',job:'t0'}).job,'intake')).toHaveProperty('taste.targets');
 });

 it('makes the agent check its own preview, fix what is off, and only then finish',async()=>{
  const job=st.plan('A 30 second ad for cold brew',{type:'script-to-motion',job:'t1'}).job;
  const out=(n:string)=>{const f=path.join(st.jobDir(job),n);fs.writeFileSync(f,'x');return f;};
  const go=(task:string)=>{const s=st.start(job,task) as {writeTo?:string};st.done(job,task,{applied:['none'],...(s.writeTo?{output:out(path.basename(s.writeTo))}:{})});};
  for(const t of ['intake','brief','research','style','storyboard','sound','design'])go(t);st.approve(job,'design-ok');
  const s=st.start(job,'build') as {checkYourOwnVideo?:string;taste?:{targets:string[]}};
  expect(s.checkYourOwnVideo).toContain('studio check t1 build');expect(s.taste!.targets.join(' ')).toContain('Shot length');
  expect(()=>st.done(job,'build',{output:out('preview.md'),applied:['none']})).toThrow(/Watch your own video/);
  const bad=await st.check(job,'build',files.slow!);
  expect(bad.verdict).toBe('fix');expect(bad.checks.find(c=>c.metric==='shot-length')).toMatchObject({verdict:'off',role:'scenes'});
  expect(bad.checks.find(c=>c.metric==='shot-length')!.fix).toContain('cut more often');expect(bad.look.sheets.length).toBeGreaterThan(2);
  expect(fs.existsSync(path.join(st.jobDir(job),'selfcheck','build','overview.jpg'))).toBe(true);
  expect(fs.existsSync(path.join(st.jobDir(job),'selfcheck','build','_copy.mp4'))).toBe(false);
  expect(()=>st.done(job,'build',{output:out('preview.md'),applied:['none']})).toThrow(/off the user's taste.*attempt 1 of 3/s);
  const good=await st.check(job,'build',files.a!);
  expect(good).toMatchObject({verdict:'pass',attempt:2,off:0});
  const d=st.done(job,'build',{output:out('preview.md'),applied:['none'],show:[files.a!]});
  expect(d.status).toBe('done');
  expect(st.readPlan(job).tasks.find(t=>t.id==='build')!.selfcheck).toMatchObject({verdict:'pass',attempt:2});
  // When the brief asks for something else, the agent can keep it with a reason.
  const j2=st.plan('A slow, calm brand film',{type:'script-to-motion',job:'t2'}).job;const o2=(n:string)=>{const f=path.join(st.jobDir(j2),n);fs.writeFileSync(f,'x');return f;};
  for(const t of ['intake','brief','research','style','storyboard','sound','design']){const x=st.start(j2,t) as {writeTo?:string};st.done(j2,t,{applied:['none'],...(x.writeTo?{output:o2(path.basename(x.writeTo))}:{})});}
  st.approve(j2,'design-ok');st.start(j2,'build');
  expect((await st.check(j2,'build',files.slow!,{accept:'The brief asks for a slow, calm film'})).next).toContain('accepted');
  expect(st.done(j2,'build',{output:o2('preview.md'),applied:['none']}).status).toBe('done');
 },240000);

 it('guesses the rating of a step from earlier ratings, and counts how often it was right',async()=>{
  // Seven jobs whose research step the user rated: six good, one bad.
  for(let i=0;i<7;i++){const job=st.plan('Ad number '+i,{type:'script-to-motion',job:'g'+i}).job;const o=(n:string)=>{const f=path.join(st.jobDir(job),n);fs.writeFileSync(f,'x');return f;};
   for(const t of ['intake','brief','research']){const x=st.start(job,t) as {writeTo?:string};st.done(job,t,{applied:['none'],output:o(path.basename(x.writeTo!))});}
   await st.rate(job,'research',i===3?{rating:'bad',reasons:['words']}:{rating:'good'});}
  const job=st.plan('One more ad',{type:'script-to-motion',job:'g9'}).job;const o=(n:string)=>{const f=path.join(st.jobDir(job),n);fs.writeFileSync(f,'x');return f;};
  for(const t of ['intake','brief']){const x=st.start(job,t) as {writeTo?:string};st.done(job,t,{applied:['none'],output:o(path.basename(x.writeTo!))});}
  st.start(job,'research');const d=st.done(job,'research',{applied:['none'],output:o('research.md')}) as {expect?:string};
  expect(d.expect).toMatch(/From 7 earlier ratings.*probably rate it good/);
  expect(st.readPlan(job).tasks.find(t=>t.id==='research')!.predicted).toMatchObject({basis:7});
  await st.rate(job,'research',{rating:'good'});
  const r=st.predictionRecord();expect(r.judged).toBeGreaterThanOrEqual(4);expect(r.matched).toBeGreaterThan(0);expect(r.trusted).toBe(false);
 });

 it('serves the taste page',async()=>{
  const {serve}=await import('../src/teach/server.js');const s=await serve({port:0});
  try{const base=`http://127.0.0.1:${s.port}`,h={'x-teach-key':s.key,'content-type':'application/json'};
   expect((await fetch(base+'/taste.js')).status).toBe(200);
   const b=await (await fetch(base+'/api/taste',{headers:h})).json() as {id:string;targets:unknown[];topicList:unknown[]};expect(b.id).toBe('main');expect(b.targets.length).toBeGreaterThan(0);
   expect((await fetch(base+'/api/taste',{method:'POST',headers:h,body:JSON.stringify({action:'target',metric:'nonsense',lo:1,hi:2})})).status).toBe(400);
   expect((await fetch(base+'/api/taste',{method:'POST',headers:h,body:JSON.stringify({action:'add',topic:'color',text:'One warm accent colour only.'})})).status).toBe(200);
   const c=await (await fetch(base+'/api/taste',{method:'POST',headers:h,body:JSON.stringify({action:'create',name:'Client B'})})).json() as {id:string};expect(c.id).toBe('client-b');
   expect((await fetch(base+'/api/taste?profile=nope',{headers:h})).status).toBe(404);
   expect(((await (await fetch(base+'/api/studio/state',{headers:h})).json()) as {profiles:unknown[]}).profiles).toHaveLength(2);
  }finally{await s.close();}
 });
});
