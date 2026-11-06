import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fs from 'node:fs';
import {configSchema, type Config} from './schema.js';
import {ROOT} from './config-root.js';
import {defaultFontPath} from './font-catalog.js';
import {languageSchema} from './languages.js';
export {ROOT};
// Bundled open-license Latin font: portable fallback for Latin words inside any script.
export const LATIN_FALLBACK='assets/fonts/open/Inter-Variable.ttf';
export async function defaults(overrides:Partial<Config>={}):Promise<Config>{
 const names=['defaults','branding','typography','motion','rendering','audio'];
 const parts=await Promise.all(names.map(n=>readFile(path.join(ROOT,'config',n+'.json'),'utf8').then(JSON.parse)));
 const settings=Object.assign({},...parts,overrides);
 // Explicit local paths are saved in new projects; OS fonts are never redistributed.
 // Legacy project configurations retain their original font list.
 if(overrides.fallbacks===undefined&&!settings.fallbacks.length){
  if(process.env.VIDEO_LATIN_FONT&&!fs.existsSync(process.env.VIDEO_LATIN_FONT))throw new Error('VIDEO_LATIN_FONT does not exist: '+process.env.VIDEO_LATIN_FONT);
  const candidates=[process.env.VIDEO_LATIN_FONT,LATIN_FALLBACK];
  const latin=candidates.find((p):p is string=>!!p&&fs.existsSync(path.resolve(ROOT,p)));
  if(latin)settings.fallbacks=[latin];
 }
 // New jobs get the language's default font (config/locales.json) unless a font was chosen.
 if(!settings.font)settings.font=await defaultFontPath(languageSchema.parse(settings.language));
 return configSchema.parse(settings);
}
export function roots(config:Config){return {workspace:path.resolve(ROOT,process.env.VIDEO_WORKSPACE||config.workspace),output:path.resolve(ROOT,process.env.VIDEO_OUTPUT||config.output)};}
