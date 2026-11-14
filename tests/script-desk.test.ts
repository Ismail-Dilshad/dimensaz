// The script desk: the script doctor (scores, sources, suggestions kept or declined), its place in
// the studio (the user's script file, the scriptwriter's gate), and Trend watch.
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tl-script-'));
const env={VIDEO_WORKSPACE:path.join(tmp,'ws'),TEMPOLOOM_BRAIN_DIR:path.join(tmp,'brain'),TEMPOLOOM_BRAIN_DB:path.join(tmp,'brain.db'),TEMPOLOOM_KNOWLEDGE_DIR:path.join(tmp,'know'),
 TEMPOLOOM_SETTINGS_DIR:path.join(tmp,'local'),TEMPOLOOM_STATE_FILE:path.join(tmp,'state.json'),TEMPOLOOM_BACKUP_DIR:path.join(tmp,'backups')},before={...process.env};
let closeDb:()=>void;
beforeAll(async()=>{Object.assign(process.env,env);fs.mkdirSync(env.TEMPOLOOM_KNOWLEDGE_DIR,{recursive:true});closeDb=(await import('../src/engine/brain/db.js')).closeDb;(await import('../src/engine/brain/brain.js')).sync();});
afterAll(()=>{closeDb();for(const k of Object.keys(env))before[k]===undefined?delete process.env[k]:process.env[k]=before[k];fs.rmSync(tmp,{recursive:true,force:true});});
const SCRIPT='Hi everyone, welcome to our coffee shop.\nWe basically make the best cold brew in the city, really.\nIt is brewed for 18 hours and costs $4.50.\nCome visit us on Salim Street today.\n';

describe('the script doctor',()=>{
 it('scores every line for its job, clarity and length, and finds every figure and claim',async()=>{
  const D=await import('../src/engine/script-doctor.js');
  const d=D.doctor(SCRIPT,{seconds:20,language:'en'});
  expect(d.lines.map(l=>l.job)).toEqual(['hook','body','body','cta']);
  expect(d.lines[0]).toMatchObject({verdict:'weak'});expect(d.lines[0]!.notes[0]!.what).toMatch(/greets/);
  expect(d.lines[1]!.notes.map(n=>n.what).join(' ')).toMatch(/Filler: basically, really/);
  expect(d.lines[1]!.claims).toEqual([{text:'the best',kind:'claim',status:'doubtful'}]);
  expect(d.lines[2]!.claims.map(c=>[c.text,c.kind,c.status])).toEqual([['18','number','unsourced'],['$4.50','price','unsourced']]);
  expect(d.lines[3]).toMatchObject({verdict:'strong',score:100});
  expect(D.doctor('Ready in 2 minutes. Try it now.',{language:'en'}).unsourced).toEqual([]); // "2 minutes" is not 2 million
  expect(d.answered).toBe(false);
  // Kurdish: a greeting is caught, and the lines are measured at Sorani speed.
  const k=D.doctor('سڵاو هاوڕێیان، بەخێربێن.\nبیبینە ئەمڕۆ.',{language:'ckb'});expect(k.lines[0]!.verdict).toBe('weak');expect(k.language).toBe('ckb');
 });
 it('takes sources and suggestions; a kept line replaces the old one word for word',async()=>{
  const D=await import('../src/engine/script-doctor.js');
  const f=path.join(tmp,'script.txt');fs.writeFileSync(f,SCRIPT);
  expect(()=>D.addSource(f,3,'$4.50','not a link')).toThrow(/is a link/);
  D.addSource(f,3,'$4.50','https://example.com/menu');D.addSource(f,3,'18','https://example.com/brew');
  let d=D.doctorScript(f);expect(d.lines[2]!.claims.every(c=>c.status==='sourced')).toBe(true);
  expect(d.lines[1]!.claims[0]!.status).toBe('doubtful'); // a source covers only the claim it names
  const s=D.suggest(f,1,'Your coffee, cold and smooth, ready before you are.',{why:'A hook instead of a greeting'});
  const s2=D.suggest(f,1,'Cold brew that waits for you.');
  expect(()=>D.suggest(f,9,'x y')).toThrow(/no line 9/);
  expect(D.doctorScript(f).lines[0]!.suggestions.map(x=>x.id)).toEqual([s.id,s2.id]);
  D.keep(f,s.id);
  expect(fs.readFileSync(f,'utf8').split('\n')[0]).toBe('Your coffee, cold and smooth, ready before you are.');
  expect(D.readSide(f).suggestions.find(x=>x.id===s2.id)!.status).toBe('declined'); // its line is gone
  expect(()=>D.keep(f,s.id)).toThrow(/already kept/);
  d=D.doctorScript(f);expect(d.lines[0]!.verdict).not.toBe('weak');
  expect(()=>D.acceptAsIs(f,'')).toThrow(/why/);D.acceptAsIs(f,'The client wants "the best" as written');expect(D.doctorScript(f).answered).toBe(true);
 });
});

describe('the script doctor in the studio',()=>{
 it('makes the user\'s script the job\'s script file, and lets them keep lines until the storyboard starts',async()=>{
  const R=await import('../src/engine/studio-requests.js'),st=await import('../src/engine/studio.js'),D=await import('../src/engine/script-doctor.js');
  const r=R.newRequest();R.submit(r.id,{mode:'motion',text:SCRIPT.trim(),script:true,seconds:20} as never);
  const job=R.take(r.id).job,f=st.scriptOf(job);
  expect(fs.readFileSync(f,'utf8')).toBe(SCRIPT);
  // Every step reads the script from the file; the brief step is told to suggest, never to edit.
  {const i=st.start(job,'intake') as {writeTo?:string};const o=i.writeTo??path.join(st.jobDir(job),'intake.md');fs.writeFileSync(o,'intake');st.done(job,'intake',{output:o,applied:['none']});}
  const brief=st.start(job,'brief') as unknown as {scriptDoctor:string;inputs:{from:string;file:string}[]};
  expect(brief.scriptDoctor).toMatch(/Never change it yourself/);expect(brief.inputs.some(i=>i.from==='the script'&&i.file===f)).toBe(true);
  const s=D.suggest(f,1,'Your coffee, cold, smooth and ready before you are.');
  const view=R.overview().jobs.find(j=>j.job===job)!.script!;
  expect(view).toMatchObject({mine:true,canChange:true,open:1});
  R.scriptChoice(job,s.id,true);
  expect(fs.readFileSync(f,'utf8')).toMatch(/^Your coffee/);
  const p=st.readPlan(job);p.tasks.find(t=>t.id==='storyboard')!.status='doing';fs.writeFileSync(path.join(st.jobDir(job),'plan.json'),JSON.stringify(p));
  const s2=D.suggest(f,2,'Our cold brew steeps slowly for a smoother cup.');
  expect(()=>R.scriptChoice(job,s2.id,true)).toThrow(/storyboard is already being made/);
 });
 it('does not let the scriptwriter finish while a line is weak or a figure has no source',async()=>{
  const st=await import('../src/engine/studio.js'),D=await import('../src/engine/script-doctor.js');
  const job=st.plan('A 20 second ad for the cold brew',{type:'script-to-motion',job:'written',options:['write']}).job;
  for(const t of ['intake','brief','research','facts']){const s=st.start(job,t) as {writeTo?:string};const o=s.writeTo??path.join(st.jobDir(job),t+'.md');fs.writeFileSync(o,t);st.done(job,t,{output:o,applied:['none']});}
  const start=st.start(job,'script') as unknown as {scriptDoctor:string;writeTo:string};expect(start.scriptDoctor).toMatch(/write --doctor/);
  fs.writeFileSync(start.writeTo,SCRIPT);
  expect(()=>st.done(job,'script',{output:start.writeTo,applied:['none']})).toThrow(/weak lines 1, 3 and no source for "the best" \(line 2\), "18" \(line 3\), "\$4.50" \(line 3\)/);
  fs.writeFileSync(start.writeTo,'Your coffee, cold and ready before you are.\nOur cold brew steeps slowly for a smoother cup.\nIt costs $4.50 a glass.\nCome visit us on Salim Street today.\n');
  D.addSource(start.writeTo,3,'$4.50','https://example.com/menu');
  expect(st.done(job,'script',{output:start.writeTo,applied:['none']})).toMatchObject({status:'done'});
 });
});

describe('Trend watch',()=>{
 const titles=['5 ways to get more customers for your coffee shop','Top 10 coffee shop mistakes','How to make latte art at home','Stop doing this with your espresso','Why is your coffee bitter?','How to steam milk step by step','7 tips for latte art beginners','Barista vs home espresso'];
 const search=(list:string[])=>async(ch:string)=>ch==='tiktok'?{ok:false,items:[],error:'TikTok is not set up'}:{ok:true,items:list.map((t,i)=>({title:t,url:'https://youtu.be/x'+i,text:null}))};
 it('watches topics, sorts top results into formats with their links, and remembers what you chose',async()=>{
  const T=await import('../src/engine/trends.js'),db=await import('../src/engine/brain/db.js');
  await expect(T.check({search:search(titles)})).rejects.toThrow(/Add a topic/);
  T.addTopic('coffee shop marketing');expect(()=>T.addTopic('Coffee shop marketing')).toThrow(/already watched/);expect(()=>T.addTopic('x')).toThrow();
  const r=await T.check({search:search(titles)});
  expect(r.topics[0]).toMatchObject({topic:'coffee shop marketing',results:8,problems:{tiktok:'TikTok is not set up'}});
  const o=T.overview(),list=o.suggestions.find(s=>s.format==='list')!;
  expect(list).toMatchObject({seen:3,of:8,rising:false});expect(list.examples[0]).toMatchObject({channel:'youtube',url:'https://youtu.be/x0'});
  expect(o.suggestions.map(s=>s.format)).toEqual(expect.arrayContaining(['howto','mistakes']));
  const a=T.accept(list.id);expect(db.getKnowledge(a.lesson)).toMatchObject({kind:'trend',status:'trial'});expect(db.getKnowledge(a.lesson)!.body).toContain('https://youtu.be/x0');
  const how=T.overview().suggestions.find(s=>s.format==='howto')!;T.ignore(how.id);
  // A later check: an ignored or accepted format is not suggested again; one that grew is "rising".
  await T.check({search:search([...titles,'How to open a cafe','How to price your coffee','Top 5 cafe mistakes','Myths about cold brew'])});
  const again=T.overview();
  expect(again.suggestions.some(s=>s.format==='howto'||s.format==='list')).toBe(false);
  expect(again.suggestions.find(s=>s.format==='mistakes')!.rising).toBe(true);
  expect(again.accepted.map(s=>s.format)).toEqual(['list']);
 });
 it('is served on the page and kept in backups',async()=>{
  const {serve}=await import('../src/teach/server.js');const s=await serve({port:0,trendSearch:search(titles)});
  try{const base=`http://127.0.0.1:${s.port}`,h={'x-teach-key':s.key,'content-type':'application/json'};
   for(const f of ['/ideas.js','/script.js'])expect((await fetch(base+f)).status).toBe(200);
   expect((await (await fetch(base+'/api/trends',{method:'POST',headers:h,body:JSON.stringify({action:'add',topic:'latte art'})})).json())).toMatchObject({topic:'latte art'});
   const c=await (await fetch(base+'/api/trends/check',{method:'POST',headers:h,body:'{}'})).json() as {topics:unknown[]};expect(c.topics).toHaveLength(2);
   const doc=await (await fetch(base+'/api/script/doctor',{method:'POST',headers:h,body:JSON.stringify({text:SCRIPT,seconds:20,language:'en'})})).json() as {lines:unknown[];weak:number[]};
   expect(doc.lines).toHaveLength(4);expect(doc.weak).toContain(1);
   expect((await fetch(base+'/api/script/doctor',{method:'POST',headers:h,body:JSON.stringify({text:' '})})).status).toBe(400);
  }finally{await s.close();}
  const Bk=await import('../src/engine/backup.js');
  expect(Bk.backupBytes().manifest.files.map(f=>f.path)).toContain('local/trends.json');
 },30000);
});
