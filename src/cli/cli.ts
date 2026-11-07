import {updateLibrary} from '../motion-library/library.js';
import {chromiumExecutable} from '../renderer/browser-path.js';
import {planProject} from '../engine/timeline-builder.js';
import {parseArgs} from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import {create,load,save,importMedia,list,revise,dir,writeJSON} from '../engine/project.js';
import {plan} from '../engine/scene-planner.js';
import {defaults} from '../engine/config.js';
import {configSchema} from '../engine/schema.js';
import {preview,render,exportLatest,cleanup} from '../renderer/render-controller.js';
import {validateVideo,ffmpeg,ffprobe,run} from '../renderer/ffmpeg-encoder.js';
import {chromium} from 'playwright';
import {applyReferenceStyle} from '../engine/reference-styles.js';
import {referenceStyleIds} from '../engine/reference-motion-schema.js';
import {assetBoard} from '../engine/reference-production.js';
import {z} from 'zod';
const command=process.argv[2];
const {values:v}=parseArgs({args:process.argv.slice(3),options:{
 title:{type:'string'},project:{type:'string'},file:{type:'string'},text:{type:'string'},kind:{type:'string'},at:{type:'string'},
 config:{type:'string'},theme:{type:'string'},background:{type:'string'},animation:{type:'string'},format:{type:'string'},language:{type:'string'},
 fps:{type:'string'},width:{type:'string'},height:{type:'string'},style:{type:'string'},'legacy-style':{type:'boolean'},'approve-preview':{type:'boolean'},help:{type:'boolean'}
}});
function required(key:keyof typeof v){const value=v[key];if(typeof value!=='string'||!value)throw new Error('--'+key+' is required');return value;}
async function main(){
 if(v.help||!command){console.log('Commands: new, script, import, plan, preview, render, validate, export, list, show, revise, cleanup, doctor\nnew --title TITLE [--file script.txt | --text SCRIPT] [--format 9:16|1:1|16:9] [--language ckb|en|ar|fa|kmr|badini] [--style style-1..style-7] [--config settings.json] [--legacy-style for old configs]\nimport --project ID --file FILE --kind video|image|voice|music|sfx [--at SECONDS]\nplan/preview/render/show/revise/export/cleanup --project ID\nrender --project ID --approve-preview (after inspecting generated preview)\nvalidate --file video.mp4');return;}
 switch(command){
 case 'new':{
  let overrides:any=v.config?JSON.parse(await fs.readFile(required('config'),'utf8')):{};
  const formats:Record<string,number[]>={'9:16':[1080,1920],'1:1':[1080,1080],'16:9':[1920,1080]};
  if(v.format){if(!formats[v.format])throw new Error('Unknown format');[overrides.width,overrides.height]=formats[v.format];}
  for(const key of ['theme','background','animation','language'] as const)if(v[key])overrides[key]=v[key];
  for(const key of ['fps','width','height'] as const)if(v[key])overrides[key]=Number(v[key]);
  const script=v.file?await fs.readFile(required('file'),'utf8'):v.text||'';
  if(!v['legacy-style']&&(v.theme||v.background||v.animation))throw new Error('New videos use --style style-1 through style-7. Explicit old design flags require --legacy-style.');
  const p=await create(required('title'),script,overrides);
  if(!v['legacy-style']){p.referenceWorkflow={version:1};applyReferenceStyle(p,z.enum(referenceStyleIds).parse(v.style??'style-1'));if(script.trim())p.scenes=planProject(p);await save(p);}
  console.log(JSON.stringify({id:p.id,directory:dir(p.id,p.config),...(!v['legacy-style']?{status:'asset-review',next:'Use video:reference assets --project '+p.id+' to complete the asset storyboard before previewing.'}:{})},null,2));break;
 }
 case 'list':console.log(JSON.stringify((await list()).map(p=>({id:p.id,title:p.title,version:p.version,exports:p.exports})),null,2));break;
 case 'validate':console.log(JSON.stringify(await validateVideo(required('file')),null,2));break;
 case 'doctor':{
  const {runDoctor,formatChecks}=await import('../engine/doctor.js');
  const checks=await runDoctor();
  if(process.argv.includes('--json'))console.log(JSON.stringify(checks,null,2));else console.log(formatChecks(checks));
  if(checks.some(c=>c.required&&!c.ok)){process.exitCode=1;console.log('\nRequired checks failed.');}else console.log('\nDependencies ready');break;
 }
 default:{
  const p=await load(required('project'));
  if(command==='show'){console.log(JSON.stringify(p,null,2));break;}
  if(command==='script'){p.script=v.file?await fs.readFile(required('file'),'utf8'):required('text');p.scenes=[];await save(p);}
  else if(command==='import'){const kind=required('kind');if(!['video','image','voice','music','sfx'].includes(kind))throw new Error('Invalid media kind');const at=Number(v.at||0);if(!Number.isFinite(at)||at<0)throw new Error('Invalid --at');await importMedia(p,required('file'),kind as any,at);console.log('Imported media into '+p.id);}
  else if(command==='plan'){if(p.config.useReferences){const result=await updateLibrary();if(result.errors)console.error('Some references could not be analyzed; inspect references:status.');}p.scenes=planProject(p);await save(p);await writeJSON(path.join(dir(p.id,p.config),'scenes.json'),p.scenes);console.log('Saved '+p.scenes.length+' scenes. Edit project.json for explicit timing and scene overrides.');}
  else if(command==='preview')console.log(JSON.stringify(await preview(p),null,2));
  else if(command==='render')console.log(JSON.stringify(await render(p,!!v['approve-preview']),null,2));
  else if(command==='export')console.log(await exportLatest(p));
  else if(command==='revise')console.log(JSON.stringify(await revise(p.id),null,2));
  else if(command==='cleanup'){await cleanup(p);console.log('Removed failed render directories only.');}
  else throw new Error('Unknown command '+command);
 }
 }
}
main().catch(e=>{console.error(e instanceof Error?e.message:String(e));process.exitCode=1;});

