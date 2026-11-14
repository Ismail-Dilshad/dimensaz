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

// ---------- styled captions: words that follow the speech, a key word lit, a way of coming in ----------
const STOP=new Set(['the','and','for','with','that','this','you','your','are','was','were','have','has','from','into','about','they','them','then','than','just','very','really','what','when','will','would','could','should']);
/** The key word of a caption: a number, else its longest meaningful word. */
export function keyWord(tokens:string[]){
 const clean=tokens.map(t=>t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%]+$/gu,''));
 const num=clean.findIndex(t=>/\p{N}/u.test(t));if(num>=0)return num;
 let best=-1,len=3;clean.forEach((t,i)=>{if(!STOP.has(t.toLowerCase())&&[...t].length>len){best=i;len=[...t].length;}});return best;
}
type State={from:number;to:number;lit:number[];shown:number;only?:number;intro:'all'|number|null};
/** Renders styled captions as one picture track (PNG frames with their durations, for FFmpeg's
 *  concat reader): each cue in states that follow its words, with a few frames for the way it comes in. */
export async function renderCaptionTrack(cues:Cue[],style:CaptionStyle,size:{width:number;height:number},dir:string,fps:number,duration:number){
 const {language,font}=await captionFont(style,cues);
 const [primary,latin]=await Promise.all([fontUrl(font),fontUrl(LATIN_FALLBACK)]);
 const px=Math.round(style.size*size.height);
 const vertical=style.position==='bottom'?`bottom:${style.margin*100}%`:style.position==='top'?`top:${style.margin*100}%`:'top:50%;margin-top:-.7em';
 const box=style.background?`background:${style.background};padding:.18em .45em;border-radius:.25em;`:'';
 const stroke=style.strokeWidth>0?`-webkit-text-stroke:${(style.strokeWidth*px/2).toFixed(1)}px ${style.stroke};paint-order:stroke fill;`:'';
 const K=style.reveal==='none'?0:Math.max(2,Math.round(.18*fps));
 const browser=await launch(),list:{file:string;dur:number}[]=[];let n=0,at=0;
 try{
  const page=await browser.newPage({viewport:size,deviceScaleFactor:1});
  await page.setContent(`<!doctype html><html lang="${htmlLanguage(language,cues.map(c=>c.text).join(' '))}"><head><meta charset="utf-8"><style>
@font-face{font-family:Cap;src:url(${primary})}@font-face{font-family:CapLatin;src:url(${latin})}
html,body{margin:0;width:${size.width}px;height:${size.height}px;background:transparent;overflow:hidden}
#c{position:absolute;left:0;right:0;${vertical};display:flex;justify-content:center}
#t{max-width:${style.maxWidth*100}%;font:${style.weight} ${px}px/1.35 Cap,CapLatin,sans-serif;color:${style.color};${stroke}${box}
text-align:center;white-space:pre-wrap;overflow-wrap:break-word;unicode-bidi:plaintext;${style.upper?'text-transform:uppercase;':''}transform-origin:50% 60%}
.w{display:inline-block;transform-origin:50% 70%}.w.hide{visibility:hidden}.w.lit{color:${style.highlight}}
</style></head><body><div id="c"><div id="t"></div></div></body></html>`);
  await page.evaluate(async()=>{await document.fonts.load('32px Cap');await document.fonts.load('32px CapLatin');await document.fonts.ready;});
  if(!await page.evaluate(()=>document.fonts.check('32px Cap')))throw new Error('Caption font failed to load: '+font);
  const blank=path.join(dir,'blank.png');await page.evaluate(()=>{document.getElementById('t')!.innerHTML='';});await page.screenshot({path:blank,omitBackground:true});
  const push=(file:string,dur:number)=>{if(dur<=1e-4)return;const last=list.at(-1);if(last&&last.file===file)last.dur+=dur;else list.push({file,dur});at+=dur;};
  for(const c of [...cues].sort((a,b)=>a.start-b.start)){
   if(c.start>at)push(blank,c.start-at);
   const start=Math.max(c.start,at),end=Math.max(start+.04,c.end);
   const tokens=c.text.split(/(\s+)/).filter(x=>x!=='');const idx:number[]=[];tokens.forEach((t,i)=>{if(!/^\s+$/.test(t))idx.push(i);});
   // The words' times: from the speech when they match the cue, else spread over it by length.
   let times=c.words&&c.words.length===idx.length?c.words.map(w=>({start:w.start,end:w.end})):null;
   if(!times){const total=idx.reduce((s,i)=>s+tokens[i]!.length+1,0);let t0=start;times=idx.map(i=>{const d=(end-start)*(tokens[i]!.length+1)/total,w={start:t0,end:t0+d};t0+=d;return w;});}
   const rtl=isRtl(language,c.text),key=style.keyword?keyWord(idx.map(i=>tokens[i]!)):-1;
   await page.evaluate(({tokens,idx,rtl})=>{const t=document.getElementById('t')!;t.dir=rtl?'rtl':'auto';
    t.innerHTML=tokens.map((x,i)=>idx.includes(i)?`<span class="w" data-k="${idx.indexOf(i)}">${x.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</span>`:x.includes('\n')?'<br>':' ').join('');},{tokens,idx,rtl});
   const states:State[]=[];const W=idx.length,bound=(k:number)=>Math.min(end,Math.max(start,k<W-1?times![k+1]!.start:end));
   if(style.style==='phrase')states.push({from:start,to:end,lit:key>=0?[key]:[],shown:W,intro:'all'});
   else for(let k=0;k<W;k++){const from=k===0?start:Math.max(start,times[k]!.start),to=bound(k);if(to<=from)continue;
    if(style.style==='karaoke')states.push({from,to,lit:[k],shown:W,intro:k===0?'all':null});
    else if(style.style==='build')states.push({from,to,lit:key>=0&&key<=k?[key]:[],shown:k+1,intro:k});
    else states.push({from,to,lit:key===k?[k]:[],shown:W,only:k,intro:'all'});}
   for(const st of states){
    if(st.from>at)push(list.at(-1)?.file??blank,st.from-at);
    const shot=async(p:number)=>{const file=path.join(dir,`cap-${String(n++).padStart(5,'0')}.png`);
     await page.evaluate(({st,p,reveal})=>{const t=document.getElementById('t')!,spans=[...t.querySelectorAll<HTMLElement>('.w')];
      spans.forEach((s,k)=>{s.classList.toggle('lit',st.lit.includes(k));s.classList.toggle('hide',st.only!==undefined?k!==st.only:k>=st.shown);s.style.transform='';s.style.opacity='';});
      if(st.only!==undefined){t.querySelectorAll('br').forEach(b=>(b as HTMLElement).style.display='none');spans.forEach((s,k)=>{s.style.display=k===st.only?'inline-block':'none';});}
      else{t.querySelectorAll('br').forEach(b=>(b as HTMLElement).style.display='');spans.forEach(s=>{s.style.display='';});}
      const target=st.intro===null?null:st.intro==='all'?t:spans[st.intro as number]!;t.style.transform='';t.style.opacity='';
      if(target&&p<1){const e=1-Math.pow(1-p,3),c=1.70158,b=1+(c+1)*Math.pow(p-1,3)+c*Math.pow(p-1,2);
       target.style.opacity=String(reveal==='pop'?Math.min(1,p*2):e);
       target.style.transform=reveal==='pop'?`scale(${(.55+.45*b).toFixed(3)})`:reveal==='rise'?`translateY(${((1-e)*.45).toFixed(3)}em)`:reveal==='slide'?`translateY(${((1-e)*1.1).toFixed(3)}em)`:'';}},{st,p,reveal:style.reveal});
     await page.screenshot({path:file,omitBackground:true});return file;};
    const frames=st.intro!==null&&K?Math.min(K,Math.floor((st.to-st.from)*fps)-1):0;
    for(let f=0;f<frames;f++)push(await shot((f+1)/(K+1)),1/fps);
    push(await shot(1),Math.max(0,st.to-at));
   }
  }
  if(duration>at)push(blank,duration-at);
  const file=path.join(dir,'captions.txt');
  // FFmpeg's concat reader: each picture and how long it shows; the last is named again to end the track.
  await fs.writeFile(file,list.map(x=>`file '${x.file.replace(/'/g,"'\\''")}'\nduration ${x.dur.toFixed(4)}`).join('\n')+`\nfile '${list.at(-1)!.file.replace(/'/g,"'\\''")}'\n`);
  return {list:file,pictures:n,font,language};
 }finally{await browser.close();}
}
