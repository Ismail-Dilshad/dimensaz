import {describe,it,expect} from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {parse} from 'yaml';
import {ROOT} from '../engine/config.js';
import {readRegistry} from '../scripts/tools-registry.js';
import {readIndex,validateKnowledge,searchKnowledge} from '../scripts/knowledge-cli.js';
import {brandProfile} from '../engine/brand.js';
import {requestSchema} from '../engine/production.js';

const read=(f:string)=>fs.readFile(path.join(ROOT,f),'utf8');
const json=async(f:string)=>JSON.parse(await read(f));
const keys=(o:object,prefix=''):string[]=>Object.entries(o).flatMap(([k,v])=>k==='_meta'?[]:v&&typeof v==='object'?keys(v,prefix+k+'.'):[prefix+k]).sort();

describe('agent definition',()=>{
 it('points every manifest entry and mode to an existing file',async()=>{
  const agent=parse(await read('agent/agent.yaml'));
  expect(agent.locale.default).toBe('en');
  expect(agent.preferences.autoMotion.default).toBe(true);
  for(const f of Object.values(agent.entry) as string[])await fs.access(path.join(ROOT,f));
  expect(agent.modes.map((m:{id:string})=>m.id)).toEqual(['script-to-motion','reference-match','footage-edit']);
  for(const m of agent.modes)await fs.access(path.join(ROOT,m.file));
 });
 it('keeps every locale on the same keys as English, including every briefing question',async()=>{
  const en=keys(await json('locales/en.json'));
  for(const lang of ['ckb','kmr','ar','fa'])expect(keys(await json(`locales/${lang}.json`)),lang).toEqual(en);
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
   if(m){expect(scripts,t.id).toHaveProperty(m[1]);if(m[1]==='reelwright'&&m[2]){const bin=await read('bin/reelwright.mjs');expect(bin,t.id).toContain(' '+m[2]+': {');}}
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
 it('defines ten golden evals with expectations and failure conditions',async()=>{
  const {tasks}=await json('agent/evals/tasks.json');
  expect(tasks).toHaveLength(10);
  for(const t of tasks){expect(t.expect.length).toBeGreaterThan(0);expect(t.failIf.length).toBeGreaterThan(0);}
  expect(new Set(tasks.map((t:{mode:string})=>t.mode))).toEqual(new Set(['script-to-motion','reference-match','footage-edit']));
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
  expect((await read('.claude/skills/reelwright/SKILL.md')).replace(/\r\n/g,'\n')).toBe(render('.claude/skills/reelwright/SKILL.md'));
  expect(await read('SKILL.md')).toContain('skills/reelwright/SKILL.md');
 });
 it('links only to files that exist and names no specific font',async()=>{
  const text=await read('skills/reelwright/SKILL.md');
  for(const [,link] of text.matchAll(/\]\(([^)#\s]+)/g))if(!/^[a-z]+:/i.test(link))await fs.access(path.resolve(ROOT,'skills/reelwright',link));
  for(const f of ['skills/reelwright/SKILL.md','AGENTS.md','agent/persona.md','agent/policies.md','README.md'].slice(0,4))
   expect((await read(f)).replace('assets/Rabar_021.ttf','')).not.toMatch(/rabar|inter\b|vazirmatn|noto naskh/i);
 });
});
