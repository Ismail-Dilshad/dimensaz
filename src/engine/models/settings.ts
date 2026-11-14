// The browser studio's settings: which services are connected, which model each role uses, who
// makes images, sound and voice, the budgets, and what may leave the computer. Keys go to the
// system keychain when it is available, otherwise to .env (never committed); they are never
// written to the settings file, the brain or a log, and never sent to the page.
import fs from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {ROOT} from '../config.js';
import {PROVIDERS,providerById,testLocal,type Model,type Can} from './providers.js';
import {loadStudio} from '../studio.js';

export const settingsDir=()=>path.resolve(ROOT,process.env.TEMPOLOOM_SETTINGS_DIR||'.tempoloom');
const envFile=()=>path.resolve(ROOT,process.env.TEMPOLOOM_ENV_FILE||'.env');
const SERVICE='tempoloom';

const pick=z.object({provider:z.string().min(1).max(60),model:z.string().min(1).max(200)}).strict();
const localServer=z.object({id:z.string().regex(/^local-[a-z0-9-]{1,40}$/),name:z.string().min(1).max(60),baseURL:z.string().url().refine(u=>/^https?:\/\//.test(u),'Use an http or https address')}).strict();
export const settingsSchema=z.object({
 version:z.literal(1).default(1),
 /** Who drives a new job: the terminal agent (no key needed), the browser, or ask each time. */
 driver:z.enum(['terminal','browser','ask']).default('terminal'),
 model:pick.nullable().default(null),
 roleModels:z.record(z.string(),pick).default({}),
 makers:z.object({images:z.string().default('off'),video:z.string().default('off'),music:z.string().default('off'),sfx:z.string().default('off'),voice:z.enum(['elevenlabs','off']).default('elevenlabs')}).strict().default({images:'off',video:'off',music:'off',sfx:'off',voice:'elevenlabs'}),
 budget:z.object({perJob:z.number().min(0).max(1000).default(2),perDay:z.number().min(0).max(5000).default(10),askAbove:z.number().min(0).max(1000).default(.5)}).strict().default({perJob:2,perDay:10,askAbove:.5}),
 share:z.enum(['frames','clips','full','local']).default('frames'),
 local:z.array(localServer).max(12).default([]),
}).strict();
export type Settings=z.infer<typeof settingsSchema>;

const file=()=>path.join(settingsDir(),'settings.json');
export function readSettings():Settings{
 try{return settingsSchema.parse(JSON.parse(fs.readFileSync(file(),'utf8')));}catch{return settingsSchema.parse({});}
}
function writeSettings(s:Settings){fs.mkdirSync(settingsDir(),{recursive:true});const tmp=file()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(s,null,1)+'\n');fs.renameSync(tmp,file());return s;}

// ---------- keys ----------
type Keyring={Entry:new(service:string,name:string)=>{setPassword(v:string):void;getPassword():string|null|undefined;deletePassword():boolean|void}};
let ring:Keyring|null|undefined;
/** The system keychain, or null where there is none (or TEMPOLOOM_KEYCHAIN=off). */
async function keyring():Promise<Keyring|null>{
 if(ring!==undefined)return ring;
 if(process.env.TEMPOLOOM_KEYCHAIN==='off')return ring=null;
 try{const m=await import('@napi-rs/keyring' as string) as Keyring;const probe=new m.Entry(SERVICE,'TEMPOLOOM_PROBE');probe.setPassword('ok');const back=probe.getPassword();try{probe.deletePassword();}catch{/* nothing to delete */}ring=back==='ok'?m:null;}
 catch{ring=null;}
 return ring;
}
/** Where each saved key lives (names only, never the keys). */
const indexFile=()=>path.join(settingsDir(),'keys.json');
const readIndex=():Record<string,'keychain'|'env-file'>=>{try{return JSON.parse(fs.readFileSync(indexFile(),'utf8'));}catch{return {};}};
const writeIndex=(x:Record<string,string>)=>{fs.mkdirSync(settingsDir(),{recursive:true});fs.writeFileSync(indexFile(),JSON.stringify(x,null,1)+'\n');};
const NAME=/^[A-Z][A-Z0-9_]{2,60}$/;
function setEnvLine(name:string,value:string|null){
 const f=envFile();let text='';try{text=fs.readFileSync(f,'utf8');}catch{/* no .env yet */}
 const lines=text.split(/\r?\n/),re=new RegExp(`^\\s*(export\\s+)?${name}\\s*=`);
 const kept=lines.filter(l=>!re.test(l));
 if(value!==null){const v=/^[\w\-.:/+=@]+$/.test(value)?value:JSON.stringify(value);while(kept.length&&kept.at(-1)==='')kept.pop();kept.push(`${name}=${v}`,'');}
 fs.writeFileSync(f,kept.join('\n'));
}
/** Saves a key: the keychain when there is one, else .env. It is also set for this running server. */
export async function saveKey(name:string,value:string){
 if(!NAME.test(name))throw new Error('Not a key name');
 const v=value.trim();if(v.length<8||v.length>400||/\s/.test(v))throw new Error('That does not look like a key. Paste it whole, with no spaces.');
 const r=await keyring(),idx=readIndex();
 if(r){new r.Entry(SERVICE,name).setPassword(v);idx[name]='keychain';if(envHas(name))setEnvLine(name,null);}
 else{setEnvLine(name,v);idx[name]='env-file';}
 writeIndex(idx);process.env[name]=v;
 return {name,stored:idx[name]};
}
export async function removeKey(name:string){
 if(!NAME.test(name))throw new Error('Not a key name');
 const idx=readIndex();
 if(!idx[name]&&!envHas(name)&&process.env[name])throw new Error(`${name} is set in your system's environment, not by Tempoloom. Remove it there.`);
 if(idx[name]==='keychain'){const r=await keyring();try{r&&new r.Entry(SERVICE,name).deletePassword();}catch{/* already gone */}}
 if(idx[name]==='env-file'||envHas(name))setEnvLine(name,null);
 delete idx[name];writeIndex(idx);delete process.env[name];
 return {name,removed:true};
}
const envHas=(name:string)=>{try{return new RegExp(`^\\s*(export\\s+)?${name}\\s*=`,'m').test(fs.readFileSync(envFile(),'utf8'));}catch{return false;}};
/** Loads keychain keys into this process (a real environment variable always wins). */
export async function loadKeys(){
 const idx=readIndex(),names=Object.entries(idx).filter(([,w])=>w==='keychain').map(([n])=>n).filter(n=>!process.env[n]);
 if(!names.length)return 0;const r=await keyring();if(!r)return 0;let n=0;
 for(const name of names){try{const v=new r.Entry(SERVICE,name).getPassword();if(v){process.env[name]=v;n++;}}catch{/* missing */}}
 return n;
}
export const keyOf=(name:string)=>process.env[name]?.trim()||'';
const hint=(k:string)=>k?'…'+k.slice(-4):'';

// ---------- model lists ----------
const modelsFile=(id:string)=>path.join(settingsDir(),'models',id+'.json');
type Cached={at:string;models:Model[];note?:string;error?:string};
export function cachedModels(id:string):Cached|null{try{return JSON.parse(fs.readFileSync(modelsFile(id),'utf8')) as Cached;}catch{return null;}}
function cache(id:string,c:Cached){fs.mkdirSync(path.dirname(modelsFile(id)),{recursive:true});fs.writeFileSync(modelsFile(id),JSON.stringify(c)+'\n');}
/** Checks a service with its saved key and keeps its model list. */
export async function test(id:string,f:typeof fetch=fetch){
 const local=readSettings().local.find(x=>x.id===id);
 try{
  const r=local?await testLocal(local.baseURL,keyOf(localKeyName(id))||undefined,f):await (async()=>{const p=providerById(id),k=keyOf(p.env);if(!k)throw new Error('No key saved for '+p.name);return p.test(k,f);})();
  const c:Cached={at:new Date().toISOString(),models:r.models.sort((a,b)=>a.id.localeCompare(b.id)),...(r.note?{note:r.note}:{})};cache(id,c);
  return {ok:true,count:c.models.length,note:r.note??null};
 }catch(e){const prev=cachedModels(id);cache(id,{at:new Date().toISOString(),models:prev?.models??[],error:(e as Error).message});return {ok:false,error:(e as Error).message};}
}
const localKeyName=(id:string)=>id.toUpperCase().replace(/-/g,'_')+'_API_KEY';
const summary=(ms:Model[])=>{const n=(k:keyof Can)=>ms.filter(m=>m.can[k]).length;return {total:ms.length,agents:n('agents'),vision:n('vision'),images:n('images'),video:n('video'),speech:n('speech')};};

// ---------- the settings page ----------
export function overview(){
 const s=readSettings(),idx=readIndex();
 const services=[...PROVIDERS.map(p=>{const k=keyOf(p.env),c=cachedModels(p.id);
   return {id:p.id,name:p.name,group:p.group,about:p.about,signup:p.signup,env:p.env,can:p.can,connected:!!k,hint:hint(k),
    stored:idx[p.env]??(k?(envHas(p.env)?'env-file':'environment'):null),checked:c?.at??null,error:c?.error??null,note:c?.note??null,models:c?summary(c.models):null};}),
  ...s.local.map(l=>{const c=cachedModels(l.id);return {id:l.id,name:l.name,group:'local' as const,about:l.baseURL,signup:'',env:localKeyName(l.id),can:{agents:true},connected:!!c&&!c.error,hint:'',stored:null,checked:c?.at??null,error:c?.error??null,note:c?.note??null,models:c?summary(c.models):null,baseURL:l.baseURL};})];
 const roles=[{id:'director',title:'Director'},...loadStudio().roles.map(r=>({id:r.id,title:r.title}))];
 return {settings:s,services,roles,warnings:warnings(s),keychain:ring===undefined?null:!!ring};
}
/** The models of every connected service that can do a thing (agents, images, ...). */
export function modelsFor(can:keyof Can){
 const ids=[...PROVIDERS.filter(p=>keyOf(p.env)).map(p=>p.id),...readSettings().local.map(l=>l.id)];
 return ids.flatMap(id=>(cachedModels(id)?.models??[]).filter(m=>m.can[can]).map(m=>({provider:id,model:m.id,name:m.name??m.id,price:m.price??null,context:m.context??null})));
}
export function warnings(s:Settings){
 const w:string[]=[];const eff=(role:string)=>s.roleModels[role]??s.model;
 const rev=eff('reviewer'),build=eff('producer');
 if(rev&&build&&rev.provider===build.provider&&rev.model===build.model)w.push('The reviewer uses the same model as the producer. Give it a different one so its review is independent.');
 if(s.driver!=='terminal'&&!s.model)w.push('Choose a main model before the browser can drive a job.');
 if(s.share==='local'){const cloud=[s.model,...Object.values(s.roleModels)].filter(Boolean).filter(m=>!m!.provider.startsWith('local-'));if(cloud.length)w.push('"Nothing leaves this computer" allows only local models, but a cloud model is chosen.');}
 return w;
}
const known=(p:{provider:string;model:string})=>{if(!(cachedModels(p.provider)?.models??[]).some(m=>m.id===p.model))throw new Error(`${p.model} is not in the model list of ${p.provider}. Press Test on that service first.`);};
/** Changes some settings; everything is checked before it is saved. */
export function update(patch:unknown){
 const cur=readSettings(),p=z.object({driver:settingsSchema.shape.driver.optional(),model:pick.nullable().optional(),roleModels:z.record(z.string(),pick.nullable()).optional(),
  makers:z.object({images:z.string(),video:z.string(),music:z.string(),sfx:z.string(),voice:z.enum(['elevenlabs','off'])}).partial().optional(),
  budget:z.object({perJob:z.number().min(0).max(1000),perDay:z.number().min(0).max(5000),askAbove:z.number().min(0).max(1000)}).partial().optional(),share:settingsSchema.shape.share.optional()}).strict().parse(patch);
 const next:Settings={...cur};
 if(p.driver){if(p.driver!=='terminal')throw new Error('The browser studio cannot drive a job yet; your terminal agent does the work for now.');next.driver=p.driver;}
 if(p.model!==undefined){if(p.model)known(p.model);next.model=p.model;}
 if(p.roleModels){const roles=new Set(['director',...loadStudio().roles.map(r=>r.id)]);next.roleModels={...cur.roleModels};
  for(const [role,m] of Object.entries(p.roleModels)){if(!roles.has(role))throw new Error('Unknown role: '+role);if(m){known(m);next.roleModels[role]=m;}else delete next.roleModels[role];}}
 if(p.makers){next.makers={...cur.makers,...p.makers};
  const may:Record<string,(keyof Can)[]>={images:['images'],video:['video'],music:['music'],sfx:['sound']};
  for(const kind of ['images','video','music','sfx'] as const){const v=next.makers[kind];if(v==='off')continue;const pr=PROVIDERS.find(x=>x.id===v);
   if(!pr||!may[kind]!.some(c=>pr.can[c]))throw new Error(`${pr?.name??v} cannot make ${kind==='sfx'?'sound effects':kind}`);if(!keyOf(pr.env))throw new Error(`Connect ${pr.name} first`);}}
 if(p.budget){next.budget={...cur.budget,...p.budget};if(next.budget.perJob>next.budget.perDay)throw new Error('The budget per job cannot be more than the budget per day');}
 if(p.share)next.share=p.share;
 writeSettings(next);return {settings:next,warnings:warnings(next)};
}
export function addLocal(name:string,baseURL:string){
 const s=readSettings(),slug=name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30)||'server';
 let id='local-'+slug;for(let i=2;s.local.some(l=>l.id===id);i++)id=`local-${slug}-${i}`;
 const l=localServer.parse({id,name:name.trim(),baseURL:baseURL.trim().replace(/\/+$/,'')});
 if(s.local.some(x=>x.baseURL===l.baseURL))throw new Error('That server is already added');
 s.local.push(l);writeSettings(s);return l;
}
export function removeLocal(id:string){
 const s=readSettings();if(!s.local.some(l=>l.id===id))throw new Error('No such server');
 s.local=s.local.filter(l=>l.id!==id);
 if(s.model?.provider===id)s.model=null;for(const [r,m] of Object.entries(s.roleModels))if(m.provider===id)delete s.roleModels[r];
 writeSettings(s);try{fs.rmSync(modelsFile(id));}catch{/* no list */}return {removed:id};
}
