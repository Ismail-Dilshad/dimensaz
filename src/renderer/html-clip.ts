// A short clip drawn by a web page: the page defines window.render(t) (seconds), and every frame is
// captured and encoded, like the motion renderer. The motion kit (product photos, maps, devices)
// draws its clips this way, so text is shaped by the browser in any language.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {chromiumExecutable} from './browser-path.js';
import {frames} from './frame-renderer.js';
import {ROOT,LATIN_FALLBACK} from '../engine/config.js';
import {defaultFontPath} from '../engine/font-catalog.js';
import {detectLanguage,isRtl,type Language} from '../engine/languages.js';
import type {Config} from '../engine/schema.js';

export const SHAPES={'9:16':[1080,1920],'1:1':[1080,1080],'16:9':[1920,1080],'4:5':[1080,1350]} as const;
export type Shape=keyof typeof SHAPES;
/** A file name that does not exist yet (exports are never overwritten). */
export function freeName(file:string){const ext=path.extname(file),stem=file.slice(0,file.length-ext.length);for(let i=1;;i++){const f=i===1?file:`${stem}-${i}${ext}`;if(!fs.existsSync(f))return f;}}
/** The fonts for a text, as CSS @font-face rules (the language's open font, and Latin). */
export async function fontFaces(text:string,language?:Language){
 const lang=language??detectLanguage(text),main=await defaultFontPath(lang,text);
 const url=(f:string)=>'data:font/ttf;base64,'+fs.readFileSync(path.resolve(ROOT,f)).toString('base64');
 return {css:`@font-face{font-family:Kit;src:url(${url(main)})}@font-face{font-family:KitLatin;src:url(${url(LATIN_FALLBACK)})}`,family:'Kit,KitLatin,sans-serif',rtl:isRtl(lang,text),language:lang};
}
/** Renders the page's frames to an MP4. The page must define window.render(t). */
export async function renderHtmlClip(o:{html:string;width:number;height:number;fps?:number;duration:number;out:string;draft?:boolean}){
 const fps=o.fps??30,out=freeName(path.resolve(o.out));fs.mkdirSync(path.dirname(out),{recursive:true});
 let executablePath:string|undefined;try{executablePath=chromiumExecutable();}catch{executablePath=undefined;}
 const b=await chromium.launch({headless:true,executablePath});
 try{
  const page=await b.newPage({viewport:{width:o.width,height:o.height},deviceScaleFactor:1});
  await page.setContent(o.html,{waitUntil:'load'});
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>undefined)));});
  if(!await page.evaluate(()=>typeof (window as unknown as {render?:unknown}).render==='function'))throw new Error('The clip page has no render(t)');
  const c={fps,codec:'libx264',preset:o.draft?'veryfast':'medium',crf:o.draft?26:18,pixelFormat:'yuv420p',captureConcurrency:1} as unknown as Config;
  await frames([page],c,o.duration,out);
  fs.rmSync(out+'.performance.json',{force:true});
  return {file:out,width:o.width,height:o.height,seconds:o.duration,fps};
 }finally{await b.close();}
}
export const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export const dataUrl=(file:string)=>{const ext=path.extname(file).toLowerCase().slice(1),type=ext==='jpg'?'jpeg':ext==='svg'?'svg+xml':ext;return `data:image/${type};base64,`+fs.readFileSync(file).toString('base64');};
