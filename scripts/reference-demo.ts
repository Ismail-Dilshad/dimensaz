import fs from 'node:fs/promises';
import path from 'node:path';
import {produce} from '../src/engine/production.js';
import {directorPresets} from '../src/engine/director-presets.js';
import {sceneSchema} from '../src/engine/schema.js';
const folder=path.resolve('workspace/reference-production-assets');
const receipt=path.join(folder,'demo-job.json');
const existing=await fs.readFile(receipt,'utf8').then(JSON.parse).catch(e=>{if(e.code!=='ENOENT')throw e;return null;});
if(existing){console.log(JSON.stringify(await produce({resume:existing.job}),null,2));}
else{
 const library=JSON.parse(await fs.readFile(path.join(folder,'registered-assets.json'),'utf8'));
 const id=(name:string)=>library[name].id as string;
 const resolved=structuredClone(directorPresets['reference-style-1']);
 resolved.typography.size=150;resolved.typography.lineHeight=1.18;
 resolved.export={width:1080,height:1920,fps:60,crf:18};
 resolved.soundEffects=false;
 const texts=['نامەکەت\nئامادە بکە.\n','هەر ئێستا\nبینێرە.'];
 const composition={hero:{x:.10,y:.34,w:.80,h:.54},text:{x:.08,y:.12,w:.84,h:.23},textDepth:'front'};
 const bubble={asset:id('pale-bubble'),role:'part',x:.54,y:.61,width:.43,height:.30,loop:'none',action:'A message forms above the blank phone screen'};
 const scenes=texts.map((text,i)=>sceneSchema.parse({id:'scene-'+(i+1),text,start:i*5,duration:5,direction:'rtl',role:i?'cta':'explanation',animation:'word-slide-up',layout:'center',highlights:[{start:text.indexOf('\n')+1,end:text.trimEnd().length}],asset:id('matte-phone'),
 referenceMotion:{metaphor:i?'The prepared message becomes a paper plane and leaves the same phone':'A pale message bubble grows out of a white phone as the message is prepared',layout:'headline-top',entrance:'rise',transition:i?'fade':'cut',camera:'static',rotation:-30,heroLoop:'none',continuity:i?'carry-hero':'new',composition,
 evidence:['references/styles/blue-editorial/style.md','Motion is authored from written directions, not observed footage.'],
 layers:i?[
 {...bubble,keyframes:[{at:0,scale:1},{at:.2,scale:1},{at:.38,scale:.15,opacity:0},{at:1,scale:.15,opacity:0}]},
 {asset:id('paper-plane'),role:'part',x:.57,y:.58,width:.35,height:.23,loop:'none',action:'The paper plane emerges from the message and travels toward the upper-right',keyframes:[{at:0,scale:.15,opacity:0},{at:.22,scale:.15,opacity:0},{at:.38,scale:1,opacity:1},{at:.56,x:.13,y:-.1,scale:1},{at:.76,x:.53,y:-.35,scale:.65,opacity:0},{at:1,x:.53,y:-.35,scale:.65,opacity:0}]}]:[
 {...bubble,keyframes:[{at:0,scale:.1,opacity:0},{at:.15,scale:.1,opacity:0},{at:.35,scale:1,opacity:1},{at:1,scale:1,opacity:1}]}]}}));
 const manifest=path.join(folder,'demo-request.json');
 await fs.writeFile(manifest,JSON.stringify({schemaVersion:1,title:'Reference mechanism demonstration',script:texts.join(''),preset:'reference-style-1',language:'ckb',fps:60,resolution:{width:1080,height:1920},previewScale:.5,exportCategory:'reference-demo',director:{version:1,selection:{},resolved,confirmed:true,sceneOverrides:{}},scenes},null,2),{flag:'wx'});
 try{const result=await produce({manifest});await fs.writeFile(receipt,JSON.stringify({job:result.job},null,2),{flag:'wx'});console.log(JSON.stringify(result,null,2));}
 catch(error){const job=String(error).match(/Job (\S+) failed:/)?.[1];if(job)await fs.writeFile(receipt,JSON.stringify({job},null,2),{flag:'wx'});throw error;}
}
