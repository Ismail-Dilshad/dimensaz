import {registerTestDirectory} from '../src/engine/test-artifacts.js';
import {parseArgs} from 'node:util';
import fs from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {load,writeJSON,dir} from '../src/engine/project.js';import {openRenderer} from '../src/renderer/browser-renderer.js';import {frames} from '../src/renderer/frame-renderer.js';import {ffmpeg,run,validateVideo} from '../src/renderer/ffmpeg-encoder.js';import {monitorResources} from '../src/renderer/resource-monitor.js';import {captureWorkers} from '../src/renderer/performance.js';
const {values}=parseArgs({options:{project:{type:'string'}}});if(!values.project)throw new Error('--project is required');
const p=await load(values.project);
const folder=path.resolve('workspace/benchmarks/optimized-'+randomUUID());await fs.mkdir(folder,{recursive:true});registerTestDirectory(folder,path.resolve('workspace/benchmarks'),path.resolve('workspace/history'));const results=[];
for(const mode of [{fps:30,workers:1,codec:'libx264'},{fps:30,workers:2,codec:'libx264'},{fps:60,workers:2,codec:'libx264'},{fps:60,workers:2,codec:'h264_nvenc'}] as const){
 p.config.fps=mode.fps;p.config.codec=mode.codec;const monitor=monitorResources(),start=performance.now();const r=await openRenderer(p);const views=[r];
 const name=mode.fps+'-'+mode.workers+'-'+mode.codec,file=path.join(folder,name+'.mp4');
 try{
  for(let i=1;i<captureWorkers(mode.workers);i++)views.push(await openRenderer(p,1,undefined,r.browser));
  const capture=await frames(views.map(v=>v.page),p.config,2,file);const mux=path.join(folder,name+'-audio.mp4');
  const voice=p.media.find(m=>m.kind==='voice')!;
  await run(ffmpeg,['-v','error','-n','-i',file,'-i',path.join(dir(p.id,p.config),voice.path),'-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','192k','-t','2',mux]);
  const validation=await validateVideo(mux,{...p.config,duration:2,audio:true});
  await run(ffmpeg,['-v','error','-n','-ss','1','-i',mux,'-frames:v','1',path.join(folder,name+'.png')]);
  results.push({mode,capture,validation,totalSeconds:(performance.now()-start)/1000,resources:await monitor.stop()});
 }finally{for(const v of views.slice(1))await v.close();await r.close();await monitor.stop();}
 await writeJSON(path.join(folder,'report.json'),{results,note:'2-second existing Sorani scene, original narration trimmed for benchmark only. Device GPU samples include unrelated processes. No claim of subjective smoothness from metadata.'});
}
console.log(folder,JSON.stringify(results,null,2));
