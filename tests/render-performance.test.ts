import os from 'node:os';
import {it,expect} from 'vitest';import fs from 'node:fs/promises';import path from 'node:path';
import {defaults} from '../src/engine/config.js';import {create,save} from '../src/engine/project.js';import {planProject} from '../src/engine/timeline-builder.js';import {openRenderer} from '../src/renderer/browser-renderer.js';import {frames} from '../src/renderer/frame-renderer.js';import {validateVideo} from '../src/renderer/ffmpeg-encoder.js';import {frameCount,renderProfiles,captureWorkers} from '../src/renderer/performance.js';import {configSchema} from '../src/engine/schema.js';
it('accepts explicit legacy FPS and native 24/30/60/120 without rounding timeline time',async()=>{const c=await defaults();expect(c.fps).toBe(60);for(const fps of [12,24,30,60,120])expect(configSchema.parse({...c,fps}).fps).toBe(fps);expect(frameCount(.1+.2,60)).toBe(18);expect(renderProfiles.final.fps).toBe(60);expect(captureWorkers(4)).toBeGreaterThanOrEqual(1);expect(captureWorkers(4)).toBeLessThanOrEqual(4);});
it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('streams exact indexed frames from shared-browser pages at 120 FPS',async()=>{
 const p=await create('120fps parallel verification','TikTok 2026!',{width:160,height:284,fps:120,fontSize:24,minFontSize:14,captureConcurrency:2,preset:'ultrafast'});p.scenes=planProject(p);await save(p);
 const r=await openRenderer(p),second=await openRenderer(p,1,undefined,r.browser),folder=await fs.mkdtemp(path.join(os.tmpdir(),'fps-check-'));
 try{const file=path.join(folder,'parallel.mp4');const stats=await frames([r.page,second.page],p.config,.2,file);expect(stats.generatedFrames).toBe(24);expect(stats.failedFrames).toBe(0);const v=await validateVideo(file,{...p.config,duration:.2,audio:false});expect(v.decodedFrames).toBe(24);
 await r.page.evaluate(()=>window.render(.1));await second.page.evaluate(()=>window.render(.1));expect(await r.page.screenshot()).toEqual(await second.page.screenshot());
 }finally{await second.close();await r.close();}
});
