import {saveRecipes} from './recipes.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {categories,indexSchema,reviewSchema,recordSchema,type ReferenceIndex,type ReferenceRecord} from './model.js';
import {ROOT} from '../engine/config.js';
import {writeJSON} from '../engine/project.js';
import {INDEX,LIBRARY,MANAGED,toRelative,realSource} from './paths.js';
import {analyze,contentHash,inferFromName,ANALYZER_VERSION,execute} from './analyzer.js';
import {loadIndex} from './search.js';
import {ffmpeg} from '../renderer/ffmpeg-encoder.js';
const extensions=new Set(['.mp4','.mov','.mkv','.webm','.avi','.m4v','.mpeg','.mpg','.wmv','.gif']);
export async function initializeLibrary(){
 await fs.mkdir(MANAGED,{recursive:true});
 for(const category of categories)await fs.mkdir(path.join(LIBRARY,category),{recursive:true});
}
async function lock<T>(action:()=>Promise<T>):Promise<T>{
 await initializeLibrary();const file=path.join(MANAGED,'update.lock');
 let handle;try{handle=await fs.open(file,'wx');}catch(e){if((e as NodeJS.ErrnoException).code==='EEXIST')throw new Error('Library update is locked. Wait for the current update; remove _library/update.lock only after a stopped process is confirmed.');throw e;}
 try{await handle.writeFile(JSON.stringify({pid:process.pid,createdAt:new Date().toISOString()}));return await action();}finally{await handle.close();await fs.unlink(file);}
}
async function walk(base:string,recursive:boolean):Promise<string[]>{
 const result:string[]=[];
 for(const entry of await fs.readdir(base,{withFileTypes:true})){
  if(entry.name==='_library'||entry.name.startsWith('.'))continue;
  const file=path.join(base,entry.name);
  if(entry.isDirectory()&&recursive)result.push(...await walk(file,true));
  else if(entry.isFile()&&extensions.has(path.extname(entry.name).toLowerCase()))result.push(file);
 }
 return result;
}
export async function updateLibrary(options:{full?:boolean}={}){
 return lock(async()=>{
  const previous=loadIndex(),old=new Map(previous.records.map(r=>[r.source,r]));
  const files=[...await walk(LIBRARY,true),...await walk(path.join(ROOT,'references'),false)].sort();
  const records:ReferenceRecord[]=[],seen=new Set<string>(),summary={found:files.length,processed:0,skipped:0,errors:0,missing:0,reviewNeeded:[] as string[]};
  for(const file of files){
   const source=toRelative(file),prior=old.get(source);seen.add(source);const stat=await fs.stat(file);
   if(!options.full&&prior?.status==='analyzed'&&prior.analyzerVersion===ANALYZER_VERSION&&prior.size===stat.size&&prior.mtimeMs===stat.mtimeMs){records.push({...prior,available:true});summary.skipped++;continue;}
   const id=prior?.id||createHash('sha256').update(source).digest('hex').slice(0,16);
   console.error('Analyzing reference '+(summary.processed+summary.errors+1)+'/'+files.length+': '+path.basename(file));
   let hash='';
   try{
    const real=await realSource(source);hash=await contentHash(real);
    if(!options.full&&prior?.status==='analyzed'&&prior.contentHash===hash&&prior.analyzerVersion===ANALYZER_VERSION){records.push({...prior,size:stat.size,mtimeMs:stat.mtimeMs,available:true});summary.skipped++;continue;}
    const data=await analyze(real,id,hash),after=await fs.stat(file);
    if(after.size!==stat.size||after.mtimeMs!==stat.mtimeMs)throw new Error('Source changed during analysis. Run update again.');
    let review;try{review=reviewSchema.parse(JSON.parse(await fs.readFile(path.join(MANAGED,'annotations',id,hash+'.json'),'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
    records.push(recordSchema.parse({id,source,name:path.basename(file),size:stat.size,mtimeMs:stat.mtimeMs,contentHash:hash,available:true,status:'analyzed',analyzerVersion:ANALYZER_VERSION,analyzedAt:new Date().toISOString(),automatic:inferFromName(path.basename(file)),...data,review,clips:prior?.contentHash===hash?prior.clips:[]}));summary.processed++;
   }catch(e){
    records.push(recordSchema.parse({id,source,name:path.basename(file),size:stat.size,mtimeMs:stat.mtimeMs,contentHash:hash,available:true,status:'error',error:String(e),analyzerVersion:ANALYZER_VERSION,analyzedAt:new Date().toISOString(),automatic:inferFromName(path.basename(file)),previews:[],clips:[]}));summary.errors++;
   }
  }
  for(const record of previous.records)if(!seen.has(record.source)){records.push({...record,available:false});summary.missing++;}
  const index:ReferenceIndex={version:1,updatedAt:new Date().toISOString(),categories:[...categories],records};
  summary.reviewNeeded=records.filter(r=>r.available&&r.status==='analyzed'&&!r.review).map(r=>r.id);
  await persist(index);return {...summary,index:toRelative(INDEX)};
 });
}
const escape=(s:string)=>s.replace(/[|\[\]]/g,'\\$&').replace(/\r?\n/g,' ');
const link=(relative:string)=>path.relative(MANAGED,path.resolve(ROOT,relative)).split(path.sep).map(encodeURIComponent).join('/');
export async function persist(index:ReferenceIndex){
 indexSchema.parse(index);await initializeLibrary();
 await writeJSON(path.join(MANAGED,'history',new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID()+'.json'),index);
 await writeJSON(INDEX,index);
 const lines=['# Motion Reference Library','','Updated: '+index.updatedAt,'','Original videos are read-only. Categories contain metadata memberships, not duplicate videos.','','## Categories',''];
 const researchNeeded:string[]=[];
 for(const category of categories){
  const members=index.records.filter(r=>r.available&&(r.review?.categories||r.automatic.categories).includes(category));
  await writeJSON(path.join(LIBRARY,category,'_category.json'),{category,index:'../_library/index.json',references:members.map(r=>({id:r.id,source:r.source,reviewed:!!r.review}))});
  lines.push('- **'+category+'**: '+members.length+' references');
  if(!members.some(r=>r.review&&r.review.confidence>=.65))researchNeeded.push(category);
 }
 await writeJSON(path.join(MANAGED,'research-needed.json'),{categories:researchNeeded,instruction:'Use current reliable primary sources or inspect new local examples. Research is performed by Codex when requested, not by an unattended network process.'});
 lines.push('','## Search','','Run pnpm references:search --query "mask typography", or filter with --category "Tutorials".','','## References','');
 for(const r of index.records){
  const meta=r.review||r.automatic;
  lines.push('### '+r.id+' - '+escape(r.name),'','- Source: ['+escape(r.name)+']('+link(r.source)+')','- Available: '+r.available+'; status: '+r.status+'; type: '+meta.kind+'; confidence: '+meta.confidence+'; '+(r.review?'visually reviewed':'unreviewed filename hints'),'- Categories: '+meta.categories.join(', '),'- Description: '+meta.description);
  if(r.error)lines.push('- Error: '+r.error);
  if(r.media)lines.push('- Duration: '+r.media.duration.toFixed(2)+'s; '+r.media.width+'x'+r.media.height+'; '+r.media.fps.toFixed(2)+' FPS');
  if(r.contactSheet)lines.push('- [Contact sheet]('+link(r.contactSheet)+'); frame times: '+r.previews.map((f,i)=>i+'='+f.time.toFixed(2)+'s').join(', '));
  if(r.review){
   lines.push('- Typography: '+r.review.typography,'- Composition: '+r.review.composition,'- Easing: '+r.review.easing,'- Effects: '+r.review.effects);
   for(const t of r.review.techniques)lines.push('','**'+t.name+'** ('+t.start.toFixed(2)+'-'+t.end.toFixed(2)+'s; confidence '+t.confidence+'; '+(t.approximate?'approximate sampled interval':'precise interval')+')',t.evidence,...t.implementation.map(step=>'- '+step));
   if(r.review.tutorial)lines.push('','Tutorial interface: '+r.review.tutorial.interface,'Animation region: '+r.review.tutorial.animationRegions,...r.review.tutorial.steps.map(s=>'- '+s),'Limitations: '+r.review.tutorial.limitations);
  }
  lines.push('','Uncertainties: '+meta.uncertainties.join(' '),'');
 }
 await fs.writeFile(path.join(MANAGED,'index.md'),lines.join('\n'),'utf8');
}
export async function annotate(id:string,file:string){
 return lock(async()=>{
  const index=loadIndex(),entry=index.records.find(r=>r.id===id);if(!entry||!entry.available)throw new Error('Reference not found or unavailable');
  const review=reviewSchema.parse(JSON.parse(await fs.readFile(path.resolve(file),'utf8')));
  if(review.contentHash!==entry.contentHash)throw new Error('Review hash differs from current indexed video');
  if(await contentHash(await realSource(entry.source))!==entry.contentHash)throw new Error('Source changed; update before reviewing');
  for(const t of review.techniques)if(t.end>(entry.media?.duration||0)+.05)throw new Error('Technique timestamp exceeds duration');
  entry.review={...review,reviewedAt:new Date().toISOString()};await writeJSON(path.join(MANAGED,'annotations',id,entry.contentHash+'.json'),entry.review);
  index.updatedAt=new Date().toISOString();await persist(index);await saveRecipes(entry);return entry;
 });
}
export async function extractClip(id:string,start:number,duration:number){
 return lock(async()=>{
  const index=loadIndex(),entry=index.records.find(r=>r.id===id&&r.available&&r.status==='analyzed');if(!entry?.media)throw new Error('Analyzed reference not found');
  if(!Number.isFinite(start)||!Number.isFinite(duration)||start<0||duration<=0||duration>8||start+duration>entry.media.duration+.01)throw new Error('Clip must be within source duration and no longer than 8 seconds');
  const source=await realSource(entry.source);if(await contentHash(source)!==entry.contentHash)throw new Error('Source changed; update before clipping');
  const output=path.join(MANAGED,'derived',entry.id,entry.contentHash.slice(0,12),'clip-'+randomUUID()+'.mp4');await fs.mkdir(path.dirname(output),{recursive:true});
  await execute(ffmpeg,['-v','error','-n','-ss',String(start),'-i',source,'-t',String(duration),'-an','-vf','scale=480:-2','-c:v','libx264','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',output]);
  entry.clips.push({start,duration,path:toRelative(output)});await persist(index);return toRelative(output);
 });
}

