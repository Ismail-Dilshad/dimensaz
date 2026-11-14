// The gallery: every video the agent made or edited. Three sources, merged by file: videos a
// studio step showed (the final and the previews of each job), the outputs of finished jobs the
// brain recorded, and the export folder. Only numbers, names and the user's stars are kept here;
// the files stay where they are and are never moved or deleted.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT} from './config.js';
import {allJobs,dbPath} from './brain/db.js';
import {readPlan,studioRoot,type Plan} from './studio.js';
import {inspect} from './teach/measure.js';
import {VIDEO_KINDS,videoKind,lengthTag,shapeOf,type VideoKind} from './categories.js';
import {verdict as brainVerdict} from './brain/brain.js';
import {rate as rateStep} from './studio.js';
import {change,touch,adapter} from './history.js';
import {ffmpeg,run} from '../renderer/ffmpeg-encoder.js';

const VIDEO=/\.(mp4|mov|webm|m4v|mkv)$/i;
export type GalleryItem={id:string;file:string;name:string;title:string;kind:'final'|'preview'|'export';mode:'motion'|'edit'|'unknown';made:string;bytes:number;
 job:string|null;step:string|null;rating:'good'|'ok'|'bad'|null;verdict:string|null;check:{passed:number;near:number;off:number}|null;starred:boolean;
 seconds:number|null;width:number|null;height:number|null;
 /** Filled in automatically: the kind of video, and tags from its shape and length. */
 category:VideoKind;tags:string[];brief:string;ratedHere:boolean;note:string|null;brainJob:string|null;canDelete:boolean};
const idOf=(file:string)=>createHash('sha1').update(path.resolve(file)).digest('hex').slice(0,16);
const rel=(f:string)=>path.relative(ROOT,f).split(path.sep).join('/');
export const outputRoot=()=>path.resolve(ROOT,process.env.VIDEO_OUTPUT||'mp2');
const stateFile=()=>path.join(path.dirname(dbPath()),'gallery.json');
type State={starred:string[];hidden:string[];ratings:Record<string,{rating:'good'|'ok'|'bad';note:string;at:string}>};
const readState=():State=>{try{const s=JSON.parse(fs.readFileSync(stateFile(),'utf8')) as Partial<State>;return {starred:s.starred??[],hidden:s.hidden??[],ratings:s.ratings??{}};}catch{return {starred:[],hidden:[],ratings:{}};}};
/** A file the gallery may delete: only inside the project's export folder or its workspace. */
const deletable=(abs:string)=>[outputRoot(),path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace')].some(root=>{const r=path.relative(root,abs);return !!r&&!r.startsWith('..')&&!path.isAbsolute(r);});
const writeState=(s:State)=>{fs.mkdirSync(path.dirname(stateFile()),{recursive:true});fs.writeFileSync(stateFile(),JSON.stringify(s)+'\n');};

function plans():Plan[]{
 let names:string[]=[];try{names=fs.readdirSync(studioRoot());}catch{return [];}
 return names.filter(n=>/^[a-z0-9][a-z0-9-]{0,60}$/.test(n)).map(n=>{try{return readPlan(n);}catch{return null;}}).filter((p):p is Plan=>!!p);
}
function walk(dir:string,depth:number,out:string[]){
 if(depth<0||out.length>=400)return;let entries:fs.Dirent[]=[];try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch{return;}
 for(const e of entries){const f=path.join(dir,e.name);if(e.isDirectory()){if(!e.name.startsWith('.'))walk(f,depth-1,out);}else if(VIDEO.test(e.name))out.push(f);}
}
const jobTitle=(p:Plan)=>{const m=/(?:to use as written|write one\)|What the user wants):\n([^\n]+)/.exec(p.request);return (m?m[1]!:p.request.split('\n')[0]!).slice(0,90);};
const media=new Map<string,{seconds:number;width:number;height:number}|null>();
/** Every video the agent made, newest first. Lengths and sizes are read once per file and remembered. */
export async function gallery(o:{hidden?:boolean}={}){
 const state=readState(),starred=new Set(state.starred),hidden=new Set(state.hidden),by=new Map<string,GalleryItem>();
 const add=(file:string,x:Partial<GalleryItem>&{title:string;kind:GalleryItem['kind']})=>{
  const abs=path.resolve(file);if(!VIDEO.test(abs))return;let st:fs.Stats;try{st=fs.statSync(abs);}catch{return;}if(!st.isFile()||st.size<1024)return;
  const id=idOf(abs),cur=by.get(id);
  // A file seen twice keeps the richer record: a final beats a preview, a studio step beats a bare export.
  const rank={final:3,preview:2,export:1} as const;
  if(cur&&rank[cur.kind]>=rank[x.kind])return;
  by.set(id,{id,file:rel(abs),name:path.basename(abs),mode:'unknown',made:st.mtime.toISOString(),bytes:st.size,job:null,step:null,rating:null,verdict:null,check:null,starred:starred.has(id),seconds:null,width:null,height:null,
   category:'other',tags:[],brief:'',ratedHere:false,note:null,brainJob:null,canDelete:deletable(abs),...cur,...x});
 };
 for(const p of plans())for(const t of p.tasks)for(const f of t.show??[]){
  const r=(p.ratings??[]).filter(x=>x.task===t.id).at(-1);
  add(f,{brief:p.request,title:jobTitle(p),kind:t.id==='final'?'final':'preview',mode:p.type==='footage-edit'?'edit':'motion',job:p.job,step:t.id,rating:r?.rating??null,verdict:p.verdict??null,
   check:t.selfcheck?{passed:t.selfcheck.passed,near:t.selfcheck.near,off:t.selfcheck.off}:null});}
 for(const j of allJobs())if(j.output){const cur=by.get(idOf(path.resolve(ROOT,j.output)));if(cur)cur.brainJob=j.id;add(path.resolve(ROOT,j.output),{brainJob:j.id,brief:j.brief,title:j.title||j.brief.slice(0,90)||path.basename(j.output),kind:'export',mode:j.kind==='edit'?'edit':'motion',verdict:j.verdict});}
 const found:string[]=[];walk(outputRoot(),4,found);
 for(const f of found)add(f,{title:path.basename(f).replace(VIDEO,'').replace(/[-_]+/g,' '),kind:/preview/i.test(f)?'preview':'export'});
 const items=[...by.values()].filter(i=>o.hidden||!hidden.has(i.id)).sort((a,b)=>b.made.localeCompare(a.made));
 await Promise.all(items.slice(0,120).map(async i=>{const key=i.id+':'+i.bytes;if(!media.has(key))media.set(key,await inspect(path.resolve(ROOT,i.file)).then(m=>({seconds:Math.round(m.seconds*10)/10,width:m.width,height:m.height}),()=>null));
  const m=media.get(key);if(m)Object.assign(i,m);}));
 for(const i of items){
  // The user's own rating of the video (given here) shows first; otherwise the rating of the step that made it.
  const mine=state.ratings[i.id];if(mine){i.rating=mine.rating;i.ratedHere=true;i.note=mine.note||null;}
  const shape=shapeOf(i.width,i.height);
  i.category=videoKind(`${i.brief} ${i.title} ${i.name}`,{mode:i.mode,seconds:i.seconds,shape});
  i.tags=[i.mode==='edit'?'Edit':i.mode==='motion'?'Motion':null,shape?shape[0]!.toUpperCase()+shape.slice(1):null,lengthTag(i.seconds)].filter((t):t is string=>!!t);
  i.brief='';
 }
 return {items,hidden:[...by.values()].filter(i=>hidden.has(i.id)).length,
  totals:{all:items.length,finals:items.filter(i=>i.kind==='final').length,previews:items.filter(i=>i.kind==='preview').length,exports:items.filter(i=>i.kind==='export').length,starred:items.filter(i=>i.starred).length,
   megabytes:Math.round(items.reduce((a,i)=>a+i.bytes,0)/1048576),rated:items.filter(i=>i.rating).length,good:items.filter(i=>i.rating==='good').length,bad:items.filter(i=>i.rating==='bad').length},
  categories:VIDEO_KINDS.map(k=>({id:k.id,label:k.label,count:items.filter(i=>i.category===k.id).length})).filter(c=>c.count),folder:rel(outputRoot()).startsWith('..')?'':rel(outputRoot())};
}
/** The file of a gallery item (only files the gallery itself lists can be opened). */
export async function galleryFile(id:string){const g=await gallery({hidden:true}),i=g.items.find(x=>x.id===id);if(!i)throw new Error('No such video in the gallery');return path.resolve(ROOT,i.file);}
export function star(id:string,on:boolean){const s=readState();s.starred=on?[...new Set([...s.starred,id])]:s.starred.filter(x=>x!==id);writeState(s);return {id,starred:on};}
/** Hides a video from the gallery, or shows it again. The file is not touched. */
export function hide(id:string,on:boolean){const s=readState();s.hidden=on?[...new Set([...s.hidden,id])]:s.hidden.filter(x=>x!==id);writeState(s);return {id,hidden:on};}
/** A small still of a gallery video, made once and kept beside the brain's database. */
export async function galleryThumb(id:string){
 const file=await galleryFile(id),st=await fsp.stat(file),out=path.join(path.dirname(dbPath()),'gallery-thumbs',`${id}-${st.size}.jpg`);
 try{await fsp.access(out);return out;}catch{/* make it */}
 await fsp.mkdir(path.dirname(out),{recursive:true});
 const m=await inspect(file);
 await run(ffmpeg,['-v','error','-y','-ss',String(Math.min(m.seconds*.3,Math.max(0,m.seconds-.1))),'-i',file,'-frames:v','1','-vf','scale=480:480:force_original_aspect_ratio=decrease','-q:v','4',out]);
 return out;
}
/** The user's rating of a finished video. It is kept with the gallery; when the video came from
 *  a studio step that is not rated yet, that step is rated too (so its lessons are scored), and a
 *  video the brain recorded gets its verdict. A bad rating needs a reason. */
export async function rateVideo(id:string,rating:'good'|'ok'|'bad',note=''){
 if(!['good','ok','bad'].includes(rating))throw new Error('The rating is good, ok or bad');
 const g=await gallery({hidden:true}),i=g.items.find(x=>x.id===id);if(!i)throw new Error('No such video in the gallery');
 note=note.trim().slice(0,600);if(rating==='bad'&&note.length<4)throw new Error('Say what is wrong with it, so it can be remembered');
 return change({kind:'ratings',...(i.job?{job:i.job}:{}),title:`You rated "${i.title.slice(0,60)}" in the gallery: ${rating==='ok'?'not bad':rating}`},()=>rateNow(i,id,rating,note));
}
async function rateNow(i:{job:string|null;step:string|null;brainJob:string|null;title:string},id:string,rating:'good'|'ok'|'bad',note:string){
 const s=readState();touch('gallery',id,()=>s.ratings[id]??null,i.title);s.ratings[id]={rating,note,at:new Date().toISOString()};writeState(s);
 let scored:string='nothing else';
 if(i.job&&i.step){try{await rateStep(i.job,i.step,{rating,...(note?{note}:{})});scored='the step that made it';}catch{/* that version of the step was rated already, or it is being redone */}}
 else if(i.brainJob&&rating!=='ok'){try{brainVerdict(i.brainJob,rating==='good'?'approved':'rejected');scored='the job that made it';}catch{/* no such job any more */}}
 return {id,rating,alsoRated:scored};
}
export function clearRating(id:string){return change({kind:'ratings',title:'You cleared a rating in the gallery'},()=>{const s=readState();touch('gallery',id,()=>s.ratings[id]??null,'A video in the gallery');delete s.ratings[id];writeState(s);return {id,rating:null};});}
// The change history reads and writes one gallery rating at a time (Undo).
adapter('gallery',{read:id=>readState().ratings[id]??null,write:(id,v)=>{const s=readState();if(v===null)delete s.ratings[id];else s.ratings[id]=v as State['ratings'][string];writeState(s);},label:()=>'A video in the gallery'});
/** Deletes a video the agent made, from the disk, for good. Only files inside the project's
 *  export folder or workspace can be deleted here; anything else can only be hidden. */
export async function deleteVideo(id:string){
 const g=await gallery({hidden:true}),i=g.items.find(x=>x.id===id);if(!i)throw new Error('No such video in the gallery');
 const abs=path.resolve(ROOT,i.file);
 if(!deletable(abs))throw new Error('This file is outside the project\'s export folder and workspace, so it is not deleted from here. Hide it instead.');
 await fsp.rm(abs,{force:true});
 const thumbs=path.join(path.dirname(dbPath()),'gallery-thumbs');for(const f of await fsp.readdir(thumbs).catch(()=>[] as string[]))if(f.startsWith(id+'-'))await fsp.rm(path.join(thumbs,f),{force:true});
 const s=readState();s.starred=s.starred.filter(x=>x!==id);s.hidden=s.hidden.filter(x=>x!==id);delete s.ratings[id];writeState(s);
 return {deleted:i.name,file:i.file};
}
