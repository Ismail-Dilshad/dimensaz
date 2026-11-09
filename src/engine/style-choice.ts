// Designs each video's style from zero (components/pieces/genome.ts): cues from the brief, the
// user's own wishes (a direction in the request, preferences and rules in their feedback), what
// the brain learned from verdicts, and every style used before (the new one must differ).
import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT} from './config.js';
import {generate,traits,traitLabel,distance,traitsFromWords,cuesOf,type Genome} from '../components/pieces/genome.js';
import {soundKits,type SoundKit} from './sound-kits.js';
import type {PieceTheme} from './scene-pieces-schema.js';

const lum=(c:string)=>{const [r,g,b]=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));return (r!*299+g!*587+b!*114)/1000;};
const NEG=/\b(no|not|never|avoid|don't|stop|less)\b/i;
type K={id:string;title:string;use:string;kind:string};
/** Only what the user said steers styles: feedback lessons (fb-*) and stated preferences. */
const userSaid=(k:K)=>k.id.startsWith('fb-')||k.kind==='preference';

// ---------- history: every style ever made (the next one must differ from all of them) ----------
type Used={style:string;job:string;at:string;genome?:Genome};
const historyFile=()=>path.join(ROOT,process.env.VIDEO_WORKSPACE||'workspace','history','piece-styles.json');
async function history():Promise<Used[]>{try{return JSON.parse(await fs.readFile(historyFile(),'utf8')) as Used[];}catch{return [];}}
export async function usedGenomes(n=200){return (await history()).slice(-n).flatMap(x=>x.genome?[x.genome]:[]);}
export async function rememberStyle(style:string,job:string,genome?:Genome){
 const f=historyFile();const list=(await history()).filter(x=>x.job!==job);
 list.push({style,job,at:new Date().toISOString(),...(genome?{genome}:{})});await fs.mkdir(path.dirname(f),{recursive:true});await fs.writeFile(f,JSON.stringify(list.slice(-300),null,1)+'\n');
}

export type StyleInput={seed:string;brief:string;
 /** The user's own direction for the look ("dark and glowing", "calm paper"), from the request. */
 direction?:string;brand?:Partial<PieceTheme>;preset?:string;
 knowledge?:{id:string;title:string;use:string;kind:string;confidence:number;always?:boolean}[];
 used?:Genome[];learned?:Record<string,number>;
 /** A look learned from a video the user likes (looks.ts): it nudges traits, never copies. */
 like?:{name:string;steer:Record<string,number>;summary:string[]}};
export type Designed={genome:Genome;why:string[];novelty:number};

/** A new style for this video. */
export function designStyle(i:StyleInput):Designed{
 const prefer=[...traitsFromWords(i.direction??'')],avoid:string[]=[];
 for(const k of i.knowledge??[])if(userSaid(k)&&/style|look|design|colou?r|dark|light|font|corner|shadow|motion/i.test(k.title+' '+k.use)){
  const t=traitsFromWords(k.title+' '+k.use);(NEG.test(k.title+' '+k.use)||k.kind==='avoid'?avoid:prefer).push(...t);}
 const dark=!!(i.brand?.background&&lum(i.brand.background)<80)||/black|dark|night/.test(i.preset??'');
 const used=i.used??[];
 const genome=generate({seed:i.seed,brief:i.brief+' '+(i.direction??''),learned:i.learned,prefer,avoid,used,dark,steer:i.like?.steer});
 const novelty=used.length?Math.min(...used.map(u=>distance(genome,u))):1;
 const cues=[...new Set(cuesOf(i.brief))];
 const why=[`designed from zero for this video`,...(cues.length?[`the brief's words (${cues.slice(0,5).join(', ')}) steered it`]:[]),...(prefer.length?['your direction and preferences favoured some traits']:[]),
  ...(avoid.length?['steering away from what you rejected']:[]),...(i.like?[`in the spirit of the look "${i.like.name}" (${i.like.summary.join(', ')}), without copying it`]:[]),...(used.length?[`differs from all ${used.length} earlier styles`]:[])];
 return {genome,why,novelty};
}
/** What the brain has learned from verdicts about each style trait (pt-<trait>) and each
 *  composition of the scene visuals (pd-<composition>): id → confidence (0.5 untested). */
export async function learnedTraits(){
 try{const brain=await import('./brain/brain.js');const out:Record<string,number>={};
  for(const k of (await import('./brain/db.js')).allKnowledge())if(/^p[td]-/.test(k.id)&&!k.id.startsWith('pt-layout-'))out[k.id]=.5+brain.confidence(k)-brain.confidence({status:k.status,wins:0,losses:0});
  return out;}catch{return {};}
}
/** Makes sure the brain has a record for each trait of a style, so verdicts can score them. */
export async function registerTraits(g:Genome){
 try{const brain=await import('./brain/brain.js');const ids:string[]=[];
  for(const t of traits(g)){const id='pt-'+t;ids.push(id);
   if(!brain.getKnowledge(id))brain.add({id,title:'Style trait: '+traitLabel(t),body:`A design trait of generated styles (${traitLabel(t)}). Its record rises when videos using it are approved and falls when they are rejected; new styles favour traits that worked.`,domain:'motion',kind:'technique',tags:['style','trait',...t.split('-')],source:'style-genome',status:'trial'});}
  return ids;}catch{return [];}
}
/** Makes sure the brain has a record for each composition the video's visuals used (pd-<name>). */
export async function registerDesigns(pieces:({designed?:{archetype:string;description:string}}|undefined)[]){
 try{const brain=await import('./brain/brain.js');const ids=new Set<string>();
  for(const d of pieces.flatMap(p=>p?.designed?[p.designed]:[])){const id='pd-'+d.archetype;ids.add(id);
   if(!brain.getKnowledge(id))brain.add({id,title:'Composition: '+d.archetype,body:`A way the designer composes a scene visual from layers: ${d.description} Its record rises when videos using it are approved and falls when they are rejected; the designer favours compositions that worked.`,domain:'motion',kind:'technique',tags:['composition','design',d.archetype],source:'piece-designer',status:'trial'});}
  return [...ids];}catch{return [];}
}
/** The user's feedback and preferences that bear on the look (never blocks if the brain is unavailable). */
export async function styleKnowledge(brief:string){
 try{const brain=await import('./brain/brain.js');brain.sync();
  return brain.recall('style look design '+brief.slice(0,600),{limit:40}).items.map(k=>({id:k.id,title:k.title,use:k.use,kind:k.kind,confidence:k.confidence,always:k.always}));
 }catch{return [];}
}
export const isKit=(s:string):s is SoundKit=>(soundKits as readonly string[]).includes(s);
