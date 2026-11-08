// Chooses the pieces' design style and sound kit for a video: from the words of the brief,
// the genre, the brand's colours, what the brain has learned (approved or rejected styles and
// the user's stated preferences), and the recent videos (so styles rotate instead of repeating).
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT} from './config.js';
import {skins,skinIds,type Skin} from '../components/pieces/skins.js';
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
   else if((k.kind==='preference'||k.kind==='rule'||k.kind==='avoid')&&new RegExp(`\\b(${id}|${sk.name.toLowerCase()})\\b`,'i').test(k.title+' '+k.use)){
    const against=k.kind==='avoid'||/\b(no|not|never|avoid|don't|stop)\b/i.test(k.title+' '+k.use);score+=against?-4:3;note(id,against?'you asked to avoid it':'you asked for it');}
  }
  const r=(i.recent??[]).indexOf(id);if(r>=0){score-=r===0?2.5:r<3?1:.4;note(id,'used recently');}
  // A small stable nudge from the brief, so equal scores do not always pick the same style.
  score+=parseInt(createHash('sha256').update(i.brief+id).digest('hex').slice(0,4),16)/65535*.6;
  return {style:id,score:Math.round(score*100)/100};
 }).sort((a,b)=>b.score-a.score);
 const best=scored[0]!.style;
 return {style:best,soundKit:skins[best]!.sound,why:why.get(best)??['rotating styles between videos'],ranking:scored};
}

const historyFile=()=>path.join(ROOT,process.env.VIDEO_WORKSPACE||'workspace','history','piece-styles.json');
export async function recentStyles(n=5){try{return (JSON.parse(await fs.readFile(historyFile(),'utf8')) as {style:string}[]).slice(-n).reverse().map(x=>x.style);}catch{return [];}}
export async function rememberStyle(style:string,job:string){
 const f=historyFile();let list:{style:string;job:string;at:string}[]=[];try{list=JSON.parse(await fs.readFile(f,'utf8'));}catch{/* first */}
 list.push({style,job,at:new Date().toISOString()});await fs.mkdir(path.dirname(f),{recursive:true});await fs.writeFile(f,JSON.stringify(list.slice(-50),null,1)+'\n');
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
