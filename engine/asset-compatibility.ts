import path from 'node:path';
import {defaults,ROOT} from './config.js';
import {openRenderer} from '../renderer/browser-renderer.js';
import {planProject} from './timeline-builder.js';
import type {LibraryRecord} from './asset-library.js';
import type {Project} from './schema.js';
export async function checkCompatibility(a:LibraryRecord){
 if(!a.renderable)return {supported:false,passed:false,reason:'No deterministic renderer for '+a.format};
 const config=await defaults({width:360,height:640,visuals:true});const p:Project={schemaVersion:1,id:'asset-compatibility',title:'Compatibility',slug:'compatibility',sequence:1,createdAt:new Date(0).toISOString(),version:1,script:'Asset preview',config,scenes:[],media:[],exports:[]};p.scenes=planProject(p);p.scenes.forEach(s=>s.asset=a.id);
 let renderer:Awaited<ReturnType<typeof openRenderer>>|undefined;
 try{renderer=await openRenderer(p,1,[{...a,path:path.resolve(ROOT,a.path)}]);await renderer.page.evaluate(()=>window.render(.5));await renderer.page.screenshot();return {supported:true,passed:true,reason:'Existing compositor rendered and captured asset at 360x640'};}catch(e){return {supported:true,passed:false,reason:String(e)};}finally{await renderer?.close();}
}
