import fs from 'node:fs/promises';
import path from 'node:path';
import {revise,save,importMedia,load} from '../engine/project.js';
import {produce} from '../engine/production.js';
import {referenceStyles} from '../engine/reference-styles.js';
const folder=path.resolve('workspace/reference-production-assets');
const {job}=JSON.parse(await fs.readFile(path.join(folder,'demo-job.json'),'utf8'));
const receipt=path.join(folder,'demo-revision.json');
const existing=await fs.readFile(receipt,'utf8').then(JSON.parse).catch(e=>{if(e.code!=='ENOENT')throw e;return null;});
if(existing){console.log(JSON.stringify(await produce({resume:job,revision:existing.project}),null,2));}
else{
 const p=await revise(job);
 p.config.referenceStyle=structuredClone(referenceStyles['style-1']);
 p.config.director!.resolved.typography.size=180;
 p.config.director!.resolved.soundEffects=true;
 p.config.director!.resolved.soundSelection='manual';p.config.director!.resolved.soundPlacement='manual';
 p.config.director!.resolved.audioMixing.sfxGain=.18;p.config.normalize=false;
 for(const s of p.scenes){
  const r=s.referenceMotion!;r.headlineRevealSeconds=.65;r.highlightJoin=true;
  r.composition!.hero={x:.08,y:.33,w:.84,h:.59};r.composition!.text={x:.08,y:.10,w:.84,h:.26};
  r.layers[0].width=.47;r.layers[0].height=.31;
 }
 const sounds=JSON.parse(await fs.readFile('assets/sfx/index.json','utf8'));
 for(const [name,at] of [['kenney-maximize-001',.8],['kenney-minimize-001',6.4],['kenney-confirmation-001',8.8]] as const){
  const sound=sounds.find((s:{file:string})=>path.basename(s.file).startsWith(name));
  if(!sound)throw new Error('Import licensed sound first: '+name);
  await importMedia(p,sound.file,'sfx',at);
 }
 await save(p);await fs.writeFile(receipt,JSON.stringify({job,project:p.id,reason:'Visual pilot correction: stronger grid, faster complete headlines, larger hero and intentional event sounds'},null,2),{flag:'wx'});
 console.log(JSON.stringify(await produce({resume:job,revision:p.id}),null,2));
}
