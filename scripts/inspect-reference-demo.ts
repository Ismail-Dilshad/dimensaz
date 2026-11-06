import {load,dir} from '../engine/project.js';
import {openRenderer} from '../renderer/browser-renderer.js';
import path from 'node:path';
import fs from 'node:fs/promises';
const p=await load(process.argv[2]);const r=await openRenderer(p);
try{
 await r.page.evaluate(()=>window.render(2.5));
 console.log(await r.page.locator('[data-reference-grid]').evaluate(el=>({style:el.getAttribute('style'),image:getComputedStyle(el).backgroundImage,rect:el.getBoundingClientRect().toJSON()})));
 const folder=path.join(dir(p.id,p.config),'inspection');await fs.mkdir(folder,{recursive:true});
 for(const t of [1.75,4.983333,5,5.016667,6.9,7.8,8.8,9.7]){await r.page.evaluate(t=>window.render(t),t);await r.page.screenshot({path:path.join(folder,t+'.png')});}
 console.log(folder);
}finally{await r.close();}
