import {it,expect} from 'vitest';import {create} from '../src/engine/project.js';import {planProject} from '../src/engine/timeline-builder.js';import {applyDirector} from '../src/engine/director-integration.js';import {factoryStyle,directorSchema} from '../src/engine/style-director-schema.js';import {openRenderer} from '../src/renderer/browser-renderer.js';
const browserTest=it.skipIf(process.env.RUN_BROWSER_TESTS!=='1');
browserTest('renders five shaping-safe reveals and deterministic entrances from supplied cue offsets',async()=>{
 for(const reveal of ['sentence','progressive','active','replacement','phrase'] as const){
 const p=await create('Director reveal test','سڵاو بەخێربێیت کڕیار',{width:360,height:640,fontSize:36,minFontSize:20});p.scenes=planProject(p);const scene=p.scenes[0];scene.duration=2;scene.wordCues=[...scene.text.matchAll(/\S+/gu)].map((m,i)=>({from:m.index,to:m.index+m[0].length,start:i*.4,end:i*.4+.3}));
 const d=structuredClone(factoryStyle);d.illustrations='none';d.textReveal=reveal;d.export={width:360,height:640,fps:60,crf:18};d.typography.size=36;d.textEntrance='spring';
 applyDirector(p,directorSchema.parse({version:1,selection:{},resolved:d,confirmed:true}));const r=await openRenderer(p);
 try{await r.page.evaluate(()=>window.render(.2));const words=await r.page.locator('[data-word]').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,opacity:Number(getComputedStyle(n).opacity)})));expect(words.map(w=>w.text).join(' ')).toBe(p.script);if(['progressive','replacement'].includes(reveal)){expect(words[0].opacity).toBeGreaterThan(0);expect(words[1].opacity).toBe(0);}if(reveal==='sentence'||reveal==='active')expect(words.every(w=>w.opacity>0)).toBe(true);
 for(const entrance of ['fade','slide-up','slide-down','slide-left','slide-right','bounce','spring','scale','blur','mask']){await r.page.evaluate(mode=>{window.PROJECT.scenes[0].director!.textEntrance=mode as any;},entrance);await r.page.evaluate(()=>window.render(.5));const a=await r.page.screenshot();await r.page.evaluate(()=>window.render(.1));await r.page.evaluate(()=>window.render(.5));expect(await r.page.screenshot()).toEqual(a);}
 }finally{await r.close();}
 }
},60000);
