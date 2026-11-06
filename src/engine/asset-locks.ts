import {selectedAssetIds} from './reference-styles.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {assets,type Asset} from './asset-selector.js';
import {libraryRecords} from './asset-library.js';
import {ROOT} from './config.js';
import {dir,inside,save} from './project.js';
import type {Project} from './schema.js';
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
export async function lockAssets(p:Project){
 const selected=selectedAssetIds(p);const existing=p.assetLocks??[];
 const catalog=await assets();const records=libraryRecords();const locks=[];
 for(const id of selected){const old=existing.find(a=>a.id===id);if(old){const bytes=await fs.readFile(inside(dir(p.id,p.config),old.path));if(hash(bytes)!==old.hash)throw new Error('Pinned asset changed: '+id);locks.push(old);continue;}
 const a=catalog.find(a=>a.id===id);if(!a)throw new Error('Unavailable asset '+id);const bytes=await fs.readFile(path.resolve(ROOT,a.path));const digest=hash(bytes),relative='input/asset-locks/'+digest+path.extname(a.path);const file=inside(dir(p.id,p.config),relative);await fs.mkdir(path.dirname(file),{recursive:true});
 try{await fs.writeFile(file,bytes,{flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST'||hash(await fs.readFile(file))!==digest)throw e;}
 locks.push({id:a.id,source:a.source,license:a.license,tags:a.tags,width:a.width,height:a.height,path:relative,hash:digest,provenance:records.find(r=>r.id===id)?.provenance,libraryEvidence:records.find(r=>r.id===id)});
 }p.assetLocks=locks;await save(p);return locks;
}
export async function projectAssets(p:Project):Promise<Asset[]>{
 const selected=selectedAssetIds(p);const result:Asset[]=[];
 const unpinned=selected.filter(id=>!p.assetLocks?.some(a=>a.id===id));const catalog=unpinned.length?await assets():[];
 for(const id of selected){const pinned=p.assetLocks?.find(a=>a.id===id);if(pinned){const file=inside(dir(p.id,p.config),pinned.path);if(hash(await fs.readFile(file))!==pinned.hash)throw new Error('Pinned asset integrity changed: '+id);result.push({...pinned,path:file});}else{const a=catalog.find(a=>a.id===id);if(!a)throw new Error('Unknown, restricted or incompatible scene asset: '+id);result.push(a!);}}
 return result;
}

