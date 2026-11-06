import fs from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {ROOT} from './config.js';
import {fontCoverage} from './text-shaper.js';
const catalogSchema=z.object({version:z.literal(1),primary:z.string(),defaultPath:z.string(),fonts:z.array(z.object({id:z.string(),name:z.string(),path:z.string(),roles:z.array(z.string()),language:z.enum(['ckb','en']),origin:z.enum(['existing-project-font','installed-system-font']),sha256:z.string().regex(/^[a-f0-9]{64}$/)}))});
export async function fontCatalog(){const catalog=catalogSchema.parse(JSON.parse(await fs.readFile(path.join(ROOT,'config/fonts.json'),'utf8')));return {...catalog,fonts:await Promise.all(catalog.fonts.map(async font=>({...font,available:await fs.access(path.resolve(ROOT,font.path)).then(()=>true,()=>false),primary:font.id===catalog.primary})))};}
export async function resolveFontPreset(id:string){const catalog=await fontCatalog();const font=catalog.fonts.find(f=>f.id===id);if(!font)throw new Error('Unknown font preset: '+id);if(!font.available)throw new Error('Font is unavailable on this machine: '+font.name);return id===catalog.primary?catalog.defaultPath:font.path;}
export async function recommendFonts(text:string,role?:string){
 const catalog=await fontCatalog();const codepoints=[...new Set([...text].filter(c=>!/[\s\p{Cf}]/u.test(c)))];
 const matches=catalog.fonts.filter(f=>f.available).map(font=>{const has=fontCoverage(path.resolve(ROOT,font.path));const missing=codepoints.filter(c=>!has(c.codePointAt(0)!));const roleMatch=!!role&&font.roles.includes(role);return {...font,missing,coverage:codepoints.length?(codepoints.length-missing.length)/codepoints.length:1,roleMatch};});
 return {primary:catalog.primary,defaultPath:catalog.defaultPath,fonts:matches.sort((a,b)=>Number(b.missing.length===0)-Number(a.missing.length===0)||Number(b.roleMatch)-Number(a.roleMatch)||Number(b.primary)-Number(a.primary)),note:'Coverage is technical evidence, not a judgment of typographic quality. Keep Rabar 021 for default Sorani; select an alternate intentionally and inspect its preview.'};
}
