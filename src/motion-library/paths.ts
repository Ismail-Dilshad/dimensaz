import path from 'node:path';
import fs from 'node:fs/promises';
import {ROOT} from '../engine/config.js';
// Drop new motion examples here and run pnpm references:update; finished references live in references/motion.
export const LIBRARY=path.join(ROOT,'references','motion-library');
export const MANAGED=path.join(LIBRARY,'_library');
export const INDEX=path.join(MANAGED,'index.json');
export function toRelative(file:string){return path.relative(ROOT,file).split(path.sep).join('/');}
export function resolveSource(relative:string){
 const base=path.join(ROOT,'references'),file=path.resolve(ROOT,relative);
 if(!file.startsWith(base+path.sep))throw new Error('Reference path escapes references/: '+relative);
 return file;
}
export async function realSource(relative:string){
 const file=resolveSource(relative),real=await fs.realpath(file),base=await fs.realpath(path.join(ROOT,'references'));
 if(!real.startsWith(base+path.sep))throw new Error('Reference symlink escapes references/');
 return real;
}
