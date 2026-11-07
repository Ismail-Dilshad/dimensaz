import {it,expect} from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {lottieInfo,renderLottie} from '../src/renderer/lottie.js';
import {mediaInfo} from '../src/editor/editor.js';
import {ROOT} from '../src/engine/config.js';

const example=path.join(ROOT,'examples/lottie/slide-box.json');

it('reads Lottie metadata',async()=>{
 expect(await lottieInfo(example)).toMatchObject({width:200,height:200,fps:30,frames:30,durationSeconds:1,layers:1,usesExpressions:false,externalImages:[]});
});

it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('renders exact frames with transparency and never overwrites',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rw-lottie-'));
 const file=path.join(dir,'slide-box.json');await fs.copyFile(example,file);
 const frames=await renderLottie(file,{format:'png',scale:1});
 expect(frames.frames).toBe(30);
 const first=await fs.readFile(path.join(frames.output,'frame-00000.png'));
 expect(first.subarray(25,26)[0]).toBe(6); // PNG colour type 6: RGBA
 const mov=await renderLottie(file,{format:'mov',width:100,loops:2});
 expect(mov.output.endsWith('slide-box.mov')).toBe(true);
 expect(await mediaInfo(mov.output)).toMatchObject({width:100,height:100,fps:30});
 expect((await mediaInfo(mov.output)).duration).toBeCloseTo(2,1);
 const again=await renderLottie(file,{format:'mov',width:100});
 expect(again.output.endsWith('slide-box-2.mov')).toBe(true);
 await expect(renderLottie(file,{format:'mov',out:mov.output})).rejects.toThrow(/never overwriting/);
},120000);
