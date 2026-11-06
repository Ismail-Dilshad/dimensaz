import {execFile} from 'node:child_process';import {promisify} from 'node:util';
process.env.VIDEO_TEST_RUN='1';
import fs from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {create,save,importMedia,writeJSON} from '../engine/project.js';import {planProject} from '../engine/timeline-builder.js';import {applyDirector,assertDirector,planDirectorSound} from '../engine/director-integration.js';import {directorPresets} from '../engine/director-presets.js';import {directorSchema} from '../engine/style-director-schema.js';import {openRenderer} from '../renderer/browser-renderer.js';import {frames} from '../renderer/frame-renderer.js';import {mixAudio} from '../renderer/audio-mixer.js';import {ffmpeg,run,validateVideo} from '../renderer/ffmpeg-encoder.js';import {registerTestDirectory,cleanupTestArtifacts} from '../engine/test-artifacts.js';
const folder=path.resolve('workspace/benchmarks/director-'+randomUUID());await fs.mkdir(folder,{recursive:true});registerTestDirectory(folder,path.resolve('workspace/benchmarks'),path.resolve('workspace/history'));
const voice=path.join(folder,'voice.wav');await run(ffmpeg,['-v','error','-n','-i',path.resolve('workspace/inbox/audio/kak-ismael-tiktok-sponsorship-voiceover.mp3'),'-t','2','-ar','48000',voice]);
const music=path.join(folder,'test-tone.wav');await run(ffmpeg,['-v','error','-n','-f','lavfi','-i','sine=frequency=220:duration=2','-af','volume=0.1',music]);
const results=[];
try{for(const name of ['premium-saas-white-grid','minimal-editorial','dark-cinematic']){
 const p=await create('Style director test '+name,'کڕیارەکەت، پێش ئەوەی کاڵاکەت بکڕێت،',{width:360,height:640,fontSize:36,minFontSize:20,renderPurpose:'test',preset:'ultrafast'});p.scenes=planProject(p);p.scenes=p.scenes.slice(0,1);p.script=p.scenes[0].text;p.scenes[0].start=0;p.scenes[0].duration=2;
 await importMedia(p,voice,'voice');await importMedia(p,music,'music');
 const resolved=structuredClone(directorPresets[name]);resolved.export={width:360,height:640,fps:name==='minimal-editorial'?30:60,crf:18};resolved.typography.size=36;resolved.backgroundMusic='provided';resolved.soundEffects=true;
 const d=directorSchema.parse({version:1,selection:{},resolved,confirmed:true});applyDirector(p,d);await planDirectorSound(p,[{file:music,sha256:'synthetic-test-tone',duration:.2,category:'pops',license:'CC0-1.0',rmsDb:-30}]);await save(p);assertDirector(p);
 const renderer=await openRenderer(p),silent=path.join(folder,name+'-silent.mp4'),output=path.join(folder,name+'.mp4');const start=performance.now();
 try{const stats=await frames([renderer.page],p.config,2,silent);await mixAudio(p,silent,output,2);const validation=await validateVideo(output,{...p.config,duration:2,audio:true});await renderer.page.evaluate(()=>window.render(.8));await renderer.page.screenshot({path:path.join(folder,name+'.png')});const qa=await renderer.page.evaluate(()=>({qa:window.qa,text:[...document.querySelectorAll('[data-word]')].map(n=>({text:n.textContent,visible:getComputedStyle(n).opacity,rect:n.getBoundingClientRect().toJSON()}))}));
 const loudness=(await promisify(execFile)(ffmpeg,['-hide_banner','-i',output,'-af','ebur128=peak=true','-f','null','-'],{windowsHide:true,maxBuffer:1024*1024})).stderr;results.push({name,elapsedMs:performance.now()-start,stats,validation,qa,loudness,soundEvents:p.soundTimeline?.length,style:resolved});await writeJSON(path.join(folder,'results.json'),results);
 }finally{await renderer.close();}
}
}finally{const deleted=await cleanupTestArtifacts();console.log(JSON.stringify({folder,results:results.map(r=>({name:r.name,elapsedMs:r.elapsedMs,frames:r.stats.generatedFrames,soundEvents:r.soundEvents})),deleted:deleted.length},null,2));}
