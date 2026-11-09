// Chooses the pieces' design style and sound kit for a video: from the words of the brief,
// the genre, the brand's colours, what the brain has learned (approved or rejected styles and
// the user's stated preferences), and the recent videos (so styles rotate instead of repeating).
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT} from './config.js';
import {skins,skinIds,type Skin} from '../components/pieces/skins.js';
import {breed,distance,traits,traitLabel,examples,type Genome} from '../components/pieces/genome.js';
import {soundKits,type SoundKit} from './sound-kits.js';
import type {PieceTheme} from './scene-pieces-schema.js';

const GENRE_STYLES:Record<string,string[]>={'saas-promo':['soft','glass','outline','neon'],'app-launch':['pop','clay','glass'],explainer:['editorial','outline','soft','clay'],
 'product-ad':['pop','brutal','glass'],tutorial:['outline','soft','neon'],general:[]};
const lum=(c:string)=>{const [r,g,b]=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));return (r!*299+g!*587+b!*114)/1000;};
const words=(s:string)=>new Set(s.toLowerCase().normalize('NFKC').split(/[^\p{L}\p{N}-]+/u).filter(Boolean).flatMap(w=>[w,w.replace(/s$/,'')]));

export type StyleInput={brief:string;genre?:string;brand?:Partial<PieceTheme>;preset?:string;recent?:string[];
 /** Brain items about styles: id ps-<style> with confidence, and preferences that name a style. */
 knowledge?:{id:string;title:string;use:string;kind:string;confidence:number;always?:boolean}[]};
export type StyleChoice={style:string;soundKit:SoundKit;why:string[];ranking:{style:string;score:number}[]};

const NEG=/\b(no|not|never|avoid|don't|stop)\b/i;
type K={id:string;title:string;use:string;kind:string};
/** Only what the user said steers styles by name: feedback lessons (fb-*) and stated preferences, not general knowledge. */
const userSaid=(k:K)=>k.id.startsWith('fb-')||k.kind==='preference';
const mentions=(k:K,id:string)=>new RegExp(`\\b(${id}|${skins[id]!.name.toLowerCase()})\\b(\\s+(style|look|design))?`,'i').test(k.title+' '+k.use)&&/style|look|design|piece|card/i.test(k.title+' '+k.use);
export function chooseStyle(i:StyleInput):StyleChoice{
 const w=words(i.brief+' '+(i.preset??''));const why=new Map<string,string[]>();
 const note=(id:string,s:string)=>why.set(id,[...(why.get(id)??[]),s]);
 const scored=skinIds.map(id=>{
  const sk=skins[id]!;let score=0;
  const hits=sk.mood.filter(m=>w.has(m));if(hits.length){score+=hits.length*1.5;note(id,'the brief says '+hits.slice(0,3).join(', '));}
  const g=GENRE_STYLES[i.genre??'general']??[];const gi=g.indexOf(id);if(gi>=0){score+=1.2-gi*.25;note(id,`suits a ${i.genre}`);}
  if(i.brand?.background&&lum(i.brand.background)<80){if(sk.dark){score+=2;note(id,'the brand is dark');}else score-=.5;}
  if(/black|dark|night/.test(i.preset??'')&&sk.dark){score+=1.5;note(id,'the video style is dark');}
  for(const k of i.knowledge??[]){
   if(k.id==='ps-'+id){const d=(k.confidence-.5)*4;score+=d;if(Math.abs(d)>.3)note(id,d>0?'it worked well before':'it was rejected before');}
   else if(userSaid(k)&&mentions(k,id)){
    const against=k.kind==='avoid'||NEG.test(k.title+' '+k.use);score+=against?-4:3;note(id,against?'you asked to avoid it':'you asked for it');}
  }
  const r=(i.recent??[]).indexOf(id);if(r>=0){score-=r===0?2.5:r<3?1:.4;note(id,'used recently');}
  // A small stable nudge from the brief, so equal scores do not always pick the same style.
  score+=parseInt(createHash('sha256').update(i.brief+id).digest('hex').slice(0,4),16)/65535*.6;
  return {style:id,score:Math.round(score*100)/100};
 }).sort((a,b)=>b.score-a.score);
 const best=scored[0]!.style;
 return {style:best,soundKit:skins[best]!.sound,why:why.get(best)??['rotating styles between videos'],ranking:scored};
}

// ---------- history: every style ever made (the next one must differ from all of them) ----------
type Used={style:string;job:string;at:string;genome?:Genome;parents?:string[]};
const historyFile=()=>path.join(ROOT,process.env.VIDEO_WORKSPACE||'workspace','history','piece-styles.json');
async function history():Promise<Used[]>{try{return JSON.parse(await fs.readFile(historyFile(),'utf8')) as Used[];}catch{return [];}}
/** The examples the last videos were bred from (most recent first), so the next one starts elsewhere. */
export async function recentStyles(n=5){return (await history()).slice(-n).reverse().map(x=>x.parents?.[0]??x.style);}
export async function usedGenomes(n=200){return (await history()).slice(-n).flatMap(x=>x.genome?[x.genome]:[]);}
export async function rememberStyle(style:string,job:string,genome?:Genome){
 const f=historyFile();const list=(await history()).filter(x=>x.job!==job);
 list.push({style,job,at:new Date().toISOString(),...(genome?{genome,parents:genome.parents}:{})});await fs.mkdir(path.dirname(f),{recursive:true});await fs.writeFile(f,JSON.stringify(list.slice(-300),null,1)+'\n');
}

// ---------- designing a new style ----------
export type Designed={genome:Genome;why:string[];parents:{id:string;w:number}[];novelty:number};
/** A new style for this video: the examples that fit the brief become parents, the brain's
 *  learned traits steer the mutations, and it must differ from every style used before. */
export function designStyle(i:StyleInput&{seed:string;used?:Genome[];learned?:Record<string,number>;base?:string}):Designed{
 const ch=chooseStyle(i);
 const top=ch.ranking.slice(0,4),min=Math.min(...top.map(r=>r.score));
 let parents=top.map(r=>({id:r.style,w:Math.max(.15,r.score-min+.6)}));
 if(i.base&&isStyle(i.base))parents=[{id:i.base,w:6},...parents.filter(p=>p.id!==i.base).slice(0,2).map(p=>({...p,w:p.w*.5}))];
 // Styles the user said to avoid lend no traits; their signature traits are steered away from.
 const avoidIds=(i.knowledge??[]).filter(k=>userSaid(k)&&(k.kind==='avoid'||NEG.test(k.title+' '+k.use))).flatMap(k=>skinIds.filter(id=>mentions(k,id)));
 parents=parents.filter(p=>!avoidIds.includes(p.id));if(!parents.length)parents=[{id:'soft',w:1}];
 const avoid=avoidIds.flatMap(id=>traits(examples[id]!.g).filter(t=>!/tone-light|accent-brand|case-normal|fill-solid|border-thin/.test(t)));
 const dark=!!(i.brand?.background&&lum(i.brand.background)<80)||/black|dark|night/.test(i.preset??'');
 const used=i.used??[];
 const genome=breed({seed:i.seed,parents,learned:i.learned,avoid,used,dark,adventure:i.base?.25:.4});
 const novelty=used.length?Math.min(...used.map(u=>distance(genome,u))):1;
 const why=[...(i.base?[`based on ${skins[i.base]?.name??i.base}, as you asked`]:[]),`bred from ${parents.slice(0,3).map(p=>skins[p.id]?.name??p.id).join(', ')}`,...(ch.why.length?[ch.why.join('; ')]:[]),
  ...(avoid.length?['steering away from styles you rejected']:[]),...(used.length?[`differs from all ${used.length} earlier styles`]:[])];
 return {genome,why,parents,novelty};
}
/** What the brain has learned about each trait: pt-<trait> → confidence (0.5 untested). */
export async function learnedTraits(){
 try{const brain=await import('./brain/brain.js');const out:Record<string,number>={};
  for(const k of (await import('./brain/db.js')).allKnowledge())if(k.id.startsWith('pt-'))out[k.id]=.5+brain.confidence(k)-brain.confidence({status:k.status,wins:0,losses:0});
  return out;}catch{return {};}
}
/** Brain records for the layouts a video used (pt-layout-<kind>-<variant>), so verdicts teach layouts too. */
export async function registerLayoutTraits(pieces:unknown[]){
 try{const brain=await import('./brain/brain.js');const ids:string[]=[];
  for(const p of pieces as ({kind:string;layout?:string;screen?:{kind:string;layout?:string}}|undefined)[]){const c=p?.kind==='phone'||p?.kind==='browser'?p.screen:p;if(!c?.layout)continue;
   const id=`pt-layout-${c.kind}-${c.layout}`;ids.push(id);
   if(!brain.getKnowledge(id))brain.add({id,title:`Layout: ${c.kind} as ${c.layout}`,body:`The ${c.layout} layout of the ${c.kind} piece. Its record rises when videos using it are approved and falls when they are rejected; new videos favour layouts that worked.`,domain:'motion',kind:'technique',tags:['layout','piece',c.kind,c.layout],source:'piece-layouts',status:'trial'});}
  return [...new Set(ids)];}catch{return [];}
}
/** Makes sure the brain has a record for each trait of a style, so verdicts can score them. */
export async function registerTraits(g:Genome){
 try{const brain=await import('./brain/brain.js');const ids:string[]=[];
  for(const t of traits(g)){const id='pt-'+t;ids.push(id);
   if(!brain.getKnowledge(id))brain.add({id,title:'Style trait: '+traitLabel(t),body:`A design trait of generated piece styles (${traitLabel(t)}). Its record rises when videos using it are approved and falls when they are rejected; new styles favour traits that worked.`,domain:'motion',kind:'technique',tags:['style','trait',...t.split('-')],source:'style-genome',status:'trial'});}
  return ids;}catch{return [];}
}
/** Brain items that bear on the style choice (never blocks if the brain is unavailable). */
export async function styleKnowledge(brief:string){
 try{const brain=await import('./brain/brain.js');brain.sync();const r=brain.recall('piece style '+brief.slice(0,600),{limit:40}).items;
  // Only what was learned counts: confidence relative to an untested entry of the same status.
  const ps=skinIds.map(id=>brain.getKnowledge('ps-'+id)).filter(Boolean).map(k=>({id:k!.id,title:k!.title,use:k!.body,kind:k!.kind,
   confidence:.5+brain.confidence(k!)-brain.confidence({status:k!.status,wins:0,losses:0})}));
  return [...r.filter(k=>!k.id.startsWith('ps-')).map(k=>({id:k.id,title:k.title,use:k.use,kind:k.kind,confidence:k.confidence,always:k.always})),...ps];
 }catch{return [];}
}
export const isStyle=(s:string):s is string=>skinIds.includes(s);
export const isKit=(s:string):s is SoundKit=>(soundKits as readonly string[]).includes(s);
export type {Skin};
