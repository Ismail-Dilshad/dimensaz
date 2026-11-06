import {directorPresets,legacyDirectorPresets} from './director-presets.js';
import {referenceStyleIds} from './reference-motion-schema.js';
import fs from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';import {z} from 'zod';
import {ROOT} from './config.js';import {writeJSON} from './project.js';
import {directorSchema,directorValuesSchema,factoryStyle,directorLimitations,type Director,type DirectorValues} from './style-director-schema.js';
type Key=keyof DirectorValues;
export type DirectorSession={referenceOnly?:boolean;version:1;id:string;mode:'quick'|'standard'|'advanced'|'auto';scope:'all'|'typography'|'sound'|'background';script:string;voice:boolean;style:Director;history:Key[];focus?:Key;defaultSnapshot:DirectorValues};
const quick:Key[]=['creativeDirection','palette','textReveal','textEntrance','soundEffects','backgroundMusic','export'];
const standard:Key[]=['creativeDirection','background','grid','palette','illustrations','composition','typography','textReveal','textEntrance','textExit','textHighlight','animation','camera','transitions','soundEffects','soundSelection','soundPlacement','backgroundMusic','export'];
const keys=['referenceStyle',...Object.keys(factoryStyle)] as Key[];
const referenceQuestions:Key[]=['referenceStyle','typography','soundEffects','backgroundMusic','export'];
const choiceValues:Partial<Record<Key,Record<string,unknown>>>={
 palette:{'blue and white':factoryStyle.palette,'purple and cyan':{primary:'#7c3aed',highlight:'#7c3aed',background:'#f0fcff',text:'#172033'},monochrome:{primary:'#222222',highlight:'#222222',background:'#ffffff',text:'#111111'},'warm editorial':{primary:'#9c4422',highlight:'#9c4422',background:'#fff8ed',text:'#30251e'}},
 grid:{sparse:{...factoryStyle.grid,spacing:180},medium:factoryStyle.grid,dense:{...factoryStyle.grid,spacing:50}},
 animation:{calm:{energy:.2,duration:.65,easing:'cubic'},smooth:{energy:.4,duration:.45,easing:'cubic'},energetic:{energy:.8,duration:.3,easing:'back'}},
 typography:{'language default':factoryStyle.typography},
 export:{draft:{width:540,height:960,fps:30,crf:26},preview:{width:720,height:1280,fps:30,crf:22},final:factoryStyle.export},
 soundEffects:{yes:true,no:false},audioMixing:{'voice first':factoryStyle.audioMixing}
};
const prompts:Partial<Record<Key,string>>={creativeDirection:'What overall visual style should this video use?',background:'What background style do you prefer?',grid:'How should the grid look and move?',palette:'Which colors should the video use?',textReveal:'How should spoken text appear on screen?',textEntrance:'How should text enter?',textExit:'How should text disappear?',soundEffects:'Do you want sound effects?',soundSelection:'Should sounds be selected automatically, suggested for approval, or selected manually?',soundPlacement:'Should sounds be placed automatically, suggested for approval, or placed manually?',export:'Which resolution, FPS and quality should the video use?'};
export function directorRoot(){return path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','style-director');}
function safeName(name:string){if(!/^[a-z0-9][a-z0-9_-]{0,100}$/i.test(name))throw new Error('Use a short filename-safe name');return name;}
const file=(id:string)=>path.join(directorRoot(),'sessions',safeName(id)+'.json');
export async function readDirector(id:string):Promise<DirectorSession>{const s=JSON.parse(await fs.readFile(file(id),'utf8'));s.style=directorSchema.parse(s.style);return s;}
export async function saveDirector(s:DirectorSession){await writeJSON(file(s.id),s);}
export async function defaultStyle(legacy=false){const f=path.join(directorRoot(),'default.json');let saved:DirectorValues;try{saved=directorValuesSchema.parse(JSON.parse(await fs.readFile(f,'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;saved=structuredClone(factoryStyle);}return legacy?saved:saved.referenceStyle?saved:structuredClone(directorPresets['reference-style-1']);}
export function autoStyle(script:string,voice:boolean,base:DirectorValues):DirectorValues{
 if(base.referenceStyle)return directorValuesSchema.parse({...base,...directorPresets['reference-'+base.referenceStyle],soundEffects:base.soundEffects,export:base.export});
 const d=structuredClone(base);const promo=/تیکتۆک|کڕین|سپۆنسەر|buy|sale|tiktok/i.test(script);
 d.creativeDirection=promo?'saas':'editorial';d.background=promo?'white-grid':'solid';d.animation.energy=promo?.55:.25;d.illustrations=promo?'existing-assets':'none';d.textReveal='sentence';d.soundEffects=promo;d.soundIntensity='subtle';d.backgroundMusic='off';d.export.fps=60;
 // Without reviewed timing, Auto deliberately chooses sentence presentation.
 return directorValuesSchema.parse(d);
}
function relevant(s:DirectorSession,k:Key){const d=s.style.resolved;
 if(s.referenceOnly&&!referenceQuestions.includes(k))return false;
 if(s.referenceOnly&&s.mode==='quick'&&k==='typography')return false;
 if(s.scope==='typography'&&!['typography','textReveal','textEntrance','textExit','textHighlight'].includes(k))return false;
 if(s.scope==='background'&&!['background','grid','palette'].includes(k))return false;
 if(s.scope==='sound'&&!k.startsWith('sound')&&!['backgroundMusic','audioMixing'].includes(k))return false;
 if(k==='grid'&&!d.background.endsWith('grid'))return false;
 if(k==='objectEntrance'&&d.illustrations==='none')return false;
 if(k.startsWith('sound')&&k!=='soundEffects'&&!d.soundEffects)return false;
 if(k==='textHighlight'&&!['active','progressive'].includes(d.textReveal))return false;
 return true;
}
export function nextKey(s:DirectorSession):Key|undefined{return s.focus??(s.referenceOnly?referenceQuestions:s.mode==='quick'?quick:s.mode==='standard'?standard:keys.filter(k=>k!=='referenceStyle')).find(k=>relevant(s,k)&&!s.style.selection[k]);}
export function directorView(s:DirectorSession){const key=nextKey(s),schema=key?directorValuesSchema.shape[key]:undefined;return {session:s.id,ready:!key,question:key?{key,prompt:key==='referenceStyle'?'Choose one of the seven supplied reference styles.':prompts[key]??'Choose '+key,options:key==='referenceStyle'?[...referenceStyleIds]:choiceValues[key!]?Object.keys(choiceValues[key!]!):(schema as any)?.options??['Custom JSON matching the example'],example:s.style.resolved[key],commands:['Auto','Default','Custom <value or JSON>','Skip','Back','Explain','Show examples','More options']}:null,summary:s.style,limitations:directorLimitations,confirmed:s.style.confirmed};}
export async function beginDirector(input:{script:string;voice?:boolean;mode?:DirectorSession['mode'];scope?:DirectorSession['scope'];values?:Partial<DirectorValues>;resolution?:'auto'|'default';previous?:Director;legacy?:boolean}){
 const legacy=input.legacy??(!!input.previous&&!input.previous.resolved.referenceStyle),def=await defaultStyle(legacy);
 if(!input.previous&&(input.values?.creativeDirection??def.creativeDirection)==='clay')throw new Error('Clay treatments are available for saved projects only.');
 const chosen=input.values?.referenceStyle??def.referenceStyle;
 if(!legacy&&input.values?.creativeDirection&&input.values.creativeDirection!=='editorial')throw new Error('New videos use the seven reference styles. Use legacy compatibility for an older director configuration.');
 const resolved=directorValuesSchema.parse({...def,...(legacy&&input.values?.creativeDirection?Object.values(legacyDirectorPresets).find(p=>p.creativeDirection===input.values?.creativeDirection):{}),...input.values,...(!legacy?directorPresets['reference-'+chosen]:{}),...(input.values?.typography?{typography:input.values.typography}:{}),...(input.values?.export?{export:input.values.export}:{}),...(input.values?.soundEffects!==undefined?{soundEffects:input.values.soundEffects}:{})});
 const s:DirectorSession={referenceOnly:!legacy,version:1,id:randomUUID(),mode:input.mode??'standard',scope:input.scope??'all',script:input.script,voice:!!input.voice,style:input.previous?directorSchema.parse({...input.previous,confirmed:false}):{version:1,selection:{},resolved,confirmed:false,sceneOverrides:{}},history:[],defaultSnapshot:def};
 for(const [k,value] of Object.entries(input.values??{}))s.style.selection[k]={mode:'explicit',value};
 if(input.resolution||s.mode==='auto')resolveRest(s,input.resolution??'auto');await saveDirector(s);return directorView(s);
}
export async function installDirectorPresets(){const folder=path.join(directorRoot(),'presets');await fs.mkdir(folder,{recursive:true});for(const [name,resolved] of Object.entries(directorPresets)){const selection=Object.fromEntries(Object.entries(resolved).map(([k,value])=>[k,{mode:'explicit',value}]));try{await fs.writeFile(path.join(folder,name+'.json'),JSON.stringify({version:1,resolved,selection,confirmed:false,sceneOverrides:{}},null,2),{flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}}try{await fs.writeFile(path.join(directorRoot(),'default.json'),JSON.stringify(directorPresets['reference-style-1'],null,2),{flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}return folder;}
function resolveRest(s:DirectorSession,mode:'auto'|'default'){
 const base=mode==='auto'?(s.style.selection.creativeDirection?Object.values(directorPresets).find(p=>p.creativeDirection===s.style.resolved.creativeDirection)??autoStyle(s.script,s.voice,s.defaultSnapshot):autoStyle(s.script,s.voice,s.defaultSnapshot)):s.defaultSnapshot;
 for(const k of keys)if(!s.style.selection[k]&&relevant(s,k)){(s.style.resolved as any)[k]=base[k];s.style.selection[k]={mode};}
}
export async function answerDirector(id:string,text:string){const s=await readDirector(id),command=text.trim(),lower=command.toLowerCase();
 if(lower.startsWith('save this style ')){return {...directorView(s),saved:await preset('save',command.slice(16).trim(),s.id)};}
 if(lower==='show my selections')return directorView(s);
 if(lower==='explain'||lower==='more options'||lower==='show examples')return {...directorView(s),explanation:'Use an option exactly as shown, or Custom followed by a JSON value. Durations are seconds, colors are HEX. Examples show parameters, not rendered previews. Auto uses script rules; Default uses your saved default snapshot.'};
 s.style.confirmed=false;
 if(lower==='back'||lower==='go back'){s.focus=s.history.pop();}
 else if(lower.startsWith('change ')){const k=command.slice(7) as Key;if(!keys.includes(k))throw new Error('Unknown category');if(s.referenceOnly&&!referenceQuestions.includes(k))throw new Error('Reference palette, background and creative direction are locked. Change referenceStyle to choose another of the seven looks.');s.focus=k;}
 else if(lower==='quick setup'){s.mode='quick';}
 else if(lower==='ask me everything'){s.mode='advanced';}
 else if(lower.startsWith('customize ')){const scope=lower.includes('typography')?'typography':lower.includes('sound')?'sound':lower.includes('background')?'background':null;if(!scope)throw new Error('Unknown scope');s.scope=scope;s.mode='advanced';}
 else if(lower==='start over'){s.style.selection={};s.style.resolved=structuredClone(s.defaultSnapshot);s.history=[];delete s.focus;}
 else if(['use auto for the rest','use auto for everything','finish configuration'].includes(lower)){resolveRest(s,'auto');delete s.focus;}
 else if(['use default for the rest','use default','use defaults','use default for everything'].includes(lower)){resolveRest(s,'default');delete s.focus;}
 else if(lower==='confirm and generate'||lower==='confirm'){if(nextKey(s))throw new Error('Finish remaining choices before confirming');s.style.confirmed=true;}
 else {
  const k=nextKey(s);if(!k)throw new Error('Configuration is complete; confirm or change a category');let value:unknown,mode:'explicit'|'auto'|'default'|'skip'='explicit';
  if(['auto','default','skip','next'].includes(lower)){mode=(lower==='next'?'skip':lower) as 'auto'|'default'|'skip';value=mode==='auto'?autoStyle(s.script,s.voice,s.defaultSnapshot)[k]:mode==='default'?s.defaultSnapshot[k]:s.style.resolved[k];}
  else if(choiceValues[k]?.[lower]!==undefined)value=structuredClone(choiceValues[k]![lower]);
  else{const raw=command.replace(/^custom\s+/i,'');try{value=JSON.parse(raw);}catch{value=raw;}}
  if(k==='creativeDirection'&&value==='clay'&&s.style.resolved.creativeDirection!=='clay')throw new Error('Clay treatments are available for saved projects only.');
  (s.style.resolved as any)[k]=directorValuesSchema.shape[k].parse(value);s.style.selection[k]={mode,...(mode==='explicit'?{value}:{})};s.history.push(k);delete s.focus;
  if(k==='referenceStyle'){const template=directorPresets['reference-'+value];if(template)for(const child of keys)if(child!==k&&!s.style.selection[child])(s.style.resolved as any)[child]=template[child];}
  if(k==='creativeDirection'){const template=Object.values(legacyDirectorPresets).find(x=>x.creativeDirection===value);if(template)for(const child of keys)if(child!==k&&!s.style.selection[child])(s.style.resolved as any)[child]=template[child];}
 }
 directorSchema.parse(s.style);await saveDirector(s);return directorView(s);
}
export async function preset(action:'save'|'load'|'duplicate'|'rename'|'default'|'delete'|'list',name:string,session?:string,target?:string,confirm=false){
 const root=path.join(directorRoot(),'presets');await fs.mkdir(root,{recursive:true});if(action==='list'){const names=await fs.readdir(root);const active:string[]=[];for(const name of names){if(!name.endsWith('.json'))continue;try{const d=directorSchema.parse(JSON.parse(await fs.readFile(path.join(root,name),'utf8')));if(d.resolved.referenceStyle)active.push(name);}catch{}}return [...new Set([...Object.keys(directorPresets).map(n=>n+'.json'),...active])];}
 const f=path.join(root,safeName(name)+'.json');
 if(action==='save'){if(!session)throw new Error('Session required');const s=await readDirector(session);await fs.writeFile(f,JSON.stringify(s.style,null,2),{flag:confirm?'w':'wx'});return {saved:f};}
 const d=directorSchema.parse(JSON.parse(await fs.readFile(f,'utf8')));
 if(action==='delete'){if(!confirm)throw new Error('Preset deletion requires --confirm');await fs.unlink(f);return {deleted:name};}
 if(action==='default'){await writeJSON(path.join(directorRoot(),'default.json'),d.resolved);return {default:name};}
 if(action==='load'){if(!session)throw new Error('Session required');const s=await readDirector(session);if(s.referenceOnly&&!d.resolved.referenceStyle)throw new Error('Legacy presets cannot be loaded into new reference sessions');s.style={...d,confirmed:false};await saveDirector(s);return directorView(s);}
 if(!target)throw new Error('Target name required');await fs.copyFile(f,path.join(root,safeName(target)+'.json'),fs.constants.COPYFILE_EXCL);if(action==='rename')await fs.unlink(f);return {name:target};
}
