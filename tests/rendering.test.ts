import {it,expect} from 'vitest';
import {defaults} from '../src/engine/config.js';
import {create,save} from '../src/engine/project.js';
import {planProject} from '../src/engine/timeline-builder.js';
import {openRenderer} from '../src/renderer/browser-renderer.js';
import {validateVideo} from '../src/renderer/ffmpeg-encoder.js';
it('extends the plan to cover complete original footage',async()=>{
 const p={script:'سڵاو',config:await defaults(),media:[{kind:'video',at:0,metadata:{format:{duration:'18'}}}]} as any;
 const scenes=planProject(p);expect(scenes.at(-1)!.start+scenes.at(-1)!.duration).toBeGreaterThanOrEqual(18);
});
it('rejects nonvideo bytes rather than reporting success',async()=>{await expect(validateVideo('examples/sample-sorani-script.txt')).rejects.toThrow();});
it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('keeps out-of-order frames identical and exact text',async()=>{
 const p=await create('browser-integration','سڵاو ڕ ڵ ۆ ێ ە TikTok 2026!',{width:360,height:640,fps:12,fontSize:40,minFontSize:22});p.scenes=planProject(p);await save(p);const r=await openRenderer(p);
 try{await r.page.evaluate(()=>window.render(.8));const a=await r.page.screenshot();await r.page.evaluate(()=>window.render(.1));await r.page.evaluate(()=>window.render(.8));expect(await r.page.screenshot()).toEqual(a);expect(await r.page.evaluate(()=>window.PROJECT.script)).toBe(p.script);}finally{await r.close();}
});
