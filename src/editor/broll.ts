// B-roll from the user's own footage: their clips are split into shots, each with a sheet of three
// frames and a description (from the file name at first; then the user's words, or the agent's
// after it looked at the sheet). For each sentence of an edit, the shot whose description says the
// same thing is suggested, with the words they share. The footage stays where it is; only the index,
// the sheets and the descriptions are kept.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT} from '../engine/config.js';
import {ffmpeg,probe,run} from '../renderer/ffmpeg-encoder.js';
import {findShots} from './shots.js';

export type BrollShot={n:number;start:number;end:number;description:string;by:'name'|'you'|'agent';sheet:string};
export type BrollClip={id:string;file:string;name:string;added:string;duration:number;width:number;height:number;shots:BrollShot[]};
export const brollRoot=()=>path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','edits','broll');
const indexFile=()=>path.join(brollRoot(),'index.json');
export function library():BrollClip[]{try{return (JSON.parse(fs.readFileSync(indexFile(),'utf8')) as {clips:BrollClip[]}).clips;}catch{return [];}}
function save(clips:BrollClip[]){fs.mkdirSync(brollRoot(),{recursive:true});const tmp=indexFile()+'.tmp';fs.writeFileSync(tmp,JSON.stringify({version:1,clips},null,1)+'\n');fs.renameSync(tmp,indexFile());}
const fromName=(f:string)=>path.basename(f,path.extname(f)).replace(/^(img|vid|mvi|dsc|pxl|gopr)[_-]?\d+/i,'').replace(/[_\-.]+/g,' ').replace(/\b\d{6,}\b/g,'').replace(/\s+/g,' ').trim();

/** Adds the user's clips: their shots, a sheet of three frames for each, and a first description. */
export async function addClips(files:string[]){
 const clips=library(),added:BrollClip[]=[];
 for(const f of files){
  const file=path.resolve(f);if(!fs.existsSync(file))throw new Error('No such file: '+f);
  const id='clip-'+createHash('sha1').update(file).digest('hex').slice(0,10);if(clips.some(c=>c.id===id))continue;
  const info=await probe(file),v=(info.streams as {codec_type:string;width?:number;height?:number}[]).find(s=>s.codec_type==='video');if(!v)throw new Error('Not a video: '+f);
  const {duration,shots}=await findShots(file),dir=path.join(brollRoot(),id);fs.mkdirSync(dir,{recursive:true});
  const name=fromName(file);
  const made:BrollShot[]=[];
  for(const s of shots){const sheet=path.join(dir,`shot-${s.n}.jpg`),len=s.end-s.start;
   await run(ffmpeg,['-v','error','-y','-ss',(s.start+len*.15).toFixed(2),'-i',file,'-vf',`fps=${(3/Math.max(.3,len*.7)).toFixed(3)},scale=240:-2,tile=3x1:padding=4:color=0x101010`,'-frames:v','1','-q:v','4',sheet]);
   made.push({...s,description:name,by:'name',sheet});}
  const c:BrollClip={id,file,name:path.basename(file),added:new Date().toISOString(),duration,width:Number(v.width),height:Number(v.height),shots:made};clips.push(c);added.push(c);
 }
 save(clips);return {added:added.map(c=>({id:c.id,name:c.name,shots:c.shots.length})),clips:clips.length,
  next:'Look at each shot\'s sheet and describe what it shows: pnpm tempoloom edit broll describe CLIP SHOT "WHAT IT SHOWS" (or on the Edit by text page).'};
}
export function describe(clip:string,shot:number,text:string,by:'you'|'agent'='you'){
 const clips=library(),c=clips.find(x=>x.id===clip);if(!c)throw new Error('No clip '+clip);
 const s=c.shots.find(x=>x.n===shot);if(!s)throw new Error(`No shot ${shot} in ${c.name}`);
 const t=text.replace(/\s+/g,' ').trim();if(t.length<4)throw new Error('Say what the shot shows, in a few words');
 s.description=t.slice(0,300);s.by=by;save(clips);return {clip,shot,description:s.description};
}
export function removeClip(clip:string){const clips=library(),c=clips.find(x=>x.id===clip);if(!c)throw new Error('No clip '+clip);
 fs.rmSync(path.join(brollRoot(),clip),{recursive:true,force:true});save(clips.filter(x=>x!==c));return {removed:c.name,note:'Only the index and its sheets were removed; your video file is where it was.'};}
export function sheetFile(clip:string,shot:number){const s=library().find(c=>c.id===clip)?.shots.find(x=>x.n===shot);if(!s||!fs.existsSync(s.sheet))throw new Error('No such sheet');return s.sheet;}

// ---------- matching what is said to what a shot shows ----------
const STOP=new Set(['the','a','an','and','or','to','of','in','on','at','is','it','its','this','that','we','you','your','our','i','my','for','with','be','are','was','were','so','but','just','very','really','then','than','there','here','they','them','what','when','how','all','can','will','do','does','not','no','have','has','had','into','from','about','up','out','more','most','some','one','get','got','make','made','also','as','by','if','like','video','shot','clip']);
/** A rough stem, so "pouring", "pours" and "poured" meet "pour". */
export const stem=(w:string)=>w.length<=4?w:w.replace(/(ing|ings|ed|es|s|ly)$/,'').replace(/(.)\1$/,'$1');
const words=(s:string)=>s.toLowerCase().normalize('NFKC').split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>2&&!STOP.has(w));
export type Suggestion={sentence:number;clip:string;shot:number;start:number;end:number;score:number;shared:string[];description:string};
/** For each sentence, the shot that shows what it says (at least one shared word that matters). */
export function suggest(sentences:{n:number;text:string;start:number;end:number}[],o:{clips?:BrollClip[];min?:number;skip?:Set<number>}={}):Suggestion[]{
 const clips=o.clips??library(),shots=clips.flatMap(c=>c.shots.map(s=>({c,s,w:new Map(words(s.description).map(w=>[stem(w),w]))})));
 if(!shots.length)return [];
 const out:Suggestion[]=[],used=new Map<string,number>();let last='',lastN=-9;
 for(const se of sentences){if(o.skip?.has(se.n)||se.end-se.start<1.2)continue;
  const sw=[...new Set(words(se.text))],ss=new Set(sw.map(stem));
  // A shot already suggested counts for less (variety), and never twice in a row.
  const ranked=shots.map(x=>{const shared=[...x.w.keys()].filter(k=>ss.has(k)).map(k=>x.w.get(k)!),key=`${x.c.id}#${x.s.n}`;return {x,key,shared,score:shared.length/Math.sqrt(Math.max(2,x.w.size))/(1+(used.get(key)??0))};})
   .filter(r=>r.shared.length&&r.score>=(o.min??.4)).sort((a,b)=>b.score-a.score);
  const pick=ranked.find(r=>!(r.key===last&&lastN===se.n-1));if(!pick)continue;last=pick.key;lastN=se.n;used.set(pick.key,(used.get(pick.key)??0)+1);
  out.push({sentence:se.n,clip:pick.x.c.id,shot:pick.x.s.n,start:pick.x.s.start,end:pick.x.s.end,score:+pick.score.toFixed(2),shared:pick.shared,description:pick.x.s.description});
 }
 return out;
}
