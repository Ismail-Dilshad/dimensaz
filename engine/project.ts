import {registerTestDirectory} from './test-artifacts.js';
import {deriveStyle} from './style-dna.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {ROOT,defaults,roots} from './config.js';
import {projectSchema,type Project,type Config} from './schema.js';
import {probe} from '../renderer/ffmpeg-encoder.js';
export async function writeJSON(file:string,value:unknown){await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';await fs.writeFile(tmp,JSON.stringify(value,null,2),'utf8');await fs.rename(tmp,file);}
export function inside(base:string,relative:string){const p=path.resolve(base,relative);if(p===base||!p.startsWith(path.resolve(base)+path.sep))throw new Error('Path escapes its project: '+relative);return p;}
export function slugify(title:string){return title.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'kurdish-video';}
const initialized=new Map<string,Promise<void>>();
export async function initialize(c:Config){const {workspace,output}=roots(c),key=workspace+'|'+output;if(!initialized.has(key)){const task=(async()=>{for(const d of ['projects','cache','history','inbox/videos','inbox/images','inbox/audio','inbox/scripts'])await fs.mkdir(path.join(workspace,d),{recursive:true});await fs.mkdir(output,{recursive:true});})();initialized.set(key,task);task.catch(()=>initialized.delete(key));}await initialized.get(key);}
export function dir(id:string,c:Config){if(!/^[a-z0-9][a-z0-9_-]{0,150}$/i.test(id))throw new Error('Invalid project ID');return inside(path.join(roots(c).workspace,'projects'),id);}
export async function save(p:Project){projectSchema.parse(p);const d=dir(p.id,p.config);await writeJSON(path.join(d,'project.json'),p);await fs.writeFile(path.join(d,'script.txt'),p.script,'utf8');}
export async function load(id:string):Promise<Project>{const c=await defaults();return projectSchema.parse(JSON.parse(await fs.readFile(path.join(dir(id,c),'project.json'),'utf8')));}
export async function create(title:string,script:string='',overrides:Partial<Config>={}):Promise<Project>{
 if(!title.trim())throw new Error('A title is required');const config=await defaults({...overrides,...(process.env.VITEST||process.env.VIDEO_TEST_RUN==='1'?{renderPurpose:'test' as const}:{})});await initialize(config);const ws=roots(config).workspace;
 // O_EXCL sequence reservations persist even after interruptions; no lock stale-time heuristics.
 let sequence=1;while(true){try{const h=await fs.open(path.join(ws,'history','sequence-'+sequence+'.lock'),'wx');await h.close();break;}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;sequence++;}}
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baghdad',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const slug=slugify(title),id=date+'_'+slug+'_'+String(sequence).padStart(3,'0');
 const p:Project={schemaVersion:1,id,title,slug,sequence,createdAt:new Date().toISOString(),version:1,script,config,styleDNA:deriveStyle(config),scenes:[],media:[],exports:[]};
 await fs.mkdir(path.join(dir(id,config),'input'),{recursive:true});await save(p);return p;
}
export async function revise(id:string){const prev=await load(id);let version=prev.version+1;const base=prev.parentId||prev.id;
 let next:string;while(true){next=base+'_v'+version;try{await fs.mkdir(dir(next,prev.config));break;}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;version++;}}
 const p:Project={...structuredClone(prev),id:next,parentId:base,version,exports:[],createdAt:new Date().toISOString()};
 await fs.cp(path.join(dir(prev.id,prev.config),'input'),path.join(dir(next,prev.config),'input'),{recursive:true});await save(p);return p;
}
export async function importMedia(p:Project,file:string,kind:Project['media'][number]['kind'],at=0){
 const source=path.resolve(file);const stat=await fs.stat(source);if(!stat.isFile())throw new Error('Media must be a file');
 const id=randomUUID();const relative='input/'+id+path.extname(source).toLowerCase();const target=inside(dir(p.id,p.config),relative);
 await fs.copyFile(source,target,fs.constants.COPYFILE_EXCL);const metadata=await probe(target);
 if(kind==='image'&&!metadata.streams.some((s:any)=>s.codec_type==='video'))throw new Error('No decodable image stream');
 if(kind==='video'&&!metadata.streams.some((s:any)=>s.codec_type==='video'))throw new Error('No video stream');
 if(['voice','music','sfx'].includes(kind)&&!metadata.streams.some((s:any)=>s.codec_type==='audio'))throw new Error('No audio stream');
 p.media.push({id,path:relative,kind,metadata,at});await save(p);return p;
}
export async function list(){const c=await defaults();await initialize(c);const names=await fs.readdir(path.join(roots(c).workspace,'projects'));const result:Project[]=[];for(const n of names){try{result.push(await load(n));}catch(e){console.error('Skipped invalid project '+n+': '+String(e));}}return result;}
export async function exportFile(p:Project,file:string){
 const {output,workspace}=roots(p.config);await initialize(p.config);let attempt=0;let target='';
 const orientation=p.config.width===p.config.height?'square':p.config.width<p.config.height?'vertical':'landscape';
 const folder=p.config.renderPurpose==='test'?inside(path.join(workspace,'cache','test-exports'),p.id):path.join(output,p.config.fps+'fps',orientation,p.config.exportCategory);
 await fs.mkdir(folder,{recursive:true});
 if(p.config.renderPurpose==='test')registerTestDirectory(folder,path.join(workspace,'cache','test-exports'),path.join(workspace,'history'));
 while(true){const name=slugify(p.title)+'_'+p.config.fps+'fps_v'+p.version+(attempt?'_export'+String(attempt+1).padStart(2,'0'):'')+'.mp4';target=path.join(folder,name);
 try{await fs.copyFile(file,target,fs.constants.COPYFILE_EXCL);break;}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;attempt++;}}
 const record={id:randomUUID(),project:p.id,version:p.version,file:target,createdAt:new Date().toISOString()};
 await writeJSON(path.join(workspace,'history',record.id+'.json'),record);p.exports.push(target);await save(p);return target;
}


