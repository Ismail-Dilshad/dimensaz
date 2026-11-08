import {it,expect,describe} from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fontCatalog,resolveFontPreset,recommendFonts,fontsForLanguage,defaultFontPath,locales} from '../src/engine/font-catalog.js';
import {defaults,ROOT} from '../src/engine/config.js';
import {requestSchema} from '../src/engine/production.js';
import {detectLanguage,resolveLanguage} from '../src/engine/languages.js';

const sha=async(f:string)=>createHash('sha256').update(await fs.readFile(path.resolve(ROOT,f))).digest('hex');

describe('font catalog',()=>{
 it('keeps every catalogued font byte-identical to its recorded hash',async()=>{
  const c=await fontCatalog();
  for(const f of c.fonts.filter(f=>f.origin!=='installed-system-font'))expect(await sha(f.path),f.id).toBe(f.sha256);
  expect(c.fonts.every(f=>f.origin!=='existing-project-font')).toBe(true);
 });
 it('records an open license and license text for every bundled open font',async()=>{
  const open=(await fontCatalog()).fonts.filter(f=>f.origin==='bundled-open-font');
  expect(open.length).toBeGreaterThanOrEqual(9);
  for(const f of open){expect(f.license).toBe('OFL-1.1');await fs.access(path.resolve(ROOT,f.licenseFile!));}
 });
 it('resolves named presets and rejects unknown ones',async()=>{
  expect(await resolveFontPreset('amiri')).toBe('assets/fonts/open/Amiri-Regular.ttf');
  expect(await resolveFontPreset('inter')).toBe('assets/fonts/open/Inter-Variable.ttf');
  await expect(resolveFontPreset('not-a-font')).rejects.toThrow('Unknown');
  expect(requestSchema.parse({schemaVersion:1,title:'Test',script:'Hello',fontPreset:'arial'}).fontPreset).toBe('arial');
 });
});

describe('font policy',()=>{
 it('limits Kurdish in Arabic script to open fonts that cover every Kurdish letter',async()=>{
  const c=await fontCatalog();
  for(const [language,text] of [['ckb','سڵاو'],['kmr','سلاڤ'],['badini','سلاڤ']] as const){
   const allowed=fontsForLanguage(c.fonts,language,text);
   expect(allowed.map(f=>f.id).sort()).toEqual(['amiri','noto-kufi-arabic','noto-naskh-arabic','noto-sans-arabic','vazirmatn']);
   expect(allowed.every(f=>f.origin==='bundled-open-font'&&f.license==='OFL-1.1')).toBe(true);
  }
  const kurdish=await recommendFonts('سڵاو ڕ ڵ ۆ ێ ە ڤ گ چ پ ژ',undefined,'ckb');
  expect(kurdish.fonts.every(f=>f.missing.length===0)).toBe(true);
 });
 it('gives other languages open fonts first',async()=>{
  const c=await fontCatalog();
  for(const [language,text] of [['en','Hello'],['ar','مرحبا'],['fa','سلام'],['kmr','Silav']] as const){
   const allowed=fontsForLanguage(c.fonts,language,text);
   expect(allowed[0].origin,language).toBe('bundled-open-font');
  }
 });
 it('maps each language to its default font through config/locales.json',async()=>{
  const loc=await locales();expect(loc.default).toBe('en');
  expect(await defaultFontPath('en')).toBe('assets/fonts/open/Inter-Variable.ttf');
  expect(await defaultFontPath('ar')).toBe('assets/fonts/open/NotoNaskhArabic-Variable.ttf');
  expect(await defaultFontPath('fa')).toBe('assets/fonts/open/Vazirmatn-Variable.ttf');
  expect(await defaultFontPath('ckb')).toBe('assets/fonts/open/Vazirmatn-Variable.ttf');
  expect(await defaultFontPath('kmr','Silav li we')).toBe('assets/fonts/open/Inter-Variable.ttf');
 });
 it('uses English and the English default font for new jobs without a language',async()=>{
  const c=await defaults();expect(c.language).toBe('en');expect(c.font).toBe('assets/fonts/open/Inter-Variable.ttf');
  expect(c.fallbacks).toEqual(['assets/fonts/open/Inter-Variable.ttf']);
 });
 it('recommends fonts that fully cover the script within the allowed set',async()=>{
  const en=await recommendFonts('Hello world','playful','en');
  expect(en.fonts[0].missing).toEqual([]);expect(en.fonts[0].id).toBe('fredoka');
  const ckb=await recommendFonts('سڵاو ڕ ڵ ۆ ێ ە',undefined,'ckb');
  expect(ckb.fonts.every(f=>f.origin==='bundled-open-font')).toBe(true);
  expect(ckb.fonts[0].missing).toEqual([]);
 });
});

describe('language detection',()=>{
 it('detects English, Sorani, Arabic and Persian from the script',()=>{
  expect(detectLanguage('Make your first motion video')).toBe('en');
  expect(detectLanguage('ئەمە یەکەم ڤیدیۆی منە')).toBe('ckb');
  expect(detectLanguage('هذا هو الفيديو الأول')).toBe('ar');
  expect(detectLanguage('این اولین ویدیوی من است')).toBe('fa');
  expect(detectLanguage('سڵاو TikTok 2026')).toBe('ckb');
  // Mixed scripts: any Arabic-script letters select an Arabic-script language so its glyphs get a font.
  expect(detectLanguage('سڵاو OpenAI ChatGPT 2026!')).toBe('ckb');
  expect(detectLanguage('Hello مرحبا بالعالم')).toBe('ar');
 });
 it('keeps an explicit language and treats auto as detection',()=>{
  expect(resolveLanguage('badini','سلاڤ')).toBe('badini');
  expect(resolveLanguage('auto','Hello')).toBe('en');
  expect(resolveLanguage(undefined,'ڕۆژ باش')).toBe('ckb');
 });
});
