process.env.VIDEO_TEST_RUN='1';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {create,save,importMedia,revise,dir,load} from '../src/engine/project.js';
import {plan,validateTimeline} from '../src/engine/scene-planner.js';
import {planProject} from '../src/engine/timeline-builder.js';
import {preview,render,exportLatest} from '../src/renderer/render-controller.js';
import {ffmpeg,run,validateVideo} from '../src/renderer/ffmpeg-encoder.js';

const {values}=parseArgs({options:{project:{type:'string'},'approve-preview':{type:'boolean'}}});
if(values.project){
 if(!values['approve-preview'])throw new Error('Inspect all preview contact sheets, then use --project ID --approve-preview.');
 const p=await load(values.project),out=await render(p,true),extra=await exportLatest(p);
 if(extra===out.file)throw new Error('Export collision');
 await validateVideo(extra,{...p.config,duration:validateTimeline(p.scenes,p.script),audio:out.audio});
 console.log(JSON.stringify({render:out,repeatExport:extra},null,2));
}else{
 if(values['approve-preview'])throw new Error('Approval requires an existing --project ID whose preview was inspected.');
 const p=await create('sorani-smoke','سڵاو! کوردی سۆرانی\nTikTok 2026',{width:360,height:640,fps:12,fontSize:40,minFontSize:22,minSceneDuration:1.5,visuals:true,useReferences:false});
 p.scenes=plan(p.script,p.config);await save(p);const textPreview=await preview(p);
 const source=path.join(dir(p.id,p.config),'input','synthetic-test-footage.mp4');
 // Explicit synthetic signals validate decoding/mixing; they are not speech or user footage.
 await run(ffmpeg,['-v','error','-n','-f','lavfi','-i','testsrc2=size=320x180:rate=12','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','4','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',source]);
 const edit=await revise(p.id);await importMedia(edit,source,'video');edit.scenes=planProject(edit);await save(edit);const footagePreview=await preview(edit);
 console.log(JSON.stringify({text:{project:p.id,preview:textPreview.sheets},syntheticFootage:{project:edit.id,preview:footagePreview.sheets},next:'Inspect both previews, then run each existing project with --project ID --approve-preview. Original previews and exports are retained.'},null,2));
}
