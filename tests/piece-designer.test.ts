import {it,expect} from 'vitest';
import {designPiece,archetypes} from '../src/engine/piece-designer.js';
import {iconFor,keyPhrase,listIn,numbersIn,captionFor,designScenes,storyboard} from '../src/engine/storyboard.js';
import {pieceSchema} from '../src/engine/scene-pieces-schema.js';
import {requestSchema} from '../src/engine/production.js';
import {create,save} from '../src/engine/project.js';
import {planProject} from '../src/engine/timeline-builder.js';
import {openRenderer} from '../src/renderer/browser-renderer.js';
import {checkFrame} from '../src/renderer/visual-qa.js';

const design=(s:string,seed='t',learned?:Record<string,number>)=>{const n=numbersIn(s)[0];return designPiece(s,{seed,label:n?(captionFor(s)||keyPhrase(s)):keyPhrase(s),items:listIn(s),num:n,icon:iconFor,learned});};
const SCRIPT=['Your team is drowning in messages, tasks and deadlines.','Meet Flowly, the workspace that keeps everything in one place.','Assign tasks to the right people in one click.',
 'Track every project live on one dashboard.','Teams using Flowly ship 40% faster.','Solar panels turn sunlight into power.','No more spreadsheets, lost emails or missed deadlines.',
 'Deliver to Erbil, Duhok and Sulaimani.','"It saved our launch," says Maya.','Plans start at $9 per month.','Start your free trial today.'];
const words=(s:string)=>new Set(s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean));

it('designs every sentence from zero with only its own words and numbers',()=>{
 const plans=designScenes(SCRIPT,{seed:'video-1'});
 expect(plans).toHaveLength(SCRIPT.length);
 for(const p of plans){
  expect(pieceSchema.safeParse(p.piece).success,p.sentence).toBe(true);expect(archetypes).toContain(p.piece.designed?.archetype);
  const own=words(p.sentence);
  for(const l of p.piece.layers){
   // Nothing invented: every word on screen comes from the sentence (no sample names, apps or data).
   if(l.text)for(const w of words(l.text.replace(/\S*…$/,'')))expect(own.has(w),`"${w}" in "${p.sentence}"`).toBe(true);
   if(l.type==='number')expect(numbersIn(p.sentence).map(n=>n.value)).toContain(l.value);
  }
 }
 const by=(i:number)=>plans[i]!.piece.designed!.archetype;
 expect(by(0)).toBe('stack');expect(by(1)).toBe('reveal');expect(['callout','meter']).toContain(by(4));expect(by(5)).toBe('flow');
 expect(by(6)).toBe('contrast');expect(by(7)).toBe('pins');expect(by(8)).toBe('quote');expect(['callout','meter']).toContain(by(9));expect(by(10)).toBe('action');
 // Scenes next to each other never share a composition.
 plans.slice(1).forEach((p,i)=>expect(p.piece.designed!.archetype,p.sentence).not.toBe(plans[i]!.piece.designed!.archetype));
});

it('varies the design for every video and stays reproducible for one',()=>{
 const s='Security comes built in.';
 expect(design(s,'x')).toEqual(design(s,'x'));
 const looks=new Set(['a','b','c','d','e','f'].map(seed=>JSON.stringify(design(s,seed).layers)));expect(looks.size).toBe(6);
 expect(design('Solar panels turn sunlight into power.').layers.filter(l=>l.type==='icon').map(l=>l.icon)).toEqual(expect.arrayContaining(['sun','bolt']));
});

it('favours compositions the brain learned were approved',()=>{
 const s='Customers love the speed, the design and the price.';
 const count=(c:number)=>Array.from({length:30},(_,k)=>design(s,'l'+k,{'pd-grid':c}).archetype).filter(a=>a==='grid').length;
 expect(count(.97)).toBeGreaterThan(count(.03)+5);
});

it('puts a designed visual on every storyboard scene',()=>{
 const sb=storyboard('Our planet needs cleaner energy.\nSolar panels turn sunlight into power.\nSecurity comes built in.\nSwitch today.',{seed:'sb'});
 expect(sb.plans.every(p=>p.piece.kind==='compose'&&p.piece.designed)).toBe(true);
 expect(requestSchema.safeParse(sb.request).success).toBe(true);
 expect(JSON.stringify(sb.request)).not.toMatch(/Sara|Slack|Your app|Starter|Pro\b/);
});

it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('renders designed visuals readably',async()=>{
 const p=await create('designed-render',SCRIPT.join('\n'),{width:540,height:960,fps:12,fontSize:36,minFontSize:18});
 p.scenes=planProject(p);for(const pl of designScenes(p.scenes.map(s=>s.text),{seed:'render'}))p.scenes[pl.index]!.piece=pl.piece;await save(p);
 const r=await openRenderer(p);
 try{for(const s of p.scenes){await r.page.evaluate(t=>window.render(t),s.start+Math.max(s.duration*.85,s.duration-.4));const q=await checkFrame(r.page);expect(q.issues.filter(i=>i.severity==='hard'),s.text).toEqual([]);}}
 finally{await r.close();}
},120000);
