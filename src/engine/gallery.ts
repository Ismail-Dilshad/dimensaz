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
import {ffmpeg,run} from '../renderer/ffmpeg-encoder.js';

const VIDEO=/\.(mp4|mov|webm|m4v|mkv)$/i;
export type GalleryItem={id:string;file:string;name:string;title:string;kind:'final'|'preview'|'export';mode:'motion'|'edit'|'unknown';made:string;bytes:number;
 job:string|null;step:string|null;rating:'good'|'ok'|'bad'|null;verdict:string|null;check:{passed:number;near:number;off:number}|null;starred:boolean;
 seconds:number|null;width:number|null;height:number|null};
const idOf=(file:string)=>createHash('sha1').update(path.resolve(file)).digest('hex').slice(0,16);
const rel=(f:string)=>path.relative(ROOT,f).split(path.sep).join('/');
export const outputRoot=()=>path.resolve(ROOT,process.env.VIDEO_OUTPUT||'mp2');
const stateFile=()=>path.join(path.dirname(dbPath()),'gallery.json');
type State={starred:string[];hidden:string[]};
const readState=():State=>{try{const s=JSON.parse(fs.readFileSync(stateFile(),'utf8')) as Partial<State>;return {starred:s.starred??[],hidden:s.hidden??[]};}catch{return {starred:[],hidden:[]};}};
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
  by.set(id,{id,file:rel(abs),name:path.basename(abs),mode:'unknown',made:st.mtime.toISOString(),bytes:st.size,job:null,step:null,rating:null,verdict:null,check:null,starred:starred.has(id),seconds:null,width:null,height:null,...cur,...x});
 };
 for(const p of plans())for(const t of p.tasks)for(const f of t.show??[]){
  const r=(p.ratings??[]).filter(x=>x.task===t.id).at(-1);
  add(f,{title:jobTitle(p),kind:t.id==='final'?'final':'preview',mode:p.type==='footage-edit'?'edit':'motion',job:p.job,step:t.id,rating:r?.rating??null,verdict:p.verdict??null,
   check:t.selfcheck?{passed:t.selfcheck.passed,near:t.selfcheck.near,off:t.selfcheck.off}:null});}
 for(const j of allJobs())if(j.output)add(path.resolve(ROOT,j.output),{title:j.title||j.brief.slice(0,90)||path.basename(j.output),kind:'export',mode:j.kind==='edit'?'edit':'motion',verdict:j.verdict});
 const found:string[]=[];walk(outputRoot(),4,found);
 for(const f of found)add(f,{title:path.basename(f).replace(VIDEO,'').replace(/[-_]+/g,' '),kind:/preview/i.test(f)?'preview':'export'});
 const items=[...by.values()].filter(i=>o.hidden||!hidden.has(i.id)).sort((a,b)=>b.made.localeCompare(a.made));
 await Promise.all(items.slice(0,120).map(async i=>{const key=i.id+':'+i.bytes;if(!media.has(key))media.set(key,await inspect(path.resolve(ROOT,i.file)).then(m=>({seconds:Math.round(m.seconds*10)/10,width:m.width,height:m.height}),()=>null));
  const m=media.get(key);if(m)Object.assign(i,m);}));
 return {items,hidden:[...by.values()].filter(i=>hidden.has(i.id)).length,
  totals:{all:items.length,finals:items.filter(i=>i.kind==='final').length,previews:items.filter(i=>i.kind==='preview').length,exports:items.filter(i=>i.kind==='export').length,starred:items.filter(i=>i.starred).length,
   megabytes:Math.round(items.reduce((a,i)=>a+i.bytes,0)/1048576)},folder:rel(outputRoot()).startsWith('..')?'':rel(outputRoot())};
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
