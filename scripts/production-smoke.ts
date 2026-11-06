process.env.VIDEO_TEST_RUN='1';
import {parseArgs} from 'node:util';
import {create,save,load} from '../src/engine/project.js';
import {plan} from '../src/engine/scene-planner.js';
import {preview,render} from '../src/renderer/render-controller.js';

const {values}=parseArgs({options:{project:{type:'string'},'approve-preview':{type:'boolean'}}});
if(values.project){
 if(!values['approve-preview'])throw new Error('Inspect every sheet, then pass --approve-preview for this project.');
 console.log(JSON.stringify(await render(await load(values.project),true),null,2));
}else{
 if(values['approve-preview'])throw new Error('Generate and inspect a preview first; supply its --project ID.');
 const script=[
  'سڵاو! کوردی سۆرانی — ڕۆژ، گەشە، دڵ. ٢٠٢٦',
  'Hello, world! English — price: $25.50 (2026).',
  'مَرْحَبًا بِالْعَالَمِ! اللغة العربية — ٢٠٢٦.',
  'سلام دنیا! فارسی را می‌نویسیم؛ پژواک گچ — ۱۴۰۵.',
  'سلاڤ! کوردی بادینی — دهوک، ڤ، ێ.',
  'Silav! Kurdî: Ç ç Ê ê Î î Ş ş Û û — 2026.'
 ].join('\n');
 const p=await create('multilingual-production-smoke',script,{width:1080,height:1920,fps:30,fontSize:104,minFontSize:38,useReferences:false});
 p.scenes=plan(p.script,p.config);
 p.scenes.forEach((s,i)=>{s.start=i*2;s.duration=2;s.animation=i%2?'word-slide-up':'phrase-rise';});
 await save(p);const result=await preview(p);
 console.log(JSON.stringify({project:p.id,...result},null,2));
}
