// Renders caption overlays with Chromium so right-to-left scripts are shaped by the
// browser (HarfBuzz), exactly like the motion renderer. Each cue becomes a transparent
// full-frame PNG that FFmpeg overlays during the cue's time range.
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium,type Browser} from 'playwright';
import {ROOT,LATIN_FALLBACK} from '../engine/config.js';
import {resolveLanguage,htmlLanguage,isRtl} from '../engine/languages.js';
import {defaultFontPath,resolveFontPreset} from '../engine/font-catalog.js';
import {fontCoverage} from '../engine/text-shaper.js';
import {chromiumExecutable} from '../renderer/browser-path.js';
import type {Cue,Operation} from './edl.js';

type CaptionStyle=Extract<Operation,{op:'captions'}>;

async function launch():Promise<Browser>{
 let executablePath:string|undefined;try{executablePath=chromiumExecutable();}catch{executablePath=undefined;}
 return chromium.launch({headless:true,executablePath});
}
const fontUrl=async(file:string)=>'data:font/'+(file.endsWith('.otf')?'otf':'ttf')+';base64,'+(await fs.readFile(path.resolve(ROOT,file))).toString('base64');
const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/** Picks the caption font following the language policy, and checks glyph coverage. */
export async function captionFont(style:CaptionStyle,cues:Cue[]){
 const text=cues.map(c=>c.text).join('\n');
 const language=resolveLanguage(style.language,text);
 const font=style.fontPreset?await resolveFontPreset(style.fontPreset):await defaultFontPath(language,text);
 const fonts=[font,LATIN_FALLBACK].map(f=>fontCoverage(path.resolve(ROOT,f)));
 const missing=[...new Set([...text].filter(ch=>!/[\s\p{Cf}]/u.test(ch)&&!fonts.some(has=>has(ch.codePointAt(0)!))))];
 if(missing.length)throw new Error('Caption font cannot show: '+missing.join(' ')+'. Choose another allowed font with fontPreset.');
 return {language,font};
}

export async function renderCaptionImages(cues:Cue[],style:CaptionStyle,size:{width:number;height:number},dir:string){
 const {language,font}=await captionFont(style,cues);
 const [primary,latin]=await Promise.all([fontUrl(font),fontUrl(LATIN_FALLBACK)]);
 const px=Math.round(style.size*size.height);
 const vertical=style.position==='bottom'?`bottom:${style.margin*100}%`:style.position==='top'?`top:${style.margin*100}%`:'top:50%;transform:translateY(-50%)';
 const box=style.background?`background:${style.background};padding:.18em .45em;border-radius:.25em;`:'';
 const stroke=style.strokeWidth>0?`-webkit-text-stroke:${(style.strokeWidth*px/2).toFixed(1)}px ${style.stroke};paint-order:stroke fill;`:'';
 const browser=await launch();
 try{
  const page=await browser.newPage({viewport:size,deviceScaleFactor:1});
  const files:string[]=[];
  for(const [i,cue] of cues.entries()){
   const rtl=isRtl(language,cue.text);
   await page.setContent(`<!doctype html><html lang="${htmlLanguage(language,cue.text)}"><head><meta charset="utf-8"><style>
@font-face{font-family:Cap;src:url(${primary})}@font-face{font-family:CapLatin;src:url(${latin})}
html,body{margin:0;width:${size.width}px;height:${size.height}px;background:transparent;overflow:hidden}
#c{position:absolute;left:0;right:0;${vertical};display:flex;justify-content:center}
#t{max-width:${style.maxWidth*100}%;font:${style.weight} ${px}px/1.35 Cap,CapLatin,sans-serif;color:${style.color};${stroke}${box}
text-align:center;white-space:pre-wrap;overflow-wrap:break-word;unicode-bidi:plaintext}
</style></head><body><div id="c"><div id="t" dir="${rtl?'rtl':'auto'}">${esc(cue.text)}</div></div></body></html>`);
   await page.evaluate(()=>document.fonts.ready);
   const ok=await page.evaluate(()=>document.fonts.check('32px Cap'));
   if(!ok)throw new Error('Caption font failed to load: '+font);
   const file=path.join(dir,`caption-${String(i).padStart(4,'0')}.png`);
   await page.screenshot({path:file,omitBackground:true});
   files.push(file);
  }
  return {files,font,language};
 }finally{await browser.close();}
}
