// Backup and move: one file with everything the studio learned, checked, restored by merging
// (newer wins, nothing removed) or replacing, always after saving what was there.
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {zipSync,unzipSync,strToU8} from 'fflate';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tl-backup-'));
const place=(name:string)=>({VIDEO_WORKSPACE:path.join(tmp,name,'ws'),TEMPOLOOM_BRAIN_DIR:path.join(tmp,name,'brain'),TEMPOLOOM_BRAIN_DB:path.join(tmp,name,'local','brain.db'),
 TEMPOLOOM_KNOWLEDGE_DIR:path.join(tmp,name,'know'),TEMPOLOOM_SETTINGS_DIR:path.join(tmp,name,'local'),TEMPOLOOM_BACKUP_DIR:path.join(tmp,name,'backups'),
 TEMPOLOOM_STATE_FILE:path.join(tmp,name,'state.json'),TEMPOLOOM_ENV_FILE:path.join(tmp,name,'.env'),TEMPOLOOM_KEYCHAIN:'off'});
const before={...process.env};let closeDb:()=>void;
async function move(to:ReturnType<typeof place>){closeDb?.();Object.assign(process.env,to);fs.mkdirSync(to.TEMPOLOOM_KNOWLEDGE_DIR,{recursive:true});
 closeDb=(await import('../src/engine/brain/db.js')).closeDb;(await import('../src/engine/brain/brain.js')).sync();}
const A=place('old-computer'),B=place('new-computer');
beforeAll(async()=>{await move(A);});
afterAll(()=>{closeDb();for(const k of Object.keys(A))before[k]===undefined?delete process.env[k]:process.env[k]=before[k];delete process.env.OPENROUTER_API_KEY;fs.rmSync(tmp,{recursive:true,force:true});});

let file='';
describe('backup and move',()=>{
 it('puts everything learned in one checked file, and never a key',async()=>{
  const brain=await import('../src/engine/brain/brain.js'),db=await import('../src/engine/brain/db.js'),Taste=await import('../src/engine/taste.js'),fb=await import('../src/engine/feedback.js'),
   st=await import('../src/engine/studio.js'),S=await import('../src/engine/models/settings.js'),Bk=await import('../src/engine/backup.js');
  brain.add({id:'les-cuts',title:'Cut on the beat',body:'Land every cut on a beat of the music near 120 BPM.',domain:'editing',kind:'technique',tags:['pacing','taught'],source:'teach:v1',status:'trial'});
  db.putVideo({id:'v-one',status:'learned',title:'Cold brew reference',created:'2026-11-01T00:00:00.000Z',updated:'2026-11-01T00:00:00.000Z',lessons:['les-cuts']});
  db.putVideo({id:'v-draft',status:'draft',title:'Not studied yet',created:'2026-11-02T00:00:00.000Z',updated:'2026-11-02T00:00:00.000Z'});
  Taste.create('Client A');
  await fb.addFeedback({said:'The captions are too small to read on a phone',rule:'Captions at least 6% of the frame height',verdict:'revise'});
  const job=st.plan('A teaser for the app',{type:'script-to-motion',job:'teaser'}).job;st.start(job,'intake');
  fs.mkdirSync(path.join(path.dirname(A.TEMPOLOOM_BRAIN_DB),'teach-thumbs'),{recursive:true});fs.writeFileSync(path.join(path.dirname(A.TEMPOLOOM_BRAIN_DB),'teach-thumbs','v-one.jpg'),'jpg');
  await S.saveKey('OPENROUTER_API_KEY','sk-secret-key-123456');S.update({share:'clips'});
  const made=Bk.createBackup();file=made.file;
  expect(path.dirname(file)).toBe(A.TEMPOLOOM_BACKUP_DIR);
  expect(made.counts).toMatchObject({taught:1,profiles:2,rules:1,studioJobs:1,thumbs:1});expect(made.counts.lessons).toBeGreaterThanOrEqual(2);
  const bytes=fs.readFileSync(file),names=Object.keys(unzipSync(bytes));
  expect(names).toEqual(expect.arrayContaining(['manifest.json','brain/knowledge.jsonl','brain/videos.jsonl','brain/taste.json','knowledge/memory.md','studio/teaser/plan.json','studio/teaser/events.jsonl','thumbs/v-one.jpg','local/settings.json']));
  expect(names.some(n=>/keys\.json|\.env/.test(n))).toBe(false);
  expect(Buffer.from(unzipSync(bytes)['brain/videos.jsonl']!).toString()).not.toContain('v-draft');
  for(const [n,b] of Object.entries(unzipSync(bytes)))expect(Buffer.from(b).toString('latin1'),n).not.toContain('sk-secret-key');
  expect(()=>Bk.createBackup({out:path.join(tmp,'x.txt')})).toThrow(/ends in \.zip/);
 });

 it('restores on another computer, then finds nothing new the second time',async()=>{
  await move(B);
  const Bk=await import('../src/engine/backup.js'),db=await import('../src/engine/brain/db.js'),Taste=await import('../src/engine/taste.js'),fb=await import('../src/engine/feedback.js'),st=await import('../src/engine/studio.js'),S=await import('../src/engine/models/settings.js');
  const bytes=new Uint8Array(fs.readFileSync(file));
  const pre=Bk.previewRestore(bytes);
  expect(pre.changes.find(c=>c.what.startsWith('Taught'))).toMatchObject({add:1});
  expect(db.getKnowledge('les-cuts')).toBeNull(); // a preview changes nothing
  const r=Bk.restoreBackup(bytes);
  expect(fs.existsSync(r.savedFirst)).toBe(true);expect(path.basename(r.savedFirst)).toMatch(/^tempoloom-before-restore-/);
  expect(db.getKnowledge('les-cuts')!.title).toBe('Cut on the beat');expect(db.getVideo('v-one')!.title).toBe('Cold brew reference');
  expect(Taste.profiles().map(p=>p.name)).toContain('Client A');
  expect(fb.parseLessons(fs.readFileSync(fb.memoryFile(),'utf8'))[0]!.rule).toMatch(/Captions at least 6%/);
  expect(st.readPlan('teaser').tasks.find(t=>t.id==='intake')!.status).toBe('doing');
  expect(fs.readFileSync(path.join(path.dirname(B.TEMPOLOOM_BRAIN_DB),'teach-thumbs','v-one.jpg'),'utf8')).toBe('jpg');
  expect(S.readSettings().share).toBe('clips');
  // The committed copy follows, so the brain is the same after a git pull too.
  expect(fs.readFileSync(path.join(B.TEMPOLOOM_BRAIN_DIR,'knowledge.jsonl'),'utf8')).toContain('les-cuts');
  const again=Bk.previewRestore(bytes).changes;
  expect(again.every(c=>c.add===0&&c.update===0)).toBe(true);
 });

 it('merge keeps what is newer here; replace makes the backup win; a deleted job stays deleted',async()=>{
  const Bk=await import('../src/engine/backup.js'),brain=await import('../src/engine/brain/brain.js'),db=await import('../src/engine/brain/db.js'),st=await import('../src/engine/studio.js'),S=await import('../src/engine/models/settings.js');
  brain.add({id:'les-cuts',title:'Cut on every second beat',body:'Changed here, after the backup.',domain:'editing',kind:'technique',tags:['pacing'],source:'teach:v1',status:'trial'});
  S.update({share:'local'});st.deleteJob('teaser');
  const bytes=new Uint8Array(fs.readFileSync(file));
  const merged=Bk.restoreBackup(bytes,'merge');
  expect(merged.changes.find(c=>c.what.startsWith('Lessons'))!.keep).toBe(1);
  expect(db.getKnowledge('les-cuts')!.title).toBe('Cut on every second beat');
  expect(S.readSettings().share).toBe('local');
  expect(()=>st.readPlan('teaser')).toThrow(/No studio job/);
  Bk.restoreBackup(bytes,'replace');
  expect(db.getKnowledge('les-cuts')!.title).toBe('Cut on the beat');expect(S.readSettings().share).toBe('clips');
  expect(st.readPlan('teaser').job).toBe('teaser'); // replace brings the deleted job back, whole
  st.start('teaser','intake');
  expect(Bk.listBackups().filter(b=>b.kind==='before restore')).toHaveLength(3);
 });

 it('refuses anything that is not a whole Tempoloom backup',async()=>{
  const Bk=await import('../src/engine/backup.js');
  expect(()=>Bk.openBackup(strToU8('not a zip'))).toThrow(/not a Tempoloom backup/);
  expect(()=>Bk.openBackup(zipSync({'photo.jpg':strToU8('x')}))).toThrow(/no Tempoloom manifest/);
  const files=unzipSync(new Uint8Array(fs.readFileSync(file)));
  files['brain/knowledge.jsonl']=strToU8('{"id":"changed"}\n');
  expect(()=>Bk.openBackup(zipSync(files))).toThrow(/damaged: brain\/knowledge\.jsonl/);
  // A file in a place a backup never writes is ignored, never written.
  const ok=unzipSync(new Uint8Array(fs.readFileSync(file)));ok['../../evil.sh']=strToU8('rm -rf /');ok['studio/x/../../escape.md']=strToU8('x');
  const opened=Bk.openBackup(zipSync(ok));expect(Object.keys(opened.files).some(n=>n.includes('..'))).toBe(false);
 });

 it('makes a weekly backup by itself and keeps the four newest',async()=>{
  const Bk=await import('../src/engine/backup.js'),dir=path.join(B.TEMPOLOOM_BACKUP_DIR,'auto');
  fs.mkdirSync(dir,{recursive:true});
  for(const d of ['20261001-0900','20261008-0900','20261015-0900','20261022-0900']){const f=path.join(dir,`tempoloom-auto-${d}.zip`);fs.writeFileSync(f,'old');const t=new Date('2026-10-25');fs.utimesSync(f,t,t);}
  expect(Bk.autoBackup()).not.toBeNull();
  const left=fs.readdirSync(dir).sort();expect(left).toHaveLength(4);expect(left[0]).toBe('tempoloom-auto-20261008-0900.zip');
  expect(Bk.autoBackup()).toBeNull(); // not again within a week
 });

 it('downloads, checks and restores from the page',async()=>{
  const {serve}=await import('../src/teach/server.js');const s=await serve({port:0});
  try{const base=`http://127.0.0.1:${s.port}`,h={'x-teach-key':s.key};
   expect((await fetch(base+'/backup.js')).status).toBe(200);expect((await fetch(base+'/api/backups/download')).status).toBe(403);
   const dl=await fetch(base+'/api/backups/download',{headers:h});expect(dl.headers.get('content-type')).toBe('application/zip');
   const zip=new Uint8Array(await dl.arrayBuffer());expect(Object.keys(unzipSync(zip))).toContain('manifest.json');
   const bad=await fetch(base+'/api/backups/check',{method:'POST',headers:h,body:Buffer.from('nope')});expect(bad.status).toBe(400);
   const check=await (await fetch(base+'/api/backups/check?mode=merge',{method:'POST',headers:h,body:Buffer.from(zip)})).json() as {token:string;changes:{add:number;update:number}[]};
   expect(check.changes.filter(c=>c.add||c.update)).toEqual([]);
   const r=await (await fetch(base+'/api/backups/restore',{method:'POST',headers:{...h,'content-type':'application/json'},body:JSON.stringify({token:check.token,mode:'merge'})})).json() as {savedFirst:string};
   expect(fs.existsSync(r.savedFirst)).toBe(true);
   expect((await fetch(base+'/api/backups/restore',{method:'POST',headers:{...h,'content-type':'application/json'},body:JSON.stringify({token:check.token})})).status).toBe(400);
   const list=await (await fetch(base+'/api/backups',{headers:h})).json() as {backups:{name:string}[]};
   expect((await fetch(base+'/api/backups/file/'+list.backups[0]!.name,{headers:h})).status).toBe(200);
   expect((await fetch(base+'/api/backups/file/..%2F..%2Fsecret.zip',{headers:h})).status).toBe(404);
  }finally{await s.close();}
 },30000);
});
