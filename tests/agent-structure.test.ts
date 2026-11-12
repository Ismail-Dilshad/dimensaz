import {describe,it,expect} from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {parse} from 'yaml';
import {ROOT} from '../src/engine/config.js';
import {readRegistry} from '../src/cli/tools-registry.js';
import {readIndex,validateKnowledge,searchKnowledge} from '../src/cli/knowledge-cli.js';
import {brandProfile} from '../src/engine/brand.js';
import {requestSchema} from '../src/engine/production.js';

const read=(f:string)=>fs.readFile(path.join(ROOT,f),'utf8');
const json=async(f:string)=>JSON.parse(await read(f));
const keys=(o:object,prefix=''):string[]=>Object.entries(o).flatMap(([k,v])=>k==='_meta'?[]:v&&typeof v==='object'?keys(v,prefix+k+'.'):[prefix+k]).sort();

describe('agent definition',()=>{
 it('points every manifest entry and mode to an existing file',async()=>{
  const agent=parse(await read('agent/agent.yaml'));
  expect(agent.locale.default).toBe('en');
  expect(agent.preferences.autoMotion.default).toBe(true);
  for(const f of Object.values(agent.entry) as string[])await fs.access(path.join(ROOT,f));
  expect(agent.modes.map((m:{id:string})=>m.id)).toEqual(['script-writing','script-to-motion','reference-match','footage-edit']);
  for(const m of agent.modes)await fs.access(path.join(ROOT,m.file));
 });
 it('keeps every locale on the same keys as English, including every briefing question',async()=>{
  const en=keys(await json('agent/locales/en.json'));
  for(const lang of ['ckb','kmr','ar','fa'])expect(keys(await json(`agent/locales/${lang}.json`)),lang).toEqual(en);
  const briefing=parse(await read('agent/questions/briefing.yaml'));
  expect(briefing.maxPerTurn).toBeLessThanOrEqual(5);
  for(const q of briefing.questions)expect(en).toContain('questions.'+q.id);
  const states=Object.keys((await json('agent/status/states.json')).states).sort();
  expect(en.filter(k=>k.startsWith('status.')).map(k=>k.slice(7)).sort()).toEqual(states);
 });
 it('registers only real commands for ready tools',async()=>{
  const {tools}=await readRegistry();const scripts=(await json('package.json')).scripts as Record<string,string>;
  expect(new Set(tools.map(t=>t.id)).size).toBe(tools.length);
  for(const t of tools.filter(t=>t.status==='ready')){
   const m=t.command.match(/^pnpm (\S+)(?: (\S+))?/);
   if(m){expect(scripts,t.id).toHaveProperty(m[1]);if(m[1]==='dimensaz'&&m[2]){const bin=await read('bin/dimensaz.mjs');expect(bin,t.id).toContain(' '+m[2]+': {');}}
   else expect(t.command,t.id).toMatch(/^python scripts\//);
  }
  expect(tools.filter(t=>t.status==='planned').every(t=>t.command==='(planned)')).toBe(true);
 });
 it('indexes knowledge files that exist and finds relevant entries',async()=>{
  expect((await validateKnowledge()).problems).toEqual([]);
  expect((await readIndex()).entries.length).toBeGreaterThan(40);
  const hits=await searchKnowledge('kinetic typography');
  expect(hits[0].id).toBe('kinetic-typography');
 });
 it('defines golden evals with expectations and failure conditions',async()=>{
  const {tasks}=await json('agent/evals/tasks.json');
  expect(tasks.length).toBeGreaterThanOrEqual(10);expect(new Set(tasks.map((t:{id:string})=>t.id)).size).toBe(tasks.length);
  for(const t of tasks){expect(t.expect.length).toBeGreaterThan(0);expect(t.failIf.length).toBeGreaterThan(0);}
  expect(new Set(tasks.map((t:{mode:string})=>t.mode))).toEqual(new Set(['script-writing','script-to-motion','reference-match','footage-edit']));
 });
});

describe('brand profile',()=>{
 it('loads the brand profile with automatic motion on by default',async()=>{
  const b=await brandProfile();
  expect(b.preferences.autoMotion).toBe(true);
  for(const f of [b.logo.primary,b.logo.onLight,b.logo.onDark].filter(Boolean) as string[])await fs.access(path.join(ROOT,f));
 });
 it('lets a request opt out of automatic motion',()=>{
  expect(requestSchema.parse({schemaVersion:1,title:'T',script:'Hello',autoMotion:false}).autoMotion).toBe(false);
  expect(requestSchema.parse({schemaVersion:1,title:'T',script:'Hello'}).autoMotion).toBeUndefined();
 });
});

describe('skill',()=>{
 it('has one source of truth and an in-sync Claude Code copy',async()=>{
  const {render}=await import('../scripts/sync-skills.mjs' as string);
  expect((await read('.claude/skills/dimensaz/SKILL.md')).replace(/\r\n/g,'\n')).toBe(render('.claude/skills/dimensaz/SKILL.md'));
  expect(await read('SKILL.md')).toContain('skills/dimensaz/SKILL.md');
 });
 it('links only to files that exist and names no specific font',async()=>{
  const text=await read('skills/dimensaz/SKILL.md');
  for(const [,link] of text.matchAll(/\]\(([^)#\s]+)/g))if(!/^[a-z]+:/i.test(link))await fs.access(path.resolve(ROOT,'skills/dimensaz',link));
  for(const f of ['skills/dimensaz/SKILL.md','AGENTS.md','agent/persona.md','agent/policies.md','README.md'].slice(0,4))
   expect((await read(f))).not.toMatch(/rabar|inter\b|vazirmatn|noto naskh/i);
 });
});

describe('workflow',()=>{
 it('runs eight stages with research and a production design that decides everything',async()=>{
  const flow=await read('agent/workflow.md');
  for(const stage of ['1. Intake','2. Brief','3. Research','4. Production design','5. Prepare','6. Build','7. Review','8. Deliver'])expect(flow).toContain('## '+stage);
  expect(flow).toContain('media brand-scan');expect(flow).toContain('templates/production-design.md');
  const template=await read('agent/templates/production-design.md');
  for(const section of ['Goal and audience','Product facts','Brand','References and research','Concept','Script','Storyboard','Visual system','Motion system','Voice','Music and sound','Timing plan','Assets','Deliverables','Risks'])expect(template).toContain(section);
  expect(await read('skills/dimensaz/SKILL.md')).toContain('agent/workflow.md');
 });
});

describe('studio',()=>{
 it('defines an organisation whose roles point to real guides, real commands and generated sub-agents',async()=>{
  const {loadStudio,org}=await import('../src/engine/studio.js');const s=loadStudio(),bin=await read('bin/dimensaz.mjs');
  expect(new Set(s.roles.map(r=>r.id)).size).toBe(s.roles.length);
  for(const r of s.roles){
   for(const g of r.guides)await fs.access(path.join(ROOT,g));
   for(const c of r.commands){const m=c.match(/^pnpm dimensaz (\S+)/);expect(m,r.id+': '+c).not.toBeNull();expect(bin,r.id+': '+c).toContain(' '+m![1]+': {');}
  }
  // Both departments have a lead with its team; every plan ends by learning and has the user's approvals.
  expect(org().departments.filter(d=>d.lead).map(d=>d.department)).toEqual(['Motion graphics','Video editing']);
  for(const [name,p] of Object.entries(s.plans)){expect(p.tasks.at(-1)!.id,name).toBe('learn');expect(p.tasks.filter(t=>t.gate).map(t=>t.id),name).toEqual(expect.arrayContaining(['design-ok','preview-ok']));
   expect(p.tasks.some(t=>t.role==='reviewer'),name).toBe(true);}
  // @ts-expect-error a plain script without types
  const {render}=await import('../scripts/sync-agents.mjs');const files=render() as Record<string,string>;
  expect(Object.keys(files).sort()).toEqual(['dimensaz-editing-lead.md','dimensaz-motion-lead.md','dimensaz-reviewer.md','dimensaz-specialist.md']);
  for(const [name,want] of Object.entries(files)){expect((await read('.claude/agents/'+name)).replace(/\r\n/g,'\n'),name+' (run pnpm agents:sync)').toBe(want);
   const fm=parse(want.split('---')[1]!);expect(fm.name).toBe(name.replace('.md',''));expect(fm.description.length).toBeGreaterThan(40);}
 });

 it('plans a job, gives each role its own lessons, routes feedback and learns from the verdict',async()=>{
  const os=await import('node:os'),tmp=await fs.mkdtemp(path.join(os.tmpdir(),'dz-studio-'));
  const env={VIDEO_WORKSPACE:path.join(tmp,'ws'),DIMENSAZ_BRAIN_DIR:path.join(tmp,'brain'),DIMENSAZ_BRAIN_DB:path.join(tmp,'brain.db'),DIMENSAZ_KNOWLEDGE_DIR:path.join(tmp,'know')},before={...process.env};
  Object.assign(process.env,env);await fs.mkdir(env.DIMENSAZ_KNOWLEDGE_DIR,{recursive:true});
  try{
   const st=await import('../src/engine/studio.js'),{sync,closeDb}=await import('../src/engine/brain/brain.js').then(async b=>({sync:b.sync,closeDb:(await import('../src/engine/brain/db.js')).closeDb}));
   sync();
   const p=st.plan('A 30 second promo for Ledgerly',{type:'script-to-motion',options:['write'],job:'t1'});
   expect(p.tasks).toHaveLength(16);expect(st.next('t1').ready.map(r=>r.task)).toEqual(['intake']);
   expect(()=>st.start('t1','style')).toThrow(/cannot start yet/);
   const out=async(task:string)=>{const f=path.join(st.jobDir('t1'),task+'.out');await fs.writeFile(f,'x');return f;};
   const run=async(task:string,o:{learned?:string[]}={})=>{st.start('t1',task);st.done('t1',task,{output:await out(task),applied:['none'],...o});};
   for(const t of ['intake','brief','research','facts','script'])await run(t);
   expect(st.next('t1').waitingForUser.map(g=>g.gate)).toEqual(['script-ok']);st.approve('t1','script-ok');
   // Each role gets the rules of its own topics.
   const always=(task:string)=>st.start('t1',task).lessons.items.filter(l=>l.always).map(l=>l.id);
   expect(always('style')).toContain('av-tiny-text');
   // A role that was given rules must say which it used.
   expect(()=>st.done('t1','style',{output:path.join(tmp,'missing')})).toThrow(/does not exist/);
   const styleOut=await out('style');expect(()=>st.done('t1','style',{output:styleOut})).toThrow(/--applied/);
   st.done('t1','style',{output:styleOut,applied:['av-tiny-text']});
   const sound=always('sound');expect(sound).toContain('av-music-over-voice');expect(sound).not.toContain('av-tiny-text');
   st.done('t1','sound',{output:await out('sound'),applied:['av-music-over-voice']});
   await run('storyboard',{learned:['A figure on its own line reads best as a solid 3D figure when the line has under six words.']});
   await run('design');st.approve('t1','design-ok');await run('build');await run('review');
   // Feedback about music goes to the sound designer only; its task and what was built on it reopen.
   const fb=await st.feedback('t1','The music is too loud',{rule:'Keep music well under the voice'});
   expect(fb.goesTo).toEqual(['Sound designer']);expect(fb.reopened).toEqual(expect.arrayContaining(['sound','design','design-ok','build','review']));
   expect(fb.reopened).not.toContain('style');expect(fb.reopened).not.toContain('script');
   const again=st.start('t1','sound');expect(again.round).toBe(2);expect(again.feedbackOnThisJob?.[0]?.said).toBe('The music is too loud');
   expect(again.lessons.items.some(l=>l.always&&l.id===fb.saved)).toBe(true); // the new rule is already in its lessons
   st.done('t1','sound',{output:await out('sound'),applied:[fb.saved]});
   await run('design');st.approve('t1','design-ok');await run('build');await run('review');st.approve('t1','preview-ok');await run('final');
   // The job cannot close without the user's verdict; the verdict scores what was used.
   st.start('t1','learn');expect(()=>st.done('t1','learn',{output:styleOut,applied:['none']})).toThrow(/verdict/);
   const v=st.verdict('t1','approved');expect(v.lessons.map(l=>l.id)).toEqual(expect.arrayContaining(['av-tiny-text','av-music-over-voice',fb.saved]));
   st.done('t1','learn',{output:styleOut,applied:['none']});expect(st.next('t1').finished).toBe(true);
   const retro=st.retro('t1');expect(retro.revisions).toBe(1);expect(retro.lessonsLearned).toBe(1);
   // On the next job the scene designer has its own lesson, and other roles do not.
   st.plan('Another promo with a figure on its own line',{type:'script-to-motion',job:'t2'});
   expect(st.lessonsFor('scenes','a figure on its own line as a 3D figure').some(l=>l.yours)).toBe(true);
   expect(st.lessonsFor('sound','a figure on its own line as a 3D figure').some(l=>l.yours)).toBe(false);
   expect(st.lessonsFor('sound','any video').some(l=>l.id===fb.saved)).toBe(true);
   closeDb();
  }finally{for(const k of Object.keys(env))if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];await fs.rm(tmp,{recursive:true,force:true});}
 });
});
