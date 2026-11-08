// Saved composed pieces (assets/pieces/NAME.json): new piece designs the agent made for a
// video and kept. A request uses one with {"kind":"compose","template":"NAME","vars":{...}};
// {{name}} in the template takes the value (numbers stay numbers). The brain learns them, so a
// later video whose sentence fits finds them.
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {ROOT} from './config.js';
import {pieceSchema,type Piece} from './scene-pieces-schema.js';

export const templateSchema=z.object({name:z.string().regex(/^[a-z0-9-]{2,40}$/),description:z.string().min(10).max(400),tags:z.array(z.string().max(30)).max(20).default([]),
 vars:z.record(z.string(),z.union([z.string(),z.number()])).default({}),piece:z.object({kind:z.literal('compose')}).passthrough()}).strict();
export type Template=z.infer<typeof templateSchema>;
export const templatesDir=()=>path.join(ROOT,'assets','pieces');

export function listTemplatesSync():Template[]{
 let files:string[]=[];try{files=fsSync.readdirSync(templatesDir()).filter(f=>f.endsWith('.json'));}catch{return [];}
 return files.flatMap(f=>{try{return [templateSchema.parse(JSON.parse(fsSync.readFileSync(path.join(templatesDir(),f),'utf8')))];}catch{return [];}});
}
export async function loadTemplate(name:string){
 const t=templateSchema.parse(JSON.parse(await fs.readFile(path.join(templatesDir(),name+'.json'),'utf8').catch(()=>{throw new Error(`No saved piece "${name}". Saved: ${listTemplatesSync().map(t=>t.name).join(', ')||'none'}`);})));
 return t;
}
/** Fills a template's {{vars}}: a whole "{{n}}" value becomes the number or string; inside text it is replaced. */
export function fill(t:Template,vars:Record<string,string|number>={}){
 const v={...t.vars,...vars};
 const walk=(x:unknown):unknown=>{
  if(typeof x==='string'){const whole=x.match(/^\{\{(\w+)\}\}$/);if(whole&&whole[1]! in v){const val=v[whole[1]!]!;return typeof val==='string'&&/^-?\d+(\.\d+)?$/.test(val)?Number(val):val;}
   return x.replace(/\{\{(\w+)\}\}/g,(_,k:string)=>String(v[k]??''));}
  if(Array.isArray(x))return x.map(walk);
  if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,y])=>[k,walk(y)]));
  return x;
 };
 return walk(t.piece) as Record<string,unknown>;
}
function rng(seed:string){let h=2166136261;for(const c of seed)h=Math.imul(h^c.charCodeAt(0),16777619);
 return ()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
const MOVES=['up','down','left','right','fade','scale'];
/** A saved piece is a starting point, never reused as is: each video varies its scale, timing,
 *  entrances, shapes, colours and loops (seeded by the job, so a render is reproducible). */
export function vary(piece:Record<string,unknown>,seed:string){
 const r=rng(seed),layers=(piece.layers as Record<string,unknown>[]|undefined)??[];
 const scale=.9+r()*.14,dy=(r()-.5)*.06,stagger=.8+r()*.45,dur=.85+r()*.35,swap=r()<.5;
 const shapeTo=['circle','rect','blob','pill'][Math.floor(r()*4)]!,loopTo=['float','pulse','sway'][Math.floor(r()*3)]!;
 const next=layers.map(l0=>{const l={...l0} as Record<string,unknown>;const inn={...(l.in as Record<string,unknown>|undefined)};
  for(const k of ['x','y'] as const)if(typeof l[k]==='number')l[k]=Math.min(1.15,Math.max(-.15,.5+((l[k] as number)-.5)*scale+(k==='y'?dy:0)));
  for(const k of ['w','h'] as const)if(typeof l[k]==='number')l[k]=Math.min(1.35,(l[k] as number)*scale);
  if(typeof inn.at==='number')inn.at=Number(((inn.at as number)*stagger).toFixed(3));if(typeof inn.dur==='number')inn.dur=Number(((inn.dur as number)*dur).toFixed(3));
  if(MOVES.includes(String(inn.from??'up'))&&r()<.55)inn.from=MOVES[Math.floor(r()*MOVES.length)];
  if(l.type==='shape'&&l.shape!=='ring'&&r()<.6)l.shape=shapeTo;
  if(swap&&(l.type==='shape'||l.type==='icon')){if(l.fill==='primary')l.fill='accent';else if(l.fill==='accent')l.fill='primary';if(l.color==='primary')l.color='accent';else if(l.color==='accent')l.color='primary';}
  if(l.loop&&r()<.5)l.loop={...(l.loop as object),kind:loopTo};else if(!l.loop&&l.type==='icon'&&r()<.35)l.loop={kind:loopTo,amount:.3};
  l.in=inn;return l;});
 return {...piece,layers:next};
}
/** Replaces template references in a piece (also inside a phone or browser) with their layers,
 *  varied for this video (pass no seed only to inspect a template exactly). */
export async function expandPiece(p:Piece,seed?:string):Promise<Piece>{
 const one=async(c:Record<string,unknown>)=>{
  if(c.kind!=='compose'||!c.template)return c;
  const t=await loadTemplate(String(c.template));const filled=fill(t,(c.vars??{}) as Record<string,string|number>);
  const {template:_t,vars:_v,...own}=c;void _t;void _v;
  const out={...filled,...own,layers:(own.layers as unknown[]|undefined)?.length?own.layers:filled.layers};
  return seed?vary(out,seed+':'+String(c.template)):out;
 };
 const raw=p as unknown as Record<string,unknown>;
 const next=raw.kind==='phone'||raw.kind==='browser'?{...raw,screen:await one(raw.screen as Record<string,unknown>)}:await one(raw);
 return pieceSchema.parse(next);
}
export async function saveTemplate(t:Template,{overwrite=false}={}){
 const parsed=templateSchema.parse(t);
 pieceSchema.parse(fill(parsed)); // the filled piece must be valid
 const file=path.join(templatesDir(),parsed.name+'.json');await fs.mkdir(templatesDir(),{recursive:true});
 if(!overwrite&&await fs.access(file).then(()=>true,()=>false))throw new Error(`A saved piece "${parsed.name}" exists; choose another name or pass --overwrite`);
 await fs.writeFile(file,JSON.stringify(parsed,null,1)+'\n');
 try{(await import('./brain/brain.js')).sync();}catch{/* the brain learns it on the next sync */}
 return file;
}
