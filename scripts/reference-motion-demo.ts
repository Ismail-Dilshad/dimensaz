import fs from 'node:fs/promises';
import {planReference} from '../src/engine/reference-storyboard.js';
import {produce} from '../src/engine/production.js';
import {referenceSceneSchema} from '../src/engine/reference-motion-schema.js';
// Silent, original-vector demonstration; no voice-alignment or photoreal-likeness claim.
// First run creates preview evidence. Inspect it before resuming its job via video:create.
const script='\u0645\u062a\u0645\u0627\u0646\u06d5 \u06af\u0631\u0646\u06af\u06d5.\n\u0647\u06d5\u0631 \u0626\u06ce\u0633\u062a\u0627 \u0646\u0627\u0645\u06d5 \u0628\u0646\u06ce\u0631\u06d5.';
const plan=planReference(script,'style-1');
for(const [i,s] of plan.request.scenes.entries()){
 s.start=i*3;s.duration=3;s.asset='reference-blue-phone';
 s.referenceMotion=referenceSceneSchema.parse({...s.referenceMotion,headline:undefined,
  metaphor:i?'A message rises from a trusted device and becomes a departing paper plane':'A verified phone with a separately arriving conversation bubble',
  layout:'headline-top',rotation:-7,entrance:i?'left':'rise',transition:'fade',camera:'push',
  layers:[{asset:'reference-blue-bubble',role:'part',x:.72,y:.53,width:.34,height:.22,delay:.12,entrance:'pop',rotation:8,loop:'float'},
   ...(i?[{asset:'reference-blue-plane',role:'part',x:.22,y:.65,width:.25,height:.19,delay:.28,entrance:'left',rotation:-9,travelX:.13,travelY:-.17,loop:'none'}]:[])]});
}
const request={...plan.request,title:'Reference motion - silent vector demonstration',purpose:'production',exportCategory:'reference-demo',renderPreset:'draft',resolution:{width:540,height:960},fps:24,captureConcurrency:1,previewScale:1};
await fs.mkdir('workspace/reference-review',{recursive:true});
const manifest='workspace/reference-review/demo-request-'+Date.now()+'.json';
await fs.writeFile(manifest,JSON.stringify(request,null,2),{flag:'wx'});
console.log(JSON.stringify(await produce({manifest,legacyStyle:true}),null,2));
