process.env.VIDEO_TEST_RUN='1';
import {create,load,save} from '../engine/project.js';import {planProject} from '../engine/timeline-builder.js';import {preview,render} from '../renderer/render-controller.js';
if(process.argv[2]==='prepare'){
 const source=await load('2026-10-26_kak-ismael-tiktok-sponsorship_230_v2');const p=await create('Render cache smoke',source.scenes[0].text,{width:360,height:640,fps:60,fontSize:40,minFontSize:20,captureConcurrency:2,preset:'ultrafast'});p.scenes=planProject(p);p.scenes[0].duration=1;await save(p);console.log(JSON.stringify({project:p.id,preview:await preview(p)},null,2));
}else{const p=await load(process.argv[2]);const first=await render(p,true);const second=await render(p,true);console.log(JSON.stringify({first,second},null,2));}
