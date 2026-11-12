import fs from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {ROOT} from './config-root.js';
import {fontCoverage} from './text-shaper.js';
import {type Language} from './languages.js';
const fontLanguage=z.enum(['ckb','en','ar','fa']);
const catalogSchema=z.object({version:z.literal(1),primary:z.string(),defaultPath:z.string(),fonts:z.array(z.object({id:z.string(),name:z.string(),path:z.string(),roles:z.array(z.string()),language:fontLanguage,languages:z.array(fontLanguage).optional(),origin:z.enum(['existing-project-font','installed-system-font','bundled-open-font']),license:z.string().optional(),licenseFile:z.string().optional(),sha256:z.string().regex(/^[a-f0-9]{64}$/)}))});
const localeSchema=z.object({version:z.literal(1),default:z.string(),languages:z.record(z.string(),z.object({name:z.string(),direction:z.enum(['ltr','rtl','auto']),script:z.string(),fonts:z.object({source:z.enum(['open','kurdish-open']),default:z.string(),latinDefault:z.string().optional()})}))}).passthrough();
export async function locales(){return localeSchema.parse(JSON.parse(await fs.readFile(path.join(ROOT,'config/locales.json'),'utf8')));}
export async function fontCatalog(){const catalog=catalogSchema.parse(JSON.parse(await fs.readFile(path.join(ROOT,'config/fonts.json'),'utf8')));return {...catalog,fonts:await Promise.all(catalog.fonts.map(async font=>({...font,available:await fs.access(path.resolve(ROOT,font.path)).then(()=>true,()=>false),primary:font.id===catalog.primary})))};}
export type CatalogFont=Awaited<ReturnType<typeof fontCatalog>>['fonts'][number];
export async function resolveFontPreset(id:string){const catalog=await fontCatalog();const font=catalog.fonts.find(f=>f.id===id);if(!font)throw new Error('Unknown font preset: '+id);if(!font.available)throw new Error('Font is unavailable on this machine: '+font.name);return id===catalog.primary?catalog.defaultPath:font.path;}
/** Kurdish in Arabic script uses the bundled open fonts that cover every Kurdish letter. */
export function usesKurdishFonts(language:Language,text:string){
 return language==='ckb'||((language==='kmr'||language==='badini')&&/\p{Script=Arabic}/u.test(text));
}
/** Fonts allowed for a language, following config/locales.json fontPolicy. */
export function fontsForLanguage<T extends Pick<CatalogFont,'origin'|'language'|'languages'>>(fonts:T[],language:Language,text:string):T[]{
 if(usesKurdishFonts(language,text))return fonts.filter(f=>f.origin==='bundled-open-font'&&(f.languages??[f.language]).includes('ckb'));
 const target=language==='kmr'||language==='badini'?'en':language;
 const rank=(f:T)=>f.origin==='bundled-open-font'?0:f.origin==='installed-system-font'?1:2;
 return fonts.filter(f=>(f.languages??[f.language]).includes(target as z.infer<typeof fontLanguage>)).sort((a,b)=>rank(a)-rank(b));
}
/** The language's default font path from config/locales.json. Saved projects keep their own stored font. */
export async function defaultFontPath(language:Language,text?:string){
 const loc=(await locales()).languages[language];if(!loc)throw new Error('Unknown language: '+language);
 const latin=(language==='kmr'||language==='badini')&&text!==undefined&&!/\p{Script=Arabic}/u.test(text)&&loc.fonts.latinDefault;
 return resolveFontPreset(latin||loc.fonts.default);
}
export async function recommendFonts(text:string,role?:string,language?:Language){
 const catalog=await fontCatalog();const codepoints=[...new Set([...text].filter(c=>!/[\s\p{Cf}]/u.test(c)))];
 const allowed=language?fontsForLanguage(catalog.fonts,language,text):catalog.fonts;
 const matches=allowed.filter(f=>f.available).map(font=>{const has=fontCoverage(path.resolve(ROOT,font.path));const missing=codepoints.filter(c=>!has(c.codePointAt(0)!));const roleMatch=!!role&&font.roles.includes(role);return {...font,missing,coverage:codepoints.length?(codepoints.length-missing.length)/codepoints.length:1,roleMatch};});
 // The answer comes first: the best font that covers every character of the text. The catalog's
 // own default (often a Latin font) is not a recommendation for Kurdish or Arabic text.
 const sorted=matches.sort((a,b)=>Number(b.missing.length===0)-Number(a.missing.length===0)||Number(b.roleMatch)-Number(a.roleMatch)||Number(b.roles.includes('default'))-Number(a.roles.includes('default'))||Number(b.primary)-Number(a.primary));
 const best=sorted.find(f=>f.missing.length===0);
 return {recommended:best?.id??null,...(best?{recommendedPath:best.path}:{note:'No open font covers every character of this text: add one that does.'}),catalogDefault:catalog.primary,defaultPath:catalog.defaultPath,fonts:sorted,coverageNote:'Coverage is technical evidence, not a judgment of typographic quality. Kurdish text uses only the open fonts that cover every Kurdish letter; other languages choose an open font that fits the video style. Keep one primary font per video and inspect the preview.'};
}
