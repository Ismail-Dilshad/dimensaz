import {it,expect} from 'vitest';
import {defaults} from '../engine/config.js';
import {languageSchema} from '../engine/languages.js';
import {configSchema} from '../engine/schema.js';
import {briefSchema} from '../engine/conversation.js';
import {parseScript} from '../engine/script-parser.js';
import {direction,words} from '../engine/rtl-layout.js';
import {checkGlyphs} from '../engine/text-shaper.js';
import {plan} from '../engine/scene-planner.js';
import {create} from '../engine/project.js';
import {openRenderer} from '../renderer/browser-renderer.js';

export const samples=[
 {language:'ckb',script:'سڵاو! کوردی سۆرانی — ڕۆژ، گەشە، دڵ. ٢٠٢٦',dir:'rtl'},
 {language:'en',script:'Hello, world! English text — price: $25.50 (2026).',dir:'ltr'},
 {language:'ar',script:'مَرْحَبًا بِالْعَالَمِ! اللغة العربية — ٢٠٢٦.',dir:'rtl'},
 {language:'fa',script:'سلام دنیا! فارسی را می‌نویسیم؛ پژواک گچ — ۱۴۰۵.',dir:'rtl'},
 {language:'badini',script:'سلاڤ! کوردی بادینی — دهوک، ڤ، ێ.',dir:'rtl'},
 {language:'kmr',script:'Silav! Kurdî: Ç ç Ê ê Î î Ş ş Û û — 2026.',dir:'ltr'}
] as const;

it('keeps Sorani primary, accepts explicit languages, rejects unknown values',async()=>{
 expect((await defaults()).language).toBe('ckb');
 expect(briefSchema.parse({title:'Default',script:'Hello'}).language).toBe('ckb');
 for(const row of samples)expect(briefSchema.parse({title:row.language,script:row.script,language:row.language}).language).toBe(row.language);
 expect(languageSchema.safeParse('guess-language').success).toBe(false);
 expect(briefSchema.safeParse({title:'Empty',script:' \r\n\t'}).success).toBe(false);
});
it.each(samples)('preserves $language Unicode, punctuation, and source offsets',async row=>{
 const script='\r\n'+row.script+'\n\n';
 expect(parseScript(script).join('')).toBe(script);
 expect(direction(script)).toBe(row.dir);
 for(const word of words(script))expect(script.slice(word.start,word.end)).toBe(word.text);
 const c=await defaults({language:row.language});
 expect(()=>checkGlyphs(script,c)).not.toThrow();
 expect(plan(script,c).map(s=>s.text).join('')).toBe(script);
});
it('detects Latin Kurdish coverage gaps without an explicit compatible fallback',async()=>{
 const c=await defaults({fallbacks:[]});
 expect(()=>checkGlyphs('Ş ş',c)).toThrow(/Missing glyphs/);
 expect(checkGlyphs('Ş ş',await defaults()).fallbackGlyphs).toEqual(['Ş','ş']);
});
it('rejects invalid animation names before launching a browser',async()=>{
 const c=await defaults();
 expect(configSchema.safeParse({...c,animation:'not-real'}).success).toBe(false);
 expect(configSchema.safeParse({...c,transition:'not-real'}).success).toBe(false);
});
it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('renders all language fixtures without changing text, clipping, or seek results',async()=>{
 for(const row of samples){
  const p=await create('language-browser-'+row.language,row.script,{language:row.language,width:540,height:960,fontSize:46,minFontSize:24,useReferences:false});
  p.scenes=plan(p.script,p.config);p.scenes[0].animation='phrase-rise';
  const r=await openRenderer(p);
  try{
   await r.page.evaluate(()=>window.render(1));
   const result=await r.page.locator('[data-kinetic]').evaluate(el=>{
    const text=el.firstElementChild as HTMLElement,box=el.getBoundingClientRect();
    return {text:text.textContent,direction:text.dir,language:text.lang,
     loaded:document.fonts.check('32px VideoPrimary'),
     fits:[...text.querySelectorAll('[data-word]')].every(word=>{const r=word.getBoundingClientRect();return r.left>=box.left-1&&r.right<=box.right+1&&r.top>=box.top-1&&r.bottom<=box.bottom+1;})};
   });
   expect(result).toMatchObject({text:row.script,direction:row.dir,loaded:true,fits:true});
   expect(result.language).toBe(row.language==='badini'?'kmr-Arab':row.language==='kmr'?'kmr-Latn':row.language);
   const a=await r.page.screenshot();await r.page.evaluate(()=>window.render(.1));await r.page.evaluate(()=>window.render(1));expect(await r.page.screenshot()).toEqual(a);
  }finally{await r.close();}
 }
},30000);
it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('keeps embedded Latin and Arabic phrases in their own reading order',async()=>{
 for(const script of ['سڵاو OpenAI ChatGPT 2026!','Hello مرحبا بالعالم']){
  const p=await create('mixed-direction',script,{width:720,height:1280,fontSize:38,minFontSize:24,useReferences:false});
  p.scenes=plan(script,p.config);p.scenes[0].animation='phrase-rise';const r=await openRenderer(p);
  try{
   await r.page.evaluate(()=>window.render(1));
   const boxes=await r.page.locator('[data-word]').evaluateAll(nodes=>nodes.map(el=>({text:el.textContent,x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y})));
   if(script.startsWith('Hello'))expect(boxes[1].x).toBeGreaterThan(boxes[2].x);
   else {expect(boxes[1].x).toBeLessThan(boxes[2].x);expect(boxes[2].x).toBeLessThan(boxes[3].x);}
   expect(await r.page.locator('[data-kinetic]').textContent()).toBe(script);
  }finally{await r.close();}
 }
},30000);
