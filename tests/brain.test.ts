import {it,expect,afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dz-brain-'));
process.env.DIMENSAZ_BRAIN_DIR=path.join(dir,'brain');process.env.DIMENSAZ_BRAIN_DB=path.join(dir,'brain.db');
process.env.DIMENSAZ_KNOWLEDGE_DIR=path.join(dir,'knowledge');fs.mkdirSync(process.env.DIMENSAZ_KNOWLEDGE_DIR);
const brain=await import('../src/engine/brain/brain.js');
const dbm=await import('../src/engine/brain/db.js');
afterAll(()=>{dbm.closeDb();fs.rmSync(dir,{recursive:true,force:true});});

it('starts with curated motion and editing knowledge plus the user\'s styles and guides',()=>{
 const r=brain.sync();
 expect(r.total).toBeGreaterThan(100);
 const all=brain.allKnowledge();
 for(const kind of ['principle','technique','style','recipe','avoid','fact'])expect(all.some(k=>k.kind===kind),kind).toBe(true);
 expect(all.filter(k=>k.domain==='editing').length).toBeGreaterThan(20);
 expect(all.some(k=>k.id.startsWith('ref-style-'))).toBe(true);
 expect(all.some(k=>k.id.startsWith('guide-'))).toBe(true);
 expect(brain.sync()).toMatchObject({added:0,updated:0}); // idempotent
 expect(fs.readFileSync(path.join(dir,'brain','knowledge.jsonl'),'utf8').split('\n').filter(Boolean).length).toBe(r.total);
});

it('recalls rules always and the best matches for a brief',()=>{
 const r=brain.recall('kinetic typography with numbers counting and staggered entrances');
 expect(r.items.filter(i=>i.always).every(i=>['rule','preference','avoid'].includes(i.kind))).toBe(true);
 const ids=r.items.map(i=>i.id);
 expect(ids).toContain('mo-number-count');expect(ids).toContain('mo-kinetic-type-rules');
 // Only its own knowledge: no named style examples, genre recipes or ready-made pieces.
 expect(ids.some(id=>/^(ps|rc|st|pc)-/.test(id))).toBe(false);
 const ed=brain.recall('talking head podcast clip captions remove pauses',{domain:'editing'});
 expect(ed.items.some(i=>i.id==='ed-remove-dead-air')).toBe(true);
 expect(ed.items.every(i=>i.domain!=='motion')).toBe(true);
});

it('keeps web findings as trial until two approved jobs prove them, and retires losers',()=>{
 const t=brain.add({title:'Liquid glass card stack',body:'Stack 3 frosted cards with 12 px offset; peel the top one with a spring.',source:'https://example.com/liquid-glass',domain:'motion',kind:'technique',tags:['glass','cards']}).knowledge;
 expect(t.status).toBe('trial');
 expect(brain.recall('frosted glass cards stack').items.find(i=>i.id===t.id)?.status).toBe('trial');
 brain.recordJob({id:'job-1',title:'Promo',kind:'video'});brain.apply('job-1',[t.id]);
 expect(brain.verdict('job-1','approved').scored[0]).toMatchObject({id:t.id,status:'trial'});
 brain.apply('job-2',[t.id]);
 expect(brain.verdict('job-2','approved').scored[0]!.status).toBe('proven');
 const bad=brain.add({title:'Rainbow glitch everywhere',body:'Glitch every cut.',source:'study:glitch',kind:'technique'}).knowledge;
 for(const j of ['job-3','job-4','job-5']){brain.apply(j,[bad.id]);brain.verdict(j,'rejected');}
 expect(brain.getKnowledge(bad.id)!.status).toBe('retired');
 expect(brain.recall('rainbow glitch').items.some(i=>i.id===bad.id)).toBe(false);
 expect(()=>brain.apply('job-6',['nope'])).toThrow(/Unknown knowledge/);
 expect(()=>brain.add({title:'x',body:'y',source:''})).toThrow(/came from/);
});

it('reports whether recent work gets approved faster',()=>{
 brain.recordJob({id:'job-6'});brain.verdict('job-6','revised');brain.verdict('job-6','approved');
 const r=brain.report();
 expect(r.jobs.judged).toBeGreaterThanOrEqual(5);
 expect(r.improvement).toHaveProperty('recent');
 expect(r.knowledge.byStatus.proven).toBeGreaterThan(0);
 const jobs=fs.readFileSync(path.join(dir,'brain','jobs.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l));
 expect(jobs.find(j=>j.id==='job-6')).toMatchObject({verdict:'approved',revisions:1});
});

it('rebuilds the database from the committed files on another computer',()=>{
 dbm.closeDb();fs.rmSync(path.join(dir,'brain.db'),{force:true});fs.rmSync(path.join(dir,'brain.db-wal'),{force:true});fs.rmSync(path.join(dir,'brain.db-shm'),{force:true});
 expect(brain.getKnowledge('tec-liquid-glass-card-stack')?.status).toBe('proven');
 expect(brain.getJob('job-6')?.revisions).toBe(1);
});
