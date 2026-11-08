import {it,expect} from 'vitest';
import fs from 'node:fs/promises';
import {skins,skinIds} from '../src/components/pieces/skins.js';
import {chooseStyle} from '../src/engine/style-choice.js';
import {listTemplatesSync,fill,expandPiece} from '../src/engine/composed-pieces.js';
import {pieceSchema} from '../src/engine/scene-pieces-schema.js';
import {kitSound,soundKits,kitPlays} from '../src/engine/sound-kits.js';
import {planPieceSounds,kitSource} from '../src/engine/piece-sounds.js';
import {pieceExamples} from '../src/cli/pieces-cli.js';
import {create,save} from '../src/engine/project.js';
import {planProject} from '../src/engine/timeline-builder.js';
import {openRenderer} from '../src/renderer/browser-renderer.js';

const brand={primary:'#4F46E5',accent:'#F97316',surface:'#FFFFFF',background:'#F6F7FB',text:'#111827',muted:'#6B7280',radius:18};

it('has whole design styles, each with its own palette, motion, transitions and sound',()=>{
 expect(skinIds.length).toBeGreaterThanOrEqual(8);
 const looks=new Set(skinIds.map(id=>skins[id]!.surface(skins[id]!.palette(brand),1)));expect(looks.size).toBe(skinIds.length);
 for(const id of skinIds){const sk=skins[id]!,t=sk.palette(brand);
  for(const c of [t.primary,t.accent,t.surface,t.background,t.text,t.muted])expect(c,id).toMatch(/^#[0-9a-f]{6}$/i);
  expect(sk.transitions.length,id).toBeGreaterThan(0);expect(soundKits).toContain(sk.sound);expect(sk.mood.length).toBeGreaterThan(3);}
 expect(skins.neon!.palette(brand).background).toBe('#070A10');expect(skins.brutal!.radius(20)).toBe(0);
});

it('chooses a style from the brief, the brand, what was learned and recent videos',()=>{
 expect(chooseStyle({brief:'A calm premium assistant for your finances'}).style).toBe('editorial');
 expect(chooseStyle({brief:'Bold streetwear drop this Friday'}).style).toBe('brutal');
 expect(chooseStyle({brief:'Teach kids fractions with fun games'}).style).toBe('clay');
 expect(chooseStyle({brief:'Developer tool for debugging code at night'}).style).toBe('neon');
 expect(chooseStyle({brief:'Our new product',brand:{...brand,background:'#0B0B0F'}}).ranking.slice(0,2).map(r=>r.style)).toContain('neon');
 const b='Track every project with your team',first=chooseStyle({brief:b}).style;
 expect(chooseStyle({brief:b,recent:[first]}).style).not.toBe(first); // styles rotate between videos
 const pref=chooseStyle({brief:b,knowledge:[{id:'fb-x',title:'Use the glass style',use:'The user said: use glass for everything',kind:'preference',confidence:.8}]});expect(pref.style).toBe('glass');
 const avoid=chooseStyle({brief:'Bold streetwear drop',knowledge:[{id:'fb-y',title:'Never use brutal',use:'no brutal style',kind:'avoid',confidence:.8}]});expect(avoid.style).not.toBe('brutal');
 const learned=chooseStyle({brief:b,knowledge:[{id:'ps-outline',title:'',use:'',kind:'style',confidence:.95}]});expect(learned.style).toBe('outline');
});

it('fills saved composed pieces and expands them inside devices',async()=>{
 const ts=listTemplatesSync();expect(ts.map(t=>t.name)).toEqual(expect.arrayContaining(['stat-hero','icon-trio','hero-tagline','growth-arrow','step-flow','badge-burst']));
 for(const t of ts)expect(pieceSchema.safeParse(fill(t)).success,t.name).toBe(true);
 const p=await expandPiece(pieceSchema.parse({kind:'browser',screen:{kind:'compose',template:'stat-hero',vars:{value:42,suffix:'%',label:'faster'}}}));
 const screen=(p as {screen:{layers:{type:string;value?:number;text?:string}[]}}).screen;
 expect(screen.layers.find(l=>l.type==='number')).toMatchObject({value:42,suffix:'%'});expect(screen.layers.some(l=>l.text==='faster')).toBe(true);
 await expect(expandPiece(pieceSchema.parse({kind:'compose',template:'no-such-piece'}))).rejects.toThrow(/No saved piece/);
 expect(pieceSchema.safeParse({kind:'compose'}).success).toBe(false);
});

it('makes original sound kits and plans cues with them',async()=>{
 for(const kit of ['soft','digital','punchy','minimal'] as const)for(const k of ['click','pop','whoosh','success'] as const){
  const s=await kitSound(kit,k,0);expect((await fs.stat(s.file)).size,kit+k).toBeGreaterThan(1000);expect(s.rmsDb).toBeGreaterThan(-60);}
 const v0=await kitSound('soft','pop',0),v1=await kitSound('soft','pop',1);expect(v0.file).not.toBe(v1.file); // two variants
 const scenes=[{start:0,duration:3,piece:pieceSchema.parse(pieceExamples.notifications!.piece)},{start:3,duration:3,piece:pieceSchema.parse(pieceExamples.counter!.piece)}];
 const digital=planPieceSounds(scenes,await kitSource('digital',[]));expect(digital.length).toBeGreaterThan(5);
 expect(new Set(digital.filter(c=>c.sound==='pop').map(c=>c.file)).size).toBe(2); // repeated pops alternate
 const minimal=planPieceSounds(scenes,await kitSource('minimal',[]));expect(minimal.every(c=>kitPlays('minimal',c.sound))).toBe(true);expect(minimal.length).toBeLessThan(digital.length);
},60000);

it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('renders every piece in every style with the same timing',async()=>{
 const kinds=Object.keys(pieceExamples).filter(k=>k!=='image');
 for(const style of skinIds){
  const p=await create('styles-'+style,kinds.map(k=>'Scene '+k).join('\n'),{width:360,height:640,fps:12,fontSize:36,minFontSize:18});
  p.scenes=planProject(p);p.scenes.forEach((s,i)=>{s.piece=pieceSchema.parse(pieceExamples[kinds[i]!]!.piece);});
  p.config.pieces={...brand,style};await save(p);const r=await openRenderer(p);
  try{
   for(const s of p.scenes){await r.page.evaluate(t=>window.render(t),s.start+s.duration*.7);}
   const info=await r.page.evaluate(()=>[...document.querySelectorAll<HTMLElement>('[data-style]')].map(e=>[e.dataset.style,e.dataset.length,e.dataset.domLength]));
   expect(info.length,style).toBe(kinds.length);for(const [st,a,b] of info){expect(st).toBe(style);expect(a).toBe(b);}
  }finally{await r.close();}
 }
},240000);
