import {assertExplainer} from '../engine/explainer-design.js';
import {explainerPreflight,encodedExplainerQA,exportExplainerExtras} from './explainer-qa.js';
import {selectedAssetIds,assertReferenceScenes} from '../engine/reference-styles.js';
import {assertReferenceReview} from '../engine/reference-production.js';
import {assertDirector} from '../engine/director-integration.js';
import {registerTestDirectory} from '../engine/test-artifacts.js';
import {monitorResources} from './resource-monitor.js';
import {captureWorkers} from './performance.js';
import {lockAssets,projectAssets} from '../engine/asset-locks.js';
import {libraryRecords,reusable} from '../engine/asset-library.js';
import {assertVoiceAlignment} from '../engine/voice-alignment.js';
import {contactSheet} from './contact-sheet.js';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {ROOT,roots} from '../engine/config.js';
import {assets} from '../engine/asset-selector.js';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {dir,inside,writeJSON,exportFile} from '../engine/project.js';
import {validateTimeline} from '../engine/scene-planner.js';
import {projectSchema,type Project} from '../engine/schema.js';
import {openRenderer} from './browser-renderer.js';
import {frames} from './frame-renderer.js';
import {mixAudio} from './audio-mixer.js';
import {validateVideo,run,ffmpeg} from './ffmpeg-encoder.js';
export async function fingerprint(p:Project){
 assertExplainer(p);
 assertReferenceScenes(p);
 const available=await projectAssets(p);
 for(const scene of p.scenes)if(scene.asset&&!available.some(a=>a.id===scene.asset))throw new Error('Unknown, restricted or incompatible scene asset: '+scene.asset);
 const hash=createHash('sha256').update(JSON.stringify(projectSchema.parse({...p,exports:[]})));
 for(const asset of libraryRecords().filter(a=>selectedAssetIds(p).includes(a.id)&&!p.assetLocks?.some(l=>l.id===a.id))){
  if(!reusable(asset))throw new Error('Asset is restricted or incompatible: '+asset.id);
  const bytes=await fs.readFile(path.resolve(ROOT,asset.path));if(createHash('sha256').update(bytes).digest('hex')!==asset.hash)throw new Error('Asset integrity changed: '+asset.id);
  hash.update(JSON.stringify(asset));
 }
 const paths=new Set([p.config.font,...p.config.fallbacks].map(f=>path.resolve(ROOT,f)));
 if(p.acousticAlignment)paths.add(inside(dir(p.id,p.config),p.acousticAlignment.analysisPath));
 for(const media of p.media)paths.add(inside(dir(p.id,p.config),media.path));
 for(const asset of available)if(selectedAssetIds(p).includes(asset.id))paths.add(path.resolve(ROOT,asset.path));
 // A renderer/code change also invalidates visual approval, including legacy previews.
 async function includeCode(folder:string):Promise<void>{for(const entry of await fs.readdir(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);if(entry.isDirectory())await includeCode(file);else if(/\.(ts|html)$/.test(entry.name))paths.add(file);}}
 for(const folder of ['engine','renderer','components','animations','presets'])await includeCode(path.join(ROOT,'src',folder));
 for(const file of [...paths].sort()){
  hash.update(file);const digest=createHash('sha256');
  for await(const chunk of createReadStream(file))digest.update(chunk);
  hash.update(digest.digest());
 }
 return hash.digest('hex');
}
export async function preview(p:Project,scale=1,options:{pilot?:boolean}={}){
 if(p.styleDNA)await lockAssets(p);validateTimeline(p.scenes,p.script);const initial=await fingerprint(p);const output=path.join(dir(p.id,p.config),'preview',randomUUID());await fs.mkdir(output,{recursive:true});
 const r=await openRenderer(p,scale);
 try{const files:string[]=[];const times:number[]=[];
 // Mid-scene plus entrance and exit boundaries make transition failures reviewable.
 for(const s of (options.pilot?p.scenes.slice(0,1):p.scenes)){
  const last=Math.max(0,s.duration-1/p.config.fps);
  const offsets=[0,Math.min(.15,s.duration/4),s.duration/2,last];
  for(const layer of s.referenceMotion?.layers??[])if(layer.beat){
   const {start,duration}=layer.beat;
   offsets.push(start,start+duration*.25,start+duration*.5,start+duration*.75,start+duration);
  }
  // Authored actions can fall entirely between ordinary preview samples.
  for(const layer of [s.referenceMotion?.heroMotion,...(s.referenceMotion?.layers??[])]){
   const keys=layer?.keyframes??[];
   for(const [i,key] of keys.entries()){
    offsets.push(key.at*s.duration-1/p.config.fps,key.at*s.duration,key.at*s.duration+1/p.config.fps);
    if(i&&p.config.referenceStyle?.card){
     const a=keys[i-1],span=(key.at-a.at)*s.duration;
     for(const f of [.25,.5,.75])offsets.push(a.at*s.duration+f*span);
    }
   }
  }
  if(s.wordCues)for(const cue of s.wordCues)offsets.push(cue.start,Math.min(last,cue.start+1/p.config.fps));
  else if(['word-slide-up','center-word-swap'].includes(s.animation))offsets.push(s.duration*.25,s.duration*.75);
  for(const offset of [...new Set(offsets.map(t=>Math.max(0,Math.min(t,last))))].sort((a,b)=>a-b))times.push(s.start+offset);
 }
 const layerFailures:string[]=[];
 for(let i=0;i<times.length;i++){
  await r.page.evaluate(t=>window.render(t),times[i]);
  if(p.config.referenceStyle?.card){
   const issues=await r.page.evaluate(()=>{
    const words=[...document.querySelectorAll<HTMLElement>('[data-word]')].filter(e=>e.offsetWidth>0).map(x=>x.getBoundingClientRect());
    return [...document.querySelectorAll<HTMLElement>('[data-reference-layer]')].filter(e=>e.offsetWidth>0&&Number(getComputedStyle(e).opacity)>.05).flatMap(el=>{
     const b=el.getBoundingClientRect(),asset=el.dataset.asset,issues:string[]=[];
     if(b.left<-.5||b.top<-.5||b.right>innerWidth+.5||b.bottom>innerHeight+.5)issues.push('layer leaves frame: '+asset);
     if(words.some(w=>w.left<b.right&&w.right>b.left&&w.top<b.bottom&&w.bottom>b.top))issues.push('layer occupies a headline word: '+asset);
     return issues;
    });
   });
   layerFailures.push(...issues.map(note=>times[i].toFixed(3)+'s '+note));
  }
  const file=path.join(output,String(i).padStart(3,'0')+'.png');await r.page.screenshot({path:file});files.push(file);
 }
 const qa=await r.page.evaluate(()=>window.qa);
 const sheets:string[]=[];
 // Bounded contact sheets: a long voiceover must not produce one enormous bitmap.
 for(let start=0;start<files.length;start+=18){
  const sheet=path.join(output,start===0?'contact-sheet.png':'contact-sheet-'+String(start/18+1).padStart(3,'0')+'.png');
  await contactSheet(r.page.context(),files.slice(start,start+18),times.slice(start,start+18),sheet);sheets.push(sheet);
 }
 const sheet=sheets[0];
 const explainerQA=p.config.explainer?await explainerPreflight(p,r.page,path.join(output,'storyboard')):undefined;
 if(initial!==await fingerprint(p))throw new Error('Inputs changed during preview; regenerate and inspect.');
 const layerQA=p.config.referenceStyle?.card?{samples:times.length,failures:layerFailures}:undefined;
 const result={fingerprint:initial,scale,sheet,sheets,files,times,qa,glyphs:r.glyphs,pilot:!!options.pilot,explainerQA,layerQA};await writeJSON(path.join(dir(p.id,p.config),options.pilot?'pilot.json':'preview.json'),result);return result;
 }finally{await r.close();}
}
export async function approvePreview(p:Project){const file=path.join(dir(p.id,p.config),'preview.json');const data=JSON.parse(await fs.readFile(file,'utf8'));if(data.fingerprint!==await fingerprint(p))throw new Error('Preview is stale. Generate and inspect a fresh preview.');data.approved=true;data.approvedAt=new Date().toISOString();await writeJSON(file,data);}
export async function render(p:Project,approved=false){
 assertDirector(p);await assertVoiceAlignment(p);
 await assertReferenceReview(p,await fingerprint(p));
 const duration=validateTimeline(p.scenes,p.script),projectDir=dir(p.id,p.config);
 let previewData:any;try{previewData=JSON.parse(await fs.readFile(path.join(projectDir,'preview.json'),'utf8'));}catch{}
 if(!previewData||previewData.fingerprint!==await fingerprint(p)){const fresh=await preview(p);throw new Error('Preview was missing or stale. Inspect '+fresh.sheet+' before rendering again.');}
 if(p.config.referenceStyle?.card&&(!previewData.layerQA||previewData.layerQA.failures.length))throw new Error('Inspect and fix the layered preview: '+JSON.stringify(previewData.layerQA?.failures));
 if(approved){await approvePreview(p);previewData.approved=true;}
 if(p.config.explainer&&!previewData.explainerQA?.passed)throw new Error('Explainer geometry/contrast/source QA failed; inspect storyboard/preflight.json and revise before rendering.');
 if(!previewData.approved)throw new Error('Inspect '+previewData.sheet+' and rerun with --approve-preview. This attests visual QA of the current scene plan.');
 if(p.config.renderPurpose==='test'){for(const folder of ['renders','render-cache'])registerTestDirectory(path.join(projectDir,folder),projectDir,path.join(roots(p.config).workspace,'history'));}
 const temp=path.join(projectDir,'renders',randomUUID());await fs.mkdir(temp,{recursive:true});await writeJSON(path.join(temp,'status.json'),{state:'rendering',fingerprint:await fingerprint(p)});
 let r:Awaited<ReturnType<typeof openRenderer>>|undefined;const extra:Awaited<ReturnType<typeof openRenderer>>[]=[];const renderStarted=performance.now();const monitor=monitorResources();
 try{r=await openRenderer(p);let silent=path.join(temp,'silent.mp4');const finished=path.join(temp,'validated.mp4');
 for(let worker=1;worker<captureWorkers(p.config.captureConcurrency);worker++)extra.push(await openRenderer(p,1,undefined,r.browser));
 const cache=path.join(projectDir,'render-cache',await fingerprint(p)+'.mp4');
 let capture:unknown;let cached=false;
 if(p.config.reuseRenderCache){try{await fs.access(cache);await validateVideo(cache,{...p.config,duration,audio:false});await fs.copyFile(cache,silent,fs.constants.COPYFILE_EXCL);cached=true;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')console.error('Render cache unavailable: '+String(e));}}
 if(cached)capture={cacheHit:true};
 else{try{capture=await frames([r.page,...extra.map(view=>view.page)],p.config,duration,silent);}catch(error){if(p.config.codec!=='h264_nvenc')throw error;silent=path.join(temp,'silent-cpu-fallback.mp4');capture={...await frames([r.page,...extra.map(view=>view.page)],{...p.config,codec:'libx264'},duration,silent),fallback:String(error)};}if(p.config.reuseRenderCache){await validateVideo(silent,{...p.config,duration,audio:false});await fs.mkdir(path.dirname(cache),{recursive:true});await fs.copyFile(silent,cache,fs.constants.COPYFILE_EXCL).catch(e=>{if(e.code!=='EEXIST')throw e;});}}
 const mixStarted=performance.now();
 const audio=await mixAudio(p,silent,finished,duration);
 const mixSeconds=(performance.now()-mixStarted)/1000;
 const validation=await validateVideo(finished,{...p.config,duration,audio});
 const representative=p.scenes[Math.floor(p.scenes.length/2)];
 const inspectionTime=representative.start+representative.duration/2;
 await run(ffmpeg,['-v','error','-n','-ss',String(inspectionTime),'-i',finished,'-frames:v','1',path.join(temp,'encoded-frame.png')]);
 await writeJSON(path.join(temp,'validation.json'),validation);
 if(previewData.fingerprint!==await fingerprint(p))throw new Error('Inputs changed during render; output was not exported.');
 await writeJSON(path.join(projectDir,'latest-render.json'),{file:finished,fingerprint:await fingerprint(p),validation});
 const encodedQA=p.config.explainer?await encodedExplainerQA(p,finished,r.page,path.join(temp,'encoded-qa')):undefined;
 const exported=await exportFile(p,finished);
 const extras=p.config.explainer?await exportExplainerExtras(p,exported):undefined;
 await writeJSON(path.join(temp,'performance.json'),{capture,mixSeconds,totalSeconds:(performance.now()-renderStarted)/1000});
 await writeJSON(exported+'.assets.json',p.assetLocks??libraryRecords().filter(a=>selectedAssetIds(p).includes(a.id)&&!p.assetLocks?.some(l=>l.id===a.id)).map(a=>({id:a.id,hash:a.hash,provenance:a.provenance})));await writeJSON(path.join(temp,'status.json'),{state:'complete',exported,validation});return {...validation,file:exported,encodedFrame:path.join(temp,'encoded-frame.png'),encodedQA,extras};
 }catch(e){await writeJSON(path.join(temp,'status.json'),{state:'failed',error:String(e)});throw e;}finally{await Promise.allSettled(extra.map(view=>view.close()));await r?.close();await writeJSON(path.join(temp,'resources.json'),await monitor.stop());}
}
export async function exportLatest(p:Project){const latest=JSON.parse(await fs.readFile(path.join(dir(p.id,p.config),'latest-render.json'),'utf8'));if(latest.fingerprint!==await fingerprint(p))throw new Error('Render is stale');await assertReferenceReview(p,latest.fingerprint);await assertVoiceAlignment(p);await validateVideo(latest.file,{...p.config,duration:validateTimeline(p.scenes,p.script),audio:latest.validation.audio});const exported=await exportFile(p,latest.file);await writeJSON(exported+'.assets.json',p.assetLocks??libraryRecords().filter(a=>selectedAssetIds(p).includes(a.id)&&!p.assetLocks?.some(l=>l.id===a.id)).map(a=>({id:a.id,hash:a.hash,provenance:a.provenance})));return exported;}
export async function cleanup(p:Project){
 // Explicit scope only: completed renders and all source media/exports survive.
 const base=path.join(dir(p.id,p.config),'renders');for(const name of await fs.readdir(base).catch(()=>[])){
 const target=inside(base,name);let state:string;try{state=JSON.parse(await fs.readFile(path.join(target,'status.json'),'utf8')).state;}catch{continue;}
 if(state==='failed')await fs.rm(target,{recursive:true});}
}






