import {it,expect} from 'vitest';
import fs from 'node:fs/promises';
import {skinFor} from '../src/components/pieces/skins.js';
import {designStyle} from '../src/engine/style-choice.js';
import * as G from '../src/components/pieces/genome.js';
import {distance,traits,genomeSchema,type Genome} from '../src/components/pieces/genome.js';
import {frameFor,contrast} from '../src/components/pieces/frame.js';
import {pieceSchema} from '../src/engine/scene-pieces-schema.js';
import {designScenes} from '../src/engine/storyboard.js';
import {kitSound,soundKits,kitPlays} from '../src/engine/sound-kits.js';
import {planPieceSounds,kitSource} from '../src/engine/piece-sounds.js';
import {create,save} from '../src/engine/project.js';
import {planProject} from '../src/engine/timeline-builder.js';
import {openRenderer} from '../src/renderer/browser-renderer.js';

const brand={primary:'#4F46E5',accent:'#F97316',surface:'#FFFFFF',background:'#F6F7FB',text:'#111827',muted:'#6B7280',radius:18};
const lumOf=(c:string)=>{const [r,g,b]=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));return (r!*299+g!*587+b!*114)/1000;};
const body=(g:Genome)=>{const {v:_v,id:_i,name:_n,cues:_c,...b}=g;return b;};
const visuals=(lines:string[],seed:string)=>designScenes(lines,{seed}).map(p=>p.piece);

it('has no named looks: every style is generated, with its own palette, motion, transitions and sound',()=>{
 expect(Object.keys(G)).not.toEqual(expect.arrayContaining(['examples']));expect('breed' in G).toBe(false);
 const looks=new Set<string>();
 for(let k=0;k<12;k++){const g=designStyle({seed:'look-'+k,brief:'A new product for teams'}).genome,sk=skinFor(g),t=sk.palette(brand);looks.add(sk.surface(t,1));
  for(const c of [t.primary,t.accent,t.surface,t.background,t.text,t.muted])expect(c,g.name).toMatch(/^#[0-9a-f]{6}$/i);
  expect(sk.transitions.length).toBeGreaterThan(0);expect(soundKits).toContain(sk.sound);}
 expect(looks.size).toBeGreaterThan(9);
 const dark=designStyle({seed:'dark',brief:'x',brand:{...brand,background:'#0B0B0F'}}).genome;expect(dark.tone).toBe('dark');expect(lumOf(skinFor(dark).palette(brand).background)).toBeLessThan(40);
});

it('makes a new style every time, never an earlier one',()=>{
 const used:Genome[]=[];
 for(let k=0;k<25;k++){const d=designStyle({seed:'job-'+k,brief:'Track every project with your team',used});
  if(used.length)expect(Math.min(...used.map(u=>distance(body(d.genome),body(u))))).toBeGreaterThanOrEqual(.2);
  used.push(d.genome);}
 expect(new Set(used.map(g=>g.name)).size).toBeGreaterThan(18);
 const a=designStyle({seed:'same',brief:'x'}),b=designStyle({seed:'same',brief:'x'});expect(a.genome).toEqual(b.genome); // reproducible per job
 for(const g of used)expect(genomeSchema.safeParse(g).success).toBe(true);
});

it('follows the brief and the user, and learns traits from verdicts',()=>{
 const dark=Array.from({length:12},(_,k)=>designStyle({seed:'d'+k,brief:'Developer tool for debugging code at night'}).genome).filter(g=>g.tone==='dark').length;
 const playful=Array.from({length:12},(_,k)=>designStyle({seed:'p'+k,brief:'Teach kids fractions with fun games'}).genome).filter(g=>g.type.display==='round'||g.shadow.kind==='inset').length;
 expect(dark).toBeGreaterThanOrEqual(6);expect(playful).toBeGreaterThanOrEqual(6);
 const paper=Array.from({length:12},(_,k)=>designStyle({seed:'w'+k,brief:'Our new product',direction:'calm paper, serif type'}).genome).filter(g=>g.tone==='paper'||g.type.display==='serif').length;expect(paper).toBeGreaterThanOrEqual(7);
 const count=(learned:Record<string,number>)=>Array.from({length:30},(_,k)=>designStyle({seed:'l'+k,brief:'Our new product for teams',learned}).genome).filter(g=>g.shadow.kind==='glow').length;
 expect(count({'pt-shadow-glow':.97})).toBeGreaterThan(count({'pt-shadow-glow':.03})+4);
 const avoid=Array.from({length:12},(_,k)=>designStyle({seed:'a'+k,brief:'Bold streetwear drop',knowledge:[{id:'fb-no-dark',title:'Never use dark styles',use:'The user said no dark look',kind:'rule',confidence:.9}]}).genome);
 expect(avoid.filter(g=>g.tone==='dark').length).toBeLessThanOrEqual(2);
 expect(traits(body(designStyle({seed:'t',brief:'x'}).genome)).length).toBeGreaterThan(8);
});

it('makes original sound kits and plans cues with them',async()=>{
 for(const kit of ['soft','digital','punchy','minimal'] as const)for(const k of ['click','pop','whoosh','success'] as const){
  const s=await kitSound(kit,k,0);expect((await fs.stat(s.file)).size,kit+k).toBeGreaterThan(1000);expect(s.rmsDb).toBeGreaterThan(-60);}
 const v0=await kitSound('soft','pop',0),v1=await kitSound('soft','pop',1);expect(v0.file).not.toBe(v1.file); // two variants
 const [w1,w2]=visuals(['Your team is drowning in messages, tasks and deadlines.','Revenue grew 40% in three months.'],'kits');const scenes=[{start:0,duration:3,piece:w1!},{start:3,duration:3,piece:w2!}];
 const digital=planPieceSounds(scenes,await kitSource('digital',[]));expect(digital.length).toBeGreaterThan(5);
 expect(new Set(digital.filter(c=>c.sound==='pop').map(c=>c.file)).size).toBe(2); // repeated pops alternate
 const minimal=planPieceSounds(scenes,await kitSource('minimal',[]));expect(minimal.every(c=>kitPlays('minimal',c.sound))).toBe(true);expect(minimal.length).toBeLessThan(digital.length);
},60000);

it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('renders designed visuals in generated styles with the same timing',async()=>{
 const lines=['Your team is drowning in messages, tasks and deadlines.','Revenue grew 40% in three months.','Solar panels turn sunlight into power.','Start your free trial today.'];
 for(let k=0;k<4;k++){
  const p=await create('styles-'+k,lines.join('\n'),{width:360,height:640,fps:12,fontSize:36,minFontSize:18});
  p.scenes=planProject(p);visuals(p.scenes.map(s=>s.text),'styles-'+k).forEach((v,i)=>{p.scenes[i]!.piece=v;});
  const genome=designStyle({seed:'render-'+k,brief:'x'}).genome;p.config.pieces={...brand,genome};await save(p);const r=await openRenderer(p);
  try{
   for(const s of p.scenes){await r.page.evaluate(t=>window.render(t),s.start+s.duration*.7);}
   const info=await r.page.evaluate(()=>[...document.querySelectorAll<HTMLElement>('[data-style]')].map(e=>[e.dataset.style,e.dataset.length,e.dataset.domLength]));
   expect(info.length).toBe(lines.length);for(const [st,a,b] of info){expect(st).toBe(genome.id);expect(a).toBe(b);}
  }finally{await r.close();}
 }
},240000);

it('paints the whole frame in the video style with readable colours',()=>{
 for(let k=0;k<40;k++){const g=designStyle({seed:'frame-'+k,brief:k%2?'Developer tool at night':'Calm premium finance'}).genome;const f=frameFor(g,brand);
  expect(contrast(f.text,f.background),g.name).toBeGreaterThanOrEqual(7);expect(contrast(f.highlight,f.background),g.name).toBeGreaterThanOrEqual(3);
  expect(f.genome).toBe(g.id);if(g.tone==='dark')expect(f.dark).toBe(true);if(g.type.display==='serif')expect(f.font).toMatch(/DMSerif/);}
});

it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('renders the frame background, pattern and headline type from the style',async()=>{
 const g={...designStyle({seed:'frame-render',brief:'night developer'}).genome,tone:'dark' as const,backdrop:{kind:'grid' as const,amount:.7},type:{display:'grotesk' as const,numbers:'grotesk' as const,weight:600,upper:true,tracking:.04}};
 const p=await create('frame-render','Meet the tool that finds bugs\nفلۆلی بناسە',{width:360,height:640,fps:12,fontSize:36,minFontSize:18});
 p.scenes=planProject(p);for(const s of p.scenes)s.piece=pieceSchema.parse({kind:'compose',layers:[{type:'card',x:.1,y:.1,w:.8,h:.6},{type:'icon',icon:'bolt',x:.4,y:.3,w:.2}]});
 p.config.pieces={...brand,genome:g};p.config.frame=frameFor(g,brand);p.config.background='solid';p.config.white=p.config.frame.background;p.config.ink=p.config.frame.text;
 await save(p);const r=await openRenderer(p);
 try{
  await r.page.evaluate(t=>window.render(t),p.scenes[0]!.start+1);
  const info=await r.page.evaluate(()=>{const bg=document.getElementById('background')!,cs=getComputedStyle(bg);
   const texts=[...document.querySelectorAll<HTMLElement>('[data-kinetic] > div, #stage div[dir]')].filter(e=>e.textContent&&e.style.fontFamily);
   return {bg:cs.backgroundColor,image:cs.backgroundImage,fonts:texts.map(e=>[e.textContent!.slice(0,6),e.style.fontFamily,e.style.textTransform])};});
  expect(info.bg).not.toBe('rgb(255, 255, 255)');expect(info.image).toContain('linear-gradient');
  const latin=info.fonts.find(f=>f[0]!.startsWith('Meet')),kurdish=info.fonts.find(f=>/\p{Script=Arabic}/u.test(f[0]!));
  expect(latin?.[1]).toContain('PieceDisplay-'+g.id);expect(latin?.[2]).toBe('uppercase');expect(kurdish?.[1]).not.toContain('PieceDisplay');
 }finally{await r.close();}
},120000);
