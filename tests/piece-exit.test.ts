import {it,expect} from 'vitest';
import {defaults} from '../src/engine/config.js';
import {projectSchema,sceneSchema} from '../src/engine/schema.js';
import {openRenderer} from '../src/renderer/browser-renderer.js';
it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('none holds a piece opaque at the final frame while wipe retains its exit',async()=>{
 const config=await defaults({width:360,height:640,language:'en',textTreatment:'classic',fadeIn:0,fadeOut:0});
 for(const transition of ['none','wipe'] as const){
 const scene=sceneSchema.parse({id:'s1',text:'Review changes.',start:0,duration:3,direction:'ltr',role:'explanation',animation:'fade',layout:'center',highlights:[],piece:{kind:'compose',transition,layers:[{type:'card',x:.1,y:.1,w:.8,h:.8}]}});
 const p=projectSchema.parse({schemaVersion:1,id:'transition-test',title:'Transition test',slug:'transition-test',sequence:1,createdAt:new Date().toISOString(),version:1,script:scene.text,config,scenes:[scene],media:[],exports:[]});
 const r=await openRenderer(p);
 try{await r.page.evaluate(()=>window.render(2.99));
 const opacity=await r.page.evaluate(()=>Number((Array.from(document.querySelector('#stage')!.children) as HTMLElement[]).find(e=>e.style.zIndex==='3')!.style.opacity));
 if(transition==='none')expect(opacity).toBe(1);else expect(opacity).toBeCloseTo(.15+.85*(.01/.3),4);
 }finally{await r.close();}
 }
},30000);
