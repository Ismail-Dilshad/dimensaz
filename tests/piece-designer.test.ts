import {it,expect} from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {designPiece} from '../src/engine/piece-designer.js';
import {iconFor,keyPhrase,listIn,numbersIn,captionFor,storyboard} from '../src/engine/storyboard.js';
import {fill,saveApprovedDesigns,designedTemplates,templatesDir,type Template} from '../src/engine/composed-pieces.js';
import {pieceSchema} from '../src/engine/scene-pieces-schema.js';
import {requestSchema} from '../src/engine/production.js';
import {create,save} from '../src/engine/project.js';
import {planProject} from '../src/engine/timeline-builder.js';
import {openRenderer} from '../src/renderer/browser-renderer.js';
import {checkFrame} from '../src/renderer/visual-qa.js';

const design=(s:string,seed='t')=>{const n=numbersIn(s)[0];return designPiece(s,{seed,label:n?(captionFor(s)||keyPhrase(s)):keyPhrase(s),items:listIn(s),num:n,icon:iconFor});};
const asPiece=(d:ReturnType<typeof design>)=>pieceSchema.parse(fill({name:d.name,description:d.description,tags:d.tags,vars:d.vars,piece:{kind:'compose',name:d.name,layers:d.layers}} as Template));
const SENTENCES=['Solar panels turn sunlight into power.','Customers love the speed, the design and the price.','Security comes built in.','Revenue grew 3x in one quarter.','From chaos to clarity in one week.','Plan, build and launch with one tool.'];

it('designs a fitting new piece from what a sentence says',()=>{
 expect(design('Solar panels turn sunlight into power.').archetype).toBe('flow');
 expect(design('Solar panels turn sunlight into power.').vars).toMatchObject({from:'Sunlight',to:'Power',icon1:'sun',icon2:'bolt'});
 expect(design('Revenue grew 3x in one quarter.').archetype).toBe('callout');
 expect(design('Revenue grew 3x in one quarter.').vars).toMatchObject({value:3,suffix:'×'});
 expect(['orbit','path']).toContain(design('Customers love the speed, the design and the price.').archetype);
 expect(design('Customers love the speed, the design and the price.').vars).toMatchObject({item1:'Speed',item2:'Design',item3:'Price'});
 for(const s of SENTENCES)for(const seed of ['a','b','c']){const d=design(s,seed);expect(pieceSchema.safeParse(asPiece(d)).success,s).toBe(true);expect(d.name).toMatch(/^[a-z]+-[0-9a-f]{6}/);}
 expect(design(SENTENCES[2]!,'x')).toEqual(design(SENTENCES[2]!,'x')); // reproducible per video
 const looks=new Set(['a','b','c','d','e','f'].map(seed=>JSON.stringify(design(SENTENCES[2]!,seed).layers)));expect(looks.size).toBeGreaterThan(1);
});

it('puts designed pieces in the storyboard and saves them when the video is approved',async()=>{
 const sb=storyboard('Our planet needs cleaner energy.\nSolar panels turn sunlight into power.\nSecurity comes built in.\nSwitch today.',{product:'Sunly'});
 const designed=designedTemplates(sb.plans.map(p=>p.piece));expect(designed.length).toBeGreaterThanOrEqual(2);
 expect(sb.plans.some(p=>p.check.some(c=>c.includes('New piece designed')))).toBe(true);
 expect(requestSchema.safeParse(sb.request).success).toBe(true);
 const p=await create('designed-approve',sb.request.script);p.scenes=planProject(p);sb.plans.forEach((pl,i)=>{p.scenes[i]!.piece=pl.piece;});await save(p);
 const kept=await saveApprovedDesigns(p.id);
 try{expect(kept.sort()).toEqual(designed.map(d=>d.name).sort());
  for(const n of kept){const t=JSON.parse(await fs.readFile(path.join(templatesDir(),n+'.json'),'utf8'));expect(t.piece.layers.length).toBeGreaterThan(2);expect(JSON.stringify(t)).toContain('{{');}
  expect(await saveApprovedDesigns(p.id)).toEqual([]); // already kept
 }finally{for(const n of kept)await fs.rm(path.join(templatesDir(),n+'.json'),{force:true});}
});

it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('renders designed pieces readably',async()=>{
 const p=await create('designed-render',SENTENCES.join('\n'),{width:540,height:960,fps:12,fontSize:36,minFontSize:18});
 p.scenes=planProject(p);p.scenes.forEach((s,i)=>{s.piece=asPiece(design(SENTENCES[i]!,'render'));});await save(p);
 const r=await openRenderer(p);
 try{for(const s of p.scenes){await r.page.evaluate(t=>window.render(t),s.start+Math.max(s.duration*.85,s.duration-.4));const q=await checkFrame(r.page);expect(q.issues.filter(i=>i.severity==='hard'),s.text).toEqual([]);}}
 finally{await r.close();}
},120000);
