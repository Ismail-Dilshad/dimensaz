import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import {configSchema, type Config} from './schema.js';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function defaults(overrides:Partial<Config>={}):Promise<Config>{
 const names=['defaults','branding','typography','motion','rendering','audio'];
 const parts=await Promise.all(names.map(n=>readFile(path.join(ROOT,'config',n+'.json'),'utf8').then(JSON.parse)));
 const settings=Object.assign({},...parts,overrides);
 // Explicit local paths are saved in new projects; OS fonts are never redistributed.
 // Legacy project configurations retain their original font list.
 if(overrides.fallbacks===undefined&&!settings.fallbacks.length){
  if(process.env.VIDEO_LATIN_FONT&&!fs.existsSync(process.env.VIDEO_LATIN_FONT))throw new Error('VIDEO_LATIN_FONT does not exist: '+process.env.VIDEO_LATIN_FONT);
  const candidates=[process.env.VIDEO_LATIN_FONT,
   process.platform==='win32'?path.join(process.env.WINDIR||'C:\\Windows','Fonts','arial.ttf'):undefined,
   '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','/System/Library/Fonts/Supplemental/Arial.ttf'];
  const latin=candidates.find((p):p is string=>!!p&&fs.existsSync(p));
  if(latin)settings.fallbacks=[latin];
 }
 return configSchema.parse(settings);
}
export function roots(config:Config){return {workspace:path.resolve(ROOT,process.env.VIDEO_WORKSPACE||config.workspace),output:path.resolve(ROOT,process.env.VIDEO_OUTPUT||config.output)};}
