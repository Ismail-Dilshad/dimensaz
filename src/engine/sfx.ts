import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {probe,run,ffmpeg} from '../renderer/ffmpeg-encoder.js';
import {writeJSON} from './project.js';
import {ROOT} from './config.js';
export const categories=['clicks','ticks','typing','pops','whooshes','impacts','notifications','digital','success'] as const;
export type Sfx={file:string;sha256:string;duration:number;category:string;license:string|null;rmsDb:number|null};
export async function indexSfx(root:string):Promise<Sfx[]>{
 const result:Sfx[]=[];
 async function visit(folder:string){
  for(const entry of await fs.readdir(folder,{withFileTypes:true}).catch(()=>[])){
   const file=path.join(folder,entry.name);
   if(entry.isDirectory())await visit(file);
   else if(/\.(wav|mp3|ogg|flac|m4a)$/i.test(file)){
    const meta=await probe(file);if(!meta.streams.some((s:{codec_type:string})=>s.codec_type==='audio'))continue;
    const sidecar=JSON.parse(await fs.readFile(file+'.json','utf8').catch(()=>'{}')) as {license?:string;category?:string};
    const samples=await run(ffmpeg,['-v','error','-i',file,'-af','astats=metadata=1,ametadata=print:file=-','-f','null','-']);
    const levels=[...samples.matchAll(/Overall.RMS_level=(-?[\d.]+)/g)].map(m=>Number(m[1])).filter(Number.isFinite);
    result.push({file:path.resolve(file),sha256:createHash('sha256').update(await fs.readFile(file)).digest('hex'),duration:Number(meta.format.duration),
     category:categories.find(c=>c===sidecar.category)||categories.find(c=>entry.name.toLowerCase().includes(c.replace(/s$/,'')))||'unclassified',
     license:sidecar.license||null,rmsDb:levels.length?levels.at(-1)!:null});
   }
  }
 }
 await visit(root);await writeJSON(path.join(root,'index.json'),result.map(s=>({...s,file:path.relative(ROOT,s.file).split(path.sep).join('/')})));return result;
}
// Index entries are repo-relative; legacy entries may hold an absolute path from another machine.
export function sfxPath(file:string){const m=file.replace(/\\/g,'/').match(/(?:^|\/)(assets\/sfx\/.+)$/);return path.resolve(ROOT,m?m[1]:file);}
export async function readSfxIndex():Promise<Sfx[]>{const items:Sfx[]=JSON.parse(await fs.readFile(path.join(ROOT,'assets/sfx/index.json'),'utf8').catch(()=>'[]'));return items.map(s=>({...s,file:sfxPath(s.file)}));}
export function eligibleSfx(items:Sfx[]){return items.filter(s=>s.license==='CC0-1.0'&&s.duration<=1&&s.duration>0);}
