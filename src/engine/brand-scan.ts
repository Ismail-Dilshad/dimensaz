// Reads a product's website and pulls out what a video needs from its brand: name, tagline,
// logo candidates, theme colour, the colours its CSS actually uses (ranked), and font
// families (including Google Fonts). Evidence for the production design, not a guarantee:
// the agent confirms the result by looking at the site and the logo.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT} from './config.js';

export type BrandScan={url:string;scannedAt:string;name:string|null;title:string|null;description:string|null;themeColor:string|null;
 colors:{hex:string;count:number;sources:string[]}[];accentCandidates:string[];fonts:{family:string;source:string}[];
 logos:{url:string;kind:string;saved?:string}[];socialImage:string|null;stylesheets:string[];notes:string[]};

const MAX_CSS=6,MAX_BYTES=2_000_000;
const UA='Dimensaz brand scan (video production research)';

function absolute(base:string,ref:string){try{return new URL(ref,base).toString();}catch{return null;}}
function attr(tag:string,name:string){const m=new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`,'i').exec(tag);return m?(m[2]??m[3]??m[4]??'').trim():null;}
function decode(s:string){return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');}

export function normalizeHex(value:string):string|null{
 let v=value.trim().toLowerCase();
 const rgb=/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v);
 if(rgb){if(rgb[4]&&parseFloat(rgb[4])<(rgb[4].endsWith('%')?50:.5))return null;return '#'+[rgb[1],rgb[2],rgb[3]].map(n=>Math.min(255,+n).toString(16).padStart(2,'0')).join('').toUpperCase();}
 if(!v.startsWith('#'))return null;v=v.slice(1);
 if(v.length===3||v.length===4)v=[...v.slice(0,3)].map(c=>c+c).join('');
 else if(v.length===8)v=v.slice(0,6);
 return /^[0-9a-f]{6}$/.test(v)?'#'+v.toUpperCase():null;
}
const channels=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
export function saturation(hex:string){const [r,g,b]=channels(hex);const hi=Math.max(r,g,b),lo=Math.min(r,g,b);return hi===0?0:(hi-lo)/hi;}
const lightness=(hex:string)=>{const [r,g,b]=channels(hex);return (Math.max(r,g,b)+Math.min(r,g,b))/510;};

/** Colours used in CSS, ranked by use; CSS custom properties named like brand/primary weigh more. */
export function cssColors(css:string,source:string,into=new Map<string,{count:number;sources:Set<string>}>()){
 const add=(hex:string|null,weight:number)=>{if(!hex)return;const e=into.get(hex)??{count:0,sources:new Set<string>()};e.count+=weight;e.sources.add(source);into.set(hex,e);};
 for(const m of css.matchAll(/--([\w-]*(?:brand|primary|accent|main|theme)[\w-]*)\s*:\s*([^;}{]+)/gi))add(normalizeHex(m[2]),5);
 for(const m of css.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi))add(normalizeHex(m[0]),1);
 return into;
}

export function cssFonts(css:string,source:string){
 const out:{family:string;source:string}[]=[];
 const generic=new Set(['sans-serif','serif','monospace','system-ui','inherit','initial','cursive','-apple-system','blinkmacsystemfont','ui-sans-serif','ui-serif','ui-monospace','emoji','var']);
 for(const m of css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)){
  for(const part of m[1].split(',')){const f=part.trim().replace(/^["']|["']$/g,'').replace(/!important/,'').trim();
   if(f&&!generic.has(f.toLowerCase())&&!f.startsWith('var(')&&f.length<60)out.push({family:f,source});}
 }
 return out;
}

async function get(url:string,fetcher:typeof fetch){
 const r=await fetcher(url,{headers:{'user-agent':UA,accept:'text/html,text/css,*/*'},redirect:'follow'});
 if(!r.ok)throw new Error(`${url} answered ${r.status}`);
 const buf=Buffer.from(await r.arrayBuffer());if(buf.length>MAX_BYTES)throw new Error(url+' is larger than 2 MB');
 return {text:buf.toString('utf8'),bytes:buf,type:r.headers.get('content-type')??'',url:r.url||url};
}

export async function scanBrand(url:string,o:{fetcher?:typeof fetch;download?:boolean;outDir?:string}={}):Promise<BrandScan&{folder?:string}>{
 const fetcher=o.fetcher??fetch;const notes:string[]=[];
 const page=await get(url,fetcher);const html=page.text,base=page.url;
 const tags=[...html.matchAll(/<(meta|link|img|svg|style)\b[^>]*>/gi)].map(m=>m[0]);
 const meta=(key:string)=>{for(const t of tags.filter(t=>/^<meta/i.test(t))){const k=(attr(t,'property')??attr(t,'name')??'').toLowerCase();if(k===key)return decode(attr(t,'content')??'');}return null;};
 const title=decode((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]??'').trim())||null;
 const name=meta('og:site_name')??meta('application-name')??(title?title.split(/\s[|–—-]\s/)[0].trim():null);
 const themeColor=normalizeHex(meta('theme-color')??'');
 const logos:BrandScan['logos']=[];const seen=new Set<string>();
 const addLogo=(ref:string|null,kind:string)=>{const u=ref&&absolute(base,decode(ref));if(u&&!seen.has(u)){seen.add(u);logos.push({url:u,kind});}};
 for(const t of tags){
  if(/^<img/i.test(t)){const hint=[attr(t,'alt'),attr(t,'class'),attr(t,'id'),attr(t,'src')].join(' ').toLowerCase();if(/logo|brand|wordmark/.test(hint))addLogo(attr(t,'src'),'img');}
  if(/^<link/i.test(t)){const rel=(attr(t,'rel')??'').toLowerCase();if(/icon|apple-touch|mask-icon/.test(rel))addLogo(attr(t,'href'),rel.includes('apple')?'apple-touch-icon':rel.includes('mask')?'mask-icon':'icon');}
 }
 const inlineSvg=[...html.matchAll(/<svg\b[^>]*(?:logo|brand)[^>]*>[\s\S]*?<\/svg>/gi)].map(m=>m[0]).slice(0,2);
 const socialImage=meta('og:image')?absolute(base,meta('og:image')!):null;
 // Stylesheets: inline <style>, linked CSS (first few) and Google Fonts families.
 const colorMap=new Map<string,{count:number;sources:Set<string>}>();const fonts:BrandScan['fonts']=[];
 for(const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)){cssColors(m[1],'inline',colorMap);fonts.push(...cssFonts(m[1],'inline'));}
 for(const m of html.matchAll(/style\s*=\s*"([^"]*)"/gi))cssColors(m[1],'style attribute',colorMap);
 const sheets=tags.filter(t=>/^<link/i.test(t)&&/stylesheet/i.test(attr(t,'rel')??'')).map(t=>absolute(base,decode(attr(t,'href')??''))).filter((u):u is string=>!!u);
 for(const sheet of sheets){
  const g=/fonts\.googleapis\.com\/css2?\?(.*)$/.exec(sheet);
  if(g){for(const f of new URLSearchParams(g[1]).getAll('family'))fonts.push({family:f.split(':')[0].replace(/\+/g,' '),source:'Google Fonts'});continue;}
 }
 for(const sheet of sheets.filter(s=>!/fonts\.googleapis/.test(s)).slice(0,MAX_CSS)){
  try{const css=(await get(sheet,fetcher)).text;cssColors(css,new URL(sheet).pathname.split('/').pop()||sheet,colorMap);fonts.push(...cssFonts(css,new URL(sheet).pathname.split('/').pop()||sheet));}
  catch(e){notes.push('Stylesheet not read: '+String(e).slice(0,120));}
 }
 if(sheets.length>MAX_CSS)notes.push(`Read the first ${MAX_CSS} of ${sheets.length} stylesheets.`);
 const colors=[...colorMap.entries()].map(([hex,e])=>({hex,count:e.count,sources:[...e.sources].slice(0,4)})).sort((a,b)=>b.count-a.count).slice(0,16);
 const accentCandidates=[...(themeColor?[themeColor]:[]),...colors.filter(c=>saturation(c.hex)>.35&&lightness(c.hex)>.15&&lightness(c.hex)<.85).map(c=>c.hex)].filter((v,i,a)=>a.indexOf(v)===i).slice(0,5);
 const fontList=Object.values(Object.fromEntries(fonts.map(f=>[f.family.toLowerCase(),f]))).slice(0,8);
 if(!logos.some(l=>l.kind==='img')&&!inlineSvg.length)notes.push('No image marked as a logo; check the header by eye or ask the user for the logo file.');
 if(!colors.length)notes.push('No CSS colours found (the site may build styles with JavaScript); pick colours from the logo and screenshots.');
 const result:BrandScan={url:base,scannedAt:new Date().toISOString(),name,title,description:meta('og:description')??meta('description'),themeColor,colors,accentCandidates,fonts:fontList,logos,socialImage,stylesheets:sheets,notes};
 if(!o.download)return result;
 const host=new URL(base).hostname.replace(/^www\./,'');
 let folder=o.outDir??path.join(ROOT,process.env.VIDEO_WORKSPACE||'workspace','research',host);
 for(let i=2;await fs.access(folder).then(()=>true,()=>false);i++)folder=(o.outDir??path.join(ROOT,process.env.VIDEO_WORKSPACE||'workspace','research',host))+'-'+i;
 await fs.mkdir(folder,{recursive:true});
 for(const [i,svg] of inlineSvg.entries()){const file=path.join(folder,`logo-inline-${i+1}.svg`);await fs.writeFile(file,svg);logos.push({url:base,kind:'inline-svg',saved:file});}
 for(const logo of [...logos.filter(l=>!l.saved),...(socialImage?[{url:socialImage,kind:'og-image'}]:[])].slice(0,8)){
  try{const r=await get(logo.url,fetcher);const ext=/svg/.test(r.type)?'.svg':/png/.test(r.type)?'.png':/jpe?g/.test(r.type)?'.jpg':/webp/.test(r.type)?'.webp':/icon/.test(r.type)?'.ico':path.extname(new URL(logo.url).pathname)||'.bin';
   const file=path.join(folder,`${logo.kind}-${createHash('sha256').update(r.bytes).digest('hex').slice(0,8)}${ext}`);await fs.writeFile(file,r.bytes);
   const entry=logos.find(l=>l.url===logo.url&&l.kind===logo.kind);if(entry)entry.saved=file;else logos.push({...logo,saved:file});}
  catch(e){notes.push('Not downloaded: '+logo.url+' ('+String(e).slice(0,80)+')');}
 }
 await fs.writeFile(path.join(folder,'brand-scan.json'),JSON.stringify(result,null,1)+'\n');
 return {...result,folder};
}
