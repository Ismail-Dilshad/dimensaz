import {registerTestDirectory} from '../engine/test-artifacts.js';
// Initial audit runner. Future runs measure the CURRENT serial renderer, not historical source.
import fs from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {load,writeJSON} from '../engine/project.js';import {openRenderer} from '../renderer/browser-renderer.js';import {frames} from '../renderer/frame-renderer.js';import {ffmpeg,run,validateVideo} from '../renderer/ffmpeg-encoder.js';
const p=await load('2026-10-26_kak-ismael-tiktok-sponsorship_230_v2');
const folder=path.resolve('workspace/benchmarks/baseline-'+randomUUID());await fs.mkdir(folder,{recursive:true});registerTestDirectory(folder,path.resolve('workspace/benchmarks'),path.resolve('workspace/history'));const results=[];
for(const fps of [30,60]){p.config.fps=fps;const t=performance.now();const r=await openRenderer(p);const file=path.join(folder,fps+'.mp4');try{const begin=performance.now();await frames(r.page,p.config,2,file);results.push({fps,renderSeconds:(performance.now()-begin)/1000,totalSeconds:(performance.now()-t)/1000,validation:await validateVideo(file,{...p.config,duration:2,audio:false})});}finally{await r.close();}}
const encoders=await run(ffmpeg,['-hide_banner','-encoders']);const encoding=[];
for(const codec of ['libx264','h264_nvenc']){const file=path.join(folder,codec+'.mp4');const start=performance.now();try{await run(ffmpeg,['-v','error','-n','-i',path.join(folder,'60.mp4'),'-an','-c:v',codec,...(codec==='libx264'?['-preset','medium','-crf','18']:['-preset','p5','-rc','vbr','-cq','18','-b:v','0']),'-pix_fmt','yuv420p',file]);encoding.push({codec,seconds:(performance.now()-start)/1000,bytes:(await fs.stat(file)).size});}catch(e){encoding.push({codec,error:String(e)});}}
await writeJSON(path.join(folder,'report.json'),{results,encoding,nvencListed:encoders.includes('h264_nvenc')});console.log(folder,JSON.stringify({results,encoding}));
