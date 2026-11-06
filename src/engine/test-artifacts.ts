import fs from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';
const directories=new Map<string,string>(),files=new Map<string,string>();let hook=false;
function ensureHook(){if(!hook){hook=true;process.once('beforeExit',()=>{void cleanupTestArtifacts().catch(e=>console.error('Test cleanup failed: '+String(e)));});}}
export function registerTestFile(file:string,history:string){files.set(path.resolve(file),path.resolve(history));ensureHook();}
export function registerTestDirectory(directory:string,allowedRoot:string,history:string){
 const absolute=path.resolve(directory),root=path.resolve(allowedRoot);
 if(absolute!==root&&!absolute.startsWith(root+path.sep))throw new Error('Test cleanup path escapes allowed root');
 directories.set(absolute,path.resolve(history));
 ensureHook();
}
export async function cleanupTestArtifacts(){
 const entries=[...directories],single=[...files];directories.clear();files.clear();const deleted:string[]=[];
 async function walk(folder:string){
  const stat=await fs.lstat(folder).catch((e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return null;throw e;});if(!stat||stat.isSymbolicLink())return;
  for(const entry of await fs.readdir(folder,{withFileTypes:true}).catch((e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return [];throw e;})){
   const file=path.join(folder,entry.name);
   // Never follow links, remove directories, or touch source/input files.
   if(entry.isSymbolicLink())continue;
   if(entry.isDirectory())await walk(file);
   else if(entry.isFile()&&/\.(mp4|mov|webm)(\.(assets)\.json)?$/i.test(entry.name)){await fs.unlink(file);deleted.push(file);}
  }
 }
 for(const [folder] of entries)await walk(folder);
 for(const [file] of single)for(const target of [file,file+'.assets.json']){const stat=await fs.lstat(target).catch((e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return null;throw e;});if(stat?.isFile()&&!stat.isSymbolicLink()){await fs.unlink(target);deleted.push(target);}}
 if(deleted.length&&(entries.length||single.length)){const history=(entries[0]||single[0])[1];await fs.mkdir(history,{recursive:true});await fs.writeFile(path.join(history,'test-cleanup-'+randomUUID()+'.json'),JSON.stringify({createdAt:new Date().toISOString(),deleted},null,2));}
 return deleted;
}
