import path from 'node:path';
import {roots} from '../engine/config.js';
import {registerTestFile} from '../engine/test-artifacts.js';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import type {Page} from 'playwright';
import type {Config} from '../engine/schema.js';
import {ffmpeg} from './ffmpeg-encoder.js';
import {encoderConfig,frameCount} from './performance.js';
/** Renders frames into a video. `range` renders only frames [from, to) of the whole video (one
 *  scene), timed as in the whole video, so scenes rendered apart join into the same video. */
export async function frames(page:Page|Page[],c:Config,duration:number,file:string,range?:{from:number;to:number}){
 const pages=Array.isArray(page)?page:[page],encoder=await encoderConfig(c);
 if(c.renderPurpose==='test'){const exists=await fs.stat(file).then(()=>true,(e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return false;throw e;});if(!exists)registerTestFile(file,path.join(roots(c).workspace,'history'));}
 const begin=performance.now(),total=frameCount(duration,c.fps),from=range?Math.max(0,range.from):0,until=range?Math.min(total,range.to):total,count=until-from;
 if(count<=0)throw new Error('Nothing to render in that range');
 const stats={totalFrames:count,generatedFrames:0,failedFrames:0,captureSeconds:0,pipeWaitSeconds:0,encoderFinalizeSeconds:0,totalSeconds:0,generatedFps:0,peakNodeRssBytes:process.memoryUsage().rss,encoder:encoder.codec,fallback:encoder.fallback,workers:pages.length,consecutiveIdenticalCaptures:0,bytes:0,estimatedOutputBytes:null as number|null};
 const child=spawn(ffmpeg,['-v','error','-n','-f','image2pipe','-vcodec','png','-framerate',String(c.fps),'-i','pipe:0','-an',...encoder.args,'-pix_fmt',c.pixelFormat,'-movflags','+faststart',file],{windowsHide:true,stdio:['pipe','ignore','pipe']});
 let err='',previousHash='',lastProgress=0;
 child.stderr.on('data',b=>err=(err+b).slice(-10000));
 const started=new Promise<void>((resolve,reject)=>{child.once('spawn',()=>resolve());child.once('error',reject);});
 const done=new Promise<void>((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error('Encoder failed: '+err)));});
 done.catch(()=>{});let pipeError:Error|undefined;child.stdin.on('error',e=>{pipeError=e;});
 const abort=()=>{child.stdin.destroy();child.kill('SIGKILL');};process.once('SIGINT',abort);process.once('SIGTERM',abort);
 try{
 await started;
 // One in-flight frame per page; batches are flushed strictly in source-index order.
 for(let first=0;first<count;first+=pages.length){
  const captureStart=performance.now();
  const batch=await Promise.allSettled(pages.slice(0,Math.min(pages.length,count-first)).map(async(p,slot)=>{
   await p.evaluate(t=>window.render(t),(from+first+slot)/c.fps);
   return p.screenshot({type:'png',animations:'disabled',timeout:30000});
  }));
  stats.captureSeconds+=(performance.now()-captureStart)/1000;
  for(const result of batch){
   if(result.status==='rejected'){stats.failedFrames++;throw result.reason;}
   if(pipeError)throw pipeError;if(child.exitCode!==null)throw new Error('Encoder exited: '+err);
   const png=result.value,hash=createHash('sha256').update(png).digest('hex');
   if(hash===previousHash)stats.consecutiveIdenticalCaptures++;previousHash=hash;
   const pipeStart=performance.now();
   if(!child.stdin.write(png)){
    const drain=new Promise<void>((resolve,reject)=>{const clean=()=>{child.stdin.off('drain',ok);child.stdin.off('error',fail);child.stdin.off('close',closed);};const ok=()=>{clean();resolve();};const fail=(e:Error)=>{clean();reject(e);};const closed=()=>{clean();reject(new Error('Encoder input closed: '+err));};child.stdin.once('drain',ok);child.stdin.once('error',fail);child.stdin.once('close',closed);});
    await Promise.race([drain,done.then(()=>{throw new Error('Encoder ended early');})]);
   }
   stats.pipeWaitSeconds+=(performance.now()-pipeStart)/1000;stats.generatedFrames++;
  }
  stats.peakNodeRssBytes=Math.max(stats.peakNodeRssBytes,process.memoryUsage().rss);
  const elapsed=(performance.now()-begin)/1000;
  if(elapsed-lastProgress>=5||stats.generatedFrames===count){
   lastProgress=elapsed;const written=await fs.stat(file).then(s=>s.size,()=>0);stats.estimatedOutputBytes=written>4096?Math.round(written*count/stats.generatedFrames):null;
   console.error(`Rendering ${range?`frames ${from+1} to ${until}: `:''}${stats.generatedFrames}/${count} (${(stats.generatedFrames/elapsed).toFixed(1)} fps), ETA ${Math.ceil((count-stats.generatedFrames)*elapsed/stats.generatedFrames)}s`);
  }
 }
 const finish=performance.now();child.stdin.end();await done;stats.encoderFinalizeSeconds=(performance.now()-finish)/1000;
 if(stats.generatedFrames!==count)throw new Error('Frame delivery mismatch');
 stats.bytes=(await fs.stat(file)).size;stats.estimatedOutputBytes=stats.bytes;return stats;
 }catch(e){
  // FFmpeg waits for the rest of its input when asked to stop: close its input and stop it outright.
  child.stdin.destroy();child.kill('SIGKILL');await done.catch(()=>{});throw e;}finally{
  stats.totalSeconds=(performance.now()-begin)/1000;stats.generatedFps=stats.generatedFrames/stats.totalSeconds;
  await fs.writeFile(file+'.performance.json',JSON.stringify({...stats,note:'Capture and encoding overlap. Identical frames can be intentional holds. Node RSS excludes browser/encoder; use benchmark process-tree samples for aggregate memory.'},null,2));
  process.off('SIGINT',abort);process.off('SIGTERM',abort);
 }
}
