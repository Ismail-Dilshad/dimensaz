import fs from 'node:fs/promises';
import type {Scene} from '../engine/schema.js';
import {revise,save,dir,writeJSON} from '../engine/project.js';
import {lockAssets} from '../engine/asset-locks.js';
import {validateTimeline} from '../engine/scene-planner.js';
const base='2026-10-26_kak-ismael-tiktok-sponsorship_230';
const a=JSON.parse(await fs.readFile('workspace/projects/'+base+'/audio-analysis/ead76e56-7731-47c1-9fb7-751a8429d4b3/alignment.json','utf8'));
const p=await revise(base);
if(p.script!==a.script)throw new Error('Script mismatch');
const ends=[5,9,10,14,21,27,29,33,39,44,45,51,57,63,69,74,77,82];
const assets=['shopping','security','security','shopping','social','technology','technology','shopping','business','shopping','marketing','social','marketing','analytics','technology','business','social','communication'];
let first=0;
p.scenes=ends.map((end,i)=>{
 const from=first===0?0:a.words[first].from;
 const to=end<a.words.length?a.words[end].from:p.script.length;
 const start=i===0?0:Math.max(0,a.words[first].start-.12);
 const stop=end<a.words.length?a.words[end].start-.12:Math.ceil(a.duration*30)/30+.5;
 const group=a.words.slice(first,end);const key=group.reduce((best:any,w:any)=>w.text.length>best.text.length?w:best,group[0]);
 const scene:Scene={id:'phrase-'+(i+1),text:p.script.slice(from,to),start,duration:stop-start,direction:'rtl',role:'product',animation:i===2?'spring-entrance':'phrase-rise',layout:'center',highlights:[{start:key.from-from,end:key.to-from}],emphasisScale:1.12,asset:assets[i],objectMotion:i%3===0?'pendulum':'float',motion:{duration:.3,easing:'cubic',intensity:.55}};
 first=end;return scene;
});
p.config.voiceTiming='estimated';p.config.visuals=true;p.config.fontSize=112;p.config.exit=.12;p.config.entrance=.3;p.config.transitionDuration=.18;
p.config.safeBottom=.18;p.config.backgroundDesign={gridSize:120,gridOpacity:.045,gridColor:'#1F5EFF',glow:true,drift:2};
p.production={preset:'premium-viral',sfx:'off'};
delete p.alignmentEvidence;delete p.speechAnchors;
validateTimeline(p.scenes,p.script);await lockAssets(p);await save(p);
await writeJSON(dir(p.id,p.config)+'/timing-notes.json',{method:'automatic CTC phrase boundaries',sourceAnalysis:a.audioSha256,reviewed:false,note:'Phrase holds and whole-scene motion; not certified exact word synchronization. Original audio speed and script unchanged.'});
console.log(p.id);

