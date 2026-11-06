import {libraryRecords,reusable} from './asset-library.js';
import {readFileSync} from 'node:fs';
import type {ReferenceMatch} from '../motion-library/model.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT} from './config.js';
export type Asset={id:string;path:string;source:string;license:string;tags:string[];width:number;height:number};
export async function assets():Promise<Asset[]>{
 const entries=JSON.parse(await fs.readFile(path.join(ROOT,'assets/asset-manifest.json'),'utf8')) as Asset[];
 entries.push(...libraryRecords().filter(reusable));
 for(const a of entries){if(!a.license||!a.source||!a.tags.length)throw new Error('Unlicensed or untagged asset '+a.id);const resolved=path.resolve(ROOT,a.path);if(!resolved.startsWith(path.join(ROOT,'assets')+path.sep))throw new Error('Unsafe asset path');await fs.access(resolved);}
 return entries;
}
export function selectAsset(entries:Asset[],tags:string[]){return [...entries].sort((a,b)=>b.tags.filter(t=>tags.includes(t)).length-a.tags.filter(t=>tags.includes(t)).length).find(a=>a.tags.some(t=>tags.includes(t)));}

export function selectSceneAsset(role:string,reference?:ReferenceMatch){
 const entries=JSON.parse(readFileSync(path.join(ROOT,'assets/asset-manifest.json'),'utf8')) as Asset[];
 entries.push(...libraryRecords().filter(reusable));
 const fallback=role==='product'?'shopping':role==='benefit'?'analytics':'communication';
 const tags=(reference?.technique?.assetTags||[]).filter(tag=>!['clay','illustration'].includes(tag));
 return selectAsset(entries,tags)?.id||fallback;
}


// Read-only compatibility view: bundled originals remain in their existing manifest.
export async function catalogIndex():Promise<import('./asset-library.js').LibraryRecord[]>{
 const modern=libraryRecords(),known=new Set(modern.map(a=>a.id));
 const legacy=(await assets()).filter(a=>!known.has(a.id));
 const {createHash}=await import('node:crypto');
 for(const a of legacy){const hash=createHash('sha256').update(await fs.readFile(path.resolve(ROOT,a.path))).digest('hex');modern.push({...a,name:a.id,description:a.tags.join(' '),category:'illustrations',style:'clay',format:'svg',hash,originalHash:hash,downloadedAt:'legacy',preview:null,renderable:true,transparent:null,scan:'legacy bundled original; not rescanned',finalUrl:null,provenance:{sourceWebsite:'Bundled asset manifest',originalUrl:new URL('file:///'+a.path).href,creator:null,license:a.license,licenseUrl:null,licenseEvidence:a.source+'; manifest license: '+a.license,commercial:a.license==='CC0-1.0'?true:null,modification:a.license==='CC0-1.0'?true:null,attribution:a.license==='CC0-1.0'?'None':null,verified:a.license==='CC0-1.0',origin:'original',referenceIds:[]},evaluation:{reviewed:true,quality:0,relevance:0,styleConsistency:0,notes:'Existing bundled assets; subjective scores are not inferred'}});}
 return modern;
}
