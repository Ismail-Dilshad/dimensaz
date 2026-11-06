// Reproducible acceptance fixtures for the script-led workflow. Never overwrite a job.
import fs from 'node:fs/promises';
import path from 'node:path';
import {load,writeJSON} from '../engine/project.js';
import {sceneSchema} from '../engine/schema.js';
import {produce} from '../engine/production.js';
import {chooseExplainerTheme,readThemeHistory} from '../engine/explainer-design.js';
import {defaults} from '../engine/config.js';
const base=path.resolve('workspace/requests/explainer-upgrade-20261101');
await fs.mkdir(base,{recursive:true});
const original=await load('2026-11-01_why-customers-buy-elsewhere_622_v3');
const analysis=path.resolve('workspace/projects/2026-11-01_why-customers-buy-elsewhere_622/audio-analysis/f9ff0eeb-d07b-4f2d-956b-d42ac9f403cc/alignment.json');
const cuts=[[0,5],[0],[0,5],[0,3,7],[0,6],[0,5,11],[0],[0,3]];
const icons=[
 [{name:'store',meaning:'Customers choose a competing shop',at:0},{name:'bag',meaning:'The same product being purchased',at:.5}],
 [{name:'hidden',meaning:'The seller is absent from customer awareness',at:0}],
 [{name:'people',meaning:'An audience that has not discovered the seller',at:0}],
 [{name:'diamond',meaning:'Good product quality is already present',at:0},{name:'price',meaning:'A suitable price accompanies product quality',at:2.98}],
 [{name:'pin',meaning:'The shop must become discoverable to buyers',at:0}],
 [{name:'video',meaning:'Publishing a product clip has useful content, shown by a play card',at:0},{name:'hourglass',meaning:'Passive waiting alone does not create awareness',at:3.94}],
 [{name:'megaphone',meaning:'Sponsored distribution brings the clip to people',at:0}],
 [{name:'message',meaning:'Send the team a message to begin sponsorship',at:0}]
];
const scenes=original.scenes.map((s,i)=>{
 const cues=s.wordCues!;
 const phrases=cuts[i].map((word,j,arr)=>({from:j===0?0:cues[word].from,to:j+1<arr.length?cues[arr[j+1]].from:s.text.length,at:cues[word].start,highlight:j===arr.length-1}));
 return sceneSchema.parse({id:s.id,text:s.text,start:s.start,duration:s.duration,direction:s.direction,wordCues:s.wordCues,role:s.role,animation:'phrase-rise',layout:'center',highlights:[],explainer:{template:i===0?'hook':i===7?'cta':i===3?'comparison':i===6?'steps':'problem',icons:icons[i],phrases,transition:'match-slide',transitionReason:'Use a shared central symbol anchor and clear outgoing symbols before the next entrance.'}});
});
const brief={topic:'Why customers buy from another shop',industry:'local retail and video advertising',audience:'Sorani-speaking small shop owners',emotion:'curiosity moving toward confidence',tone:'friendly, clear, calm',domain:'commerce'};
const remake={schemaVersion:1,title:'Why customers buy elsewhere — script-led remake',script:original.script,preset:'script-explainer',explainer:{brief},voiceover:path.resolve('workspace/requests/sponsor-short-20261101/audio/myvoiceover.mp3'),authorizedAutomaticAlignment:analysis,scenes,captureConcurrency:2,exportCategory:'explainer-upgrade',sfx:'off',fps:60};
const gardenLines=['لە تۆوێکی بچووکەوە، ژیانێکی نوێ دەست پێ دەکات.\n\n','ڕووناکی و شوێنێکی گونجاو بۆ ڕووەکەکەت هەڵبژێرە.\n\n','پێویستییەکانی بناسە، بە وردی ئاودێری بکە.\n\n','بە ئارامی چاودێری گەشەی بکە.\n\n','ئەمڕۆ یەک ڕووەک بچێنە؛ سەوزایی لە تۆوە دەست پێ دەکات.'];
const gardenIcons=[['seed'],['sun'],['water'],['sprout'],['flower']] as const;
const gardenScenes=gardenLines.map((text,i)=>{
 const comma=text.indexOf('،'),split=i===0?comma+1:i===2?comma+1:i===4?text.indexOf('؛')+1:0;
 const duration=i===4?5:4;
 const start=[0,4,8,12,16][i];
 const phrases=split>0?[{from:0,to:split,at:0,highlight:false},{from:split,to:text.length,at:1.4,highlight:true}]:[{from:0,to:text.length,at:0,highlight:true}];
 return sceneSchema.parse({id:'G'+(i+1),text,start,duration,direction:'rtl',role:i===0?'hook':i===4?'cta':'explanation',animation:'phrase-rise',layout:'center',highlights:[],explainer:{template:i===0?'hook':i===4?'cta':'steps',icons:[{name:gardenIcons[i][0],meaning:['A small seed is the beginning of a larger living story','Light represents choosing a suitable growing place','A watering can explains attentive plant care','A sprout makes gradual growth visible','A flower represents the result and invitation to plant'][i],at:0}],phrases,transition:'match-slide',transitionReason:'Advance from seed to care to growth at the same focal anchor, without claiming a literal morph.'}});
});
const garden={schemaVersion:1,title:'A little seed — Sorani explainer demo',script:gardenLines.join(''),preset:'script-explainer',explainer:{brief:{topic:'A small seed begins a greener space',industry:'home gardening',audience:'Sorani-speaking beginners and plant lovers',emotion:'patience, care and hope',tone:'warm, gentle, encouraging',domain:'nature'}},scenes:gardenScenes,captureConcurrency:2,exportCategory:'explainer-upgrade',sfx:'off',fps:60};
for(const [name,request] of [['remake',remake],['garden',garden]] as const){
 const receipt=path.join(base,name+'-job.json');
 if(await fs.access(receipt).then(()=>true,()=>false)){console.log(name+': existing receipt '+receipt);continue;}
 const manifest=path.join(base,name+'-request.json');await writeJSON(manifest,request);
 await writeJSON(path.join(base,name+'-brief.json'),request.explainer);
 await writeJSON(path.join(base,name+'-theme.json'),chooseExplainerTheme(request.explainer as Parameters<typeof chooseExplainerTheme>[0],await readThemeHistory(await defaults())));
 const result=await produce({manifest});await writeJSON(receipt,result);console.log(JSON.stringify({name,...result},null,2));
}
await writeJSON(path.join(base,'production-notes.json'),{authorization:'User explicitly approved automatic word timing in this chat; inherited for the remake of the same recording.',originalVoice:'workspace/requests/sponsor-short-20261101/audio/myvoiceover.mp3',originalUnchanged:true,secondScript:'Newly authored by the assistant for the requested different-script test; silent display timing, not simulated speech alignment.',assetSearch:'Local search/assess/check/style/similar inspected the earlier 3D assets; native vector geometry chosen to demonstrate a different rendering family without recoloring pinned images.',sound:'assets/sfx/index.json searched; licensed Kenney candidates exist. Listening unavailable in this session. Both demos intentionally omit optional effects; remake retains original narration.'});
