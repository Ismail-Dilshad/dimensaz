// Teaching the brain with videos: measuring, the noise filters, patterns, deletion and the page's server.
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ffmpeg,run} from '../src/renderer/ffmpeg-encoder.js';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tl-teach-'));
const env={VIDEO_WORKSPACE:path.join(tmp,'ws'),TEMPOLOOM_BRAIN_DIR:path.join(tmp,'brain'),TEMPOLOOM_BRAIN_DB:path.join(tmp,'brain.db'),TEMPOLOOM_KNOWLEDGE_DIR:path.join(tmp,'know')},before={...process.env};
/** A test video: six shots of `shot` seconds, with a click every `beat` seconds. */
async function clip(name:string,shot:number,beat:number){
 const out=path.join(tmp,name+'.mp4'),c=(col:string)=>['-f','lavfi','-i',`color=c=${col}:s=180x320:d=${shot}:r=25`];
 await run(ffmpeg,['-v','error','-y',...c('0x0B3B3C'),'-f','lavfi','-i',`testsrc2=s=180x320:d=${shot}:r=25`,...c('0xFF6B4A'),...c('0x334455'),...c('0xFFF1D6'),'-f','lavfi','-i',`testsrc=s=180x320:d=${shot}:r=25`,
  '-f','lavfi','-i',`aevalsrc='0.6*sin(2*PI*880*t)*exp(-30*mod(t,${beat}))':d=40:s=22050`,'-filter_complex','[0][1][2][3][4][5]concat=n=6:v=1:a=0[v]','-map','[v]','-map','6:a','-shortest','-pix_fmt','yuv420p','-c:v','libx264','-preset','ultrafast','-c:a','aac',out]);
 return out;
}
type TT=typeof import('../src/engine/teach/teach.js');
let T:TT,closeDb:()=>void,files:Record<string,string>={};
beforeAll(async()=>{
 Object.assign(process.env,env);
 T=await import('../src/engine/teach/teach.js');closeDb=(await import('../src/engine/brain/db.js')).closeDb;
 (await import('../src/engine/brain/brain.js')).sync();
 for(const [n,s,b] of [['a',1,.5],['b',1.2,.6],['c',.96,.48],['far',4,.5],['bad1',3,.5],['bad2',3.4,.5]] as const)files[n]=await clip(n,s,b);
},180000);
afterAll(()=>{closeDb();for(const k of Object.keys(env))before[k]===undefined?delete process.env[k]:process.env[k]=before[k];fs.rmSync(tmp,{recursive:true,force:true});});
const teachFile=async(name:string,o:Partial<import('../src/engine/teach/teach.js').TeachInput>={})=>{const d=await T.draftFromFile(files[name]!);return T.teach(d.id,{title:name,verdict:'good',topics:['pacing','audio','transitions'],...o});};

describe('teach',()=>{
 let first='';
 it('measures a video, prepares frame sheets and keeps the original file',async()=>{
  const v=await teachFile('a',{prompt:'learn the cut rhythm',marks:[{t:2,note:'the cut'}]});first=v.id;
  expect(v.status).toBe('waiting');
  const m=v.measured!;
  expect(m.pacing.cuts).toBe(5);expect(m.pacing.shotMedian).toBeCloseTo(1,1);expect(m.pacing.firstCut).toBeCloseTo(1,1);
  expect(m.sound!.bpm).toBeGreaterThan(110);expect(m.sound!.bpm).toBeLessThan(130);expect(m.sound!.cutsOnBeat).toBeGreaterThan(.7);
  expect(m.color.brightness).toBeGreaterThan(.2);expect(v.fingerprint).toHaveLength(83);
  const dir=T.studyDir(v.id);
  expect(fs.readdirSync(dir).sort()).toEqual(['sheets','study.mp4']); // the upload copy and its preview are gone
  expect(v.sheets.map(s=>path.basename(s.file))).toEqual(expect.arrayContaining(['overview.jpg','opening.jpg','cuts.jpg','mark-1.jpg']));
  expect(fs.existsSync(files.a!)).toBe(true);
  const n=T.next() as {video:{id:string;learnOnly:string[]};look:unknown[];how:string[]};
  expect(n.video.id).toBe(v.id);expect(n.look.length).toBeGreaterThan(3);expect(n.how.join(' ')).toContain('teach finish');
 },120000);

 it('trims and crops the part to study',async()=>{
  const d=await T.draftFromFile(files.a!);
  const v=await T.teach(d.id,{title:'part',verdict:'good',topics:['pacing'],segment:{start:1,end:4},crop:{x:0,y:.3,w:1,h:.4},marks:[{t:2,note:'in'},{t:5,note:'outside'}],sound:false});
  expect(v.measured!.media.seconds).toBeCloseTo(3,0);expect(v.measured!.media.shape).toBe('horizontal');expect(v.measured!.sound).toBeNull();
  expect(v.marks).toEqual([{t:1,note:'in'}]); // relative to the part; the mark outside it is dropped
  await T.discard(v.id);expect(fs.existsSync(T.studyDir(v.id))).toBe(false);
 },120000);

 it('filters lessons: vague, off-topic, repeated and opposite ones',()=>{
  expect(T.learn(first,{text:'The video looks nice.',topics:['pacing']}).action).toBe('dropped');
  expect(T.learn(first,{text:'Use a dark teal background with one coral accent on every scene.',topics:['color']}).reason).toContain('Not asked for');
  const a=T.learn(first,{text:'Cut every 1 second and land each cut on a beat of the music at about 120 BPM.',topics:['pacing']});
  expect(a).toMatchObject({action:'added',status:'trial'});
  expect(T.learn(first,{text:'Land every cut on a beat of the music, cutting about once a second at 120 BPM.',topics:['audio']})).toMatchObject({action:'merged',id:a.id});
  const c=T.learn(first,{text:'Use plain cross-fades as the only transition between every scene, they look smooth.',topics:['transitions']});
  expect(c.action).toBe('conflict');expect(c.with!.id).toBe('av-default-fades');
  expect(()=>T.learn(first,{text:'A lesson that names a topic that does not exist at all.',topics:['nonsense']})).toThrow(/Unknown topic/);
  const o=T.overview();expect(o.conflicts).toHaveLength(1);expect(o.videos.find(v=>v.id===first)!.dropped).toHaveLength(2);
 });

 it('deletes the video when learning is finished and commits numbers only',async()=>{
  const r=await T.finish(first);expect(r.kept.lessons).toBe(2);
  expect(fs.existsSync(T.studyDir(first))).toBe(false);
  const line=fs.readFileSync(path.join(env.TEMPOLOOM_BRAIN_DIR,'videos.jsonl'),'utf8').trim().split('\n');
  expect(line).toHaveLength(1);expect(JSON.parse(line[0]!)).toMatchObject({id:first,status:'learned',sheets:[]});
  await expect(T.finish(first)).rejects.toThrow(/learned/);
 });

 it('finds what the good examples share, leaves the outlier out and contrasts the bad ones',async()=>{
  for(const n of ['b','c','far'])await T.finish((await teachFile(n)).id);
  for(const n of ['bad1','bad2'])await T.finish((await teachFile(n,{verdict:'bad',topics:['pacing']})).id);
  const p=T.patterns(),shot=p.found.find(x=>x.id==='teach-pattern-shot-length')!;
  expect(shot.videos).toHaveLength(3);expect(shot.leftOut).toBe(1);expect(shot.body).toMatch(/bad examples sit at 3\.\d s/);
  const {getKnowledge}=await import('../src/engine/brain/db.js');
  expect(getKnowledge('teach-pattern-shot-length')).toMatchObject({status:'approved',kind:'principle'});
  // A lesson seen again in another good video gains evidence instead of a copy.
  const again=await teachFile('c');
  const m=T.learn(again.id,{text:'Cut about once every second and land each cut on a beat of the music near 120 BPM.',topics:['pacing']});
  expect(m.action).toBe('merged');expect(getKnowledge(m.id!)!.wins).toBe(1);
  // Similar videos: the fast beat-cut ones are nearer to each other than to the slow one.
  const s=T.similar(first,10),at=(t:string)=>s.find(x=>x.title===t)!.likeness.overall;
  expect(at('b')).toBeGreaterThan(at('far'));expect(at('c')).toBeGreaterThan(at('bad1'));
  await T.finish(again.id);
 },240000);

 it('keeps, removes and never relearns a removed lesson; forgetting a video removes what only it taught',async()=>{
  const o=T.overview(),conflict=o.conflicts[0]!.lesson.id;
  T.review(conflict,'remove');
  const v=await teachFile('a',{topics:['transitions']});
  expect(T.learn(v.id,{text:'Use plain cross-fades as the only transition between every scene because they look smooth.',topics:['transitions']}).reason).toContain('removed this lesson before');
  const fresh=T.learn(v.id,{text:'Hard cuts only between scenes when the music is fast and percussive: no wipes, no zooms.',topics:['transitions']});
  expect(fresh.action).toBe('added');
  expect(T.review(fresh.id!,'keep').status).toBe('approved');
  await T.finish(v.id);
  const {getKnowledge}=await import('../src/engine/brain/db.js');
  T.review(fresh.id!,'edit',{body:'Between scenes use hard cuts only when the music is fast: no wipes and no zooms.'});
  expect(getKnowledge(fresh.id!)!.body).toContain('hard cuts only');
  const f=await T.forget(v.id);expect(f.lessonsRemoved).toContain(fresh.id);expect(getKnowledge(fresh.id!)).toBeNull();
 },120000);

 it('a running process picks up lessons saved in the committed files by another one',async()=>{
  const {getKnowledge,exportCommitted}=await import('../src/engine/brain/db.js');exportCommitted();
  const f=path.join(env.TEMPOLOOM_BRAIN_DIR,'knowledge.jsonl'),k={id:'tec-from-elsewhere',domain:'both',kind:'technique',title:'Saved by another process',body:'Saved by another process while this one ran.',tags:['pacing'],source:'teach:x',status:'trial',wins:0,losses:0,uses:0,created:'2030-01-01T00:00:00.000Z',updated:'2030-01-01T00:00:00.000Z',evidence:[]};
  fs.appendFileSync(f,JSON.stringify(k)+'\n');
  await new Promise(r=>setTimeout(r,1100));
  expect(getKnowledge('tec-from-elsewhere')?.title).toBe('Saved by another process');
  exportCommitted();expect(fs.readFileSync(f,'utf8')).toContain('tec-from-elsewhere'); // and a later save keeps it
 });

 it('serves the page on this computer only, with the key',async()=>{
  const {serve}=await import('../src/teach/server.js');const s=await serve({port:0});
  try{
   const base=`http://127.0.0.1:${s.port}`,h={'x-teach-key':s.key};
   expect((await fetch(base+'/api/state')).status).toBe(403);
   expect((await fetch(base+'/api/state',{headers:{...h,origin:'https://example.com'}})).status).toBe(403);
   expect((await fetch(base+'/?k='+s.key)).headers.get('content-type')).toContain('text/html');
   expect((await fetch(base+'/font.ttf')).status).toBe(200);
   expect((await fetch(base+'/media/..%2F..%2Fpackage.json/preview.mp4',{headers:h})).status).toBe(404);
   expect((await fetch(base+'/api/upload?name=x.mp4',{method:'POST',headers:h,body:'not a video'})).status).toBe(400);
   const up=await fetch(base+'/api/upload?name=clip.mp4',{method:'POST',headers:h,body:fs.readFileSync(files.b!)});
   expect(up.status).toBe(200);const d=await up.json() as {id:string;status:string};expect(d.status).toBe('draft');
   const pv=await fetch(base+`/media/${d.id}/preview.mp4`,{headers:{...h,range:'bytes=0-99'}});expect(pv.status).toBe(206);expect((await pv.arrayBuffer()).byteLength).toBe(100);
   expect((await fetch(base+`/api/videos/${d.id}/teach`,{method:'POST',headers:{...h,'content-type':'application/json'},body:JSON.stringify({title:'x',verdict:'good',topics:[]})})).status).toBe(400);
   expect((await fetch(base+`/api/videos/${d.id}/teach`,{method:'POST',headers:{...h,'content-type':'application/json'},body:JSON.stringify({title:'From the page',verdict:'good',topics:['pacing'],prompt:'cuts'})})).status).toBe(200);
   await s.idle();
   const st=await (await fetch(base+'/api/state',{headers:h})).json() as {videos:{id:string;status:string;hasThumb:boolean}[];totals:{waiting:number}};
   expect(st.videos.find(v=>v.id===d.id)).toMatchObject({status:'waiting',hasThumb:true});expect(st.totals.waiting).toBe(1);
   expect((await fetch(base+`/media/${d.id}/thumb.jpg`,{headers:h})).status).toBe(200);
   expect((await fetch(base+`/api/videos/${d.id}/finish`,{method:'POST',headers:h})).status).toBe(200);
   expect(fs.existsSync(T.studyDir(d.id))).toBe(false);
  }finally{await s.close();}
 },120000);
});
