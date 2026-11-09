// The script writer's two halves around the writing itself (the agent writes; nothing is invented):
//  - research(): reads a link (product page, article) or takes a topic, and pulls out the real
//    facts — the name, what it does, features, numbers, prices, quotations — each with the
//    sentence it came from;
//  - brief(): turns them into a plan for a short video of a target length (beats, lines, words)
//    with the rules a script needs to become good visuals;
//  - checkScript(): checks a written script against the brief before `make`: its length, a hook
//    first and a call to action last, every figure and quotation traceable to a fact, lines short
//    enough for headlines, and what visual the designer will give each line.
import {chromium} from 'playwright';
import {chromiumExecutable,glArgs} from '../renderer/browser-path.js';
import {publicUrl} from '../reach/safety.js';
import {detectLanguage,type Language} from './languages.js';
import {numbersIn,classifyRole,splitSentences,designScenes} from './storyboard.js';

export type Fact={id:string;kind:'name'|'what'|'feature'|'number'|'price'|'quote';text:string;source:string};
export type Research={kind:'url'|'topic';input:string;url?:string;title:string;language:Language;facts:Fact[];notes:string[]};
export type Beat={beat:'hook'|'problem'|'solution'|'proof'|'cta';lines:number;guidance:string};
export type Brief={version:1;research:Research;language:Language;seconds:number;lines:number;words:[number,number];beats:Beat[];rules:string[]};

/** How fast a voice-over speaks, in words a second (Sorani words are longer, so fewer). */
export const SPEECH:Record<string,number>={en:2.6,ckb:2.1,kmr:2.3,badini:2.2,ar:2.2,fa:2.3};
const words=(s:string)=>s.trim().split(/\s+/u).filter(Boolean).length;
const norm=(s:string)=>s.toLowerCase().normalize('NFKC').replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x660)).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-0x6f0)).replace(/[^\p{L}\p{N}%$€£.]+/gu,' ').trim();

type Page={title:string;siteName:string;description:string;headings:string[];items:string[];paragraphs:string[];quotes:string[];product?:{name?:string;description?:string;price?:string;currency?:string}};
/** Reads a public page in a headless browser (pages built by scripts included). */
async function readPage(url:string):Promise<Page>{
 const b=await chromium.launch({headless:true,executablePath:chromiumExecutable(),args:glArgs()});
 try{const p=await b.newPage({userAgent:'Mozilla/5.0 (Dimensaz script research)'});
  await p.goto(url,{waitUntil:'domcontentloaded',timeout:30000});await p.waitForLoadState('networkidle',{timeout:8000}).catch(()=>{});
  await p.evaluate('window.__name=window.__name||(function(f){return f;})');
  return await p.evaluate(()=>{
   const meta=(n:string)=>document.querySelector<HTMLMetaElement>(`meta[property="${n}"],meta[name="${n}"]`)?.content?.trim()??'';
   const clean=(s:string)=>s.replace(/\s+/g,' ').trim();
   // The page's own content, without navigation, footers, cookie notices and scripts.
   const skip='nav,footer,header nav,script,style,noscript,aside,[role="navigation"],[aria-hidden="true"],form,button';
   const inMain=(e:Element)=>!e.closest(skip);
   const texts=(sel:string,min:number,max:number)=>[...document.querySelectorAll(sel)].filter(inMain).map(e=>clean((e as HTMLElement).innerText||e.textContent||'')).filter(t=>t.length>=min&&t.length<=max);
   let product:{name?:string;description?:string;price?:string;currency?:string}|undefined;
   for(const s of document.querySelectorAll('script[type="application/ld+json"]')){try{
    const all=[JSON.parse(s.textContent||'null')].flat().flatMap((x:Record<string,unknown>)=>x?.['@graph']?x['@graph'] as Record<string,unknown>[]:[x]);
    const it=all.find(x=>/Product|SoftwareApplication|Service|Course|Book/.test(String(x?.['@type'])));
    if(it){const o=[it.offers].flat()[0] as Record<string,unknown>|undefined;product={name:it.name as string,description:it.description as string,...(o?.price!==undefined?{price:String(o.price),currency:String(o.priceCurrency??'')}:{})};break;}}catch{/* not JSON */}}
   return {title:clean(meta('og:title')||document.title||''),siteName:meta('og:site_name'),description:meta('og:description')||meta('description'),
    headings:texts('h1,h2,h3',3,140),items:texts('main li,article li,section li,li',3,160).slice(0,80),paragraphs:texts('p',20,900).slice(0,80),
    quotes:texts('blockquote,q,[class*="testimonial"] p,[class*="quote"] p',12,400).slice(0,10),...(product?{product}:{})};
  });
 }finally{await b.close();}
}

/** Sentences of a text (for facts): whole sentences of 4 to 30 words. */
function sentences(t:string){return t.split(/(?<=[.!?؟])\s+|\n+/u).map(s=>s.trim()).filter(s=>words(s)>=3&&words(s)<=30);}

/** The facts a script may use, from a link or a topic. */
export async function research(input:string,o:{language?:Language}={}):Promise<Research>{
 const isUrl=/^https?:\/\//i.test(input.trim())||/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(input.trim());
 if(!isUrl){const language=o.language??detectLanguage(input);
  return {kind:'topic',input,title:input.trim().slice(0,120),language,facts:[],notes:['A topic, not a link: there are no source facts, so the script names no figures, prices, results or quotations. Give a link (a product page, an article) for those.']};}
 const url=publicUrl(input).toString(),page=await readPage(url),facts:Fact[]=[],seen=new Set<string>(),notes:string[]=[];
 // One sentence is one fact, in the most useful kind (a price before a figure before a description).
 const PREFIX:Record<Fact['kind'],string>={name:'name',what:'w',feature:'f',number:'n',price:'p',quote:'q'};
 const add=(kind:Fact['kind'],text:string,source=text)=>{const k=norm(text);if(!k||seen.has(k))return;seen.add(k);facts.push({id:`${PREFIX[kind]}${facts.filter(f=>f.kind===kind).length+1}`,kind,text:text.trim(),source:source.trim()});};
 const credit=/^[—–-]\s*\S/;
 const name=page.product?.name||page.siteName||page.title.split(/\s[|–—-]\s/)[0]||'';
 if(name)add('name',name);
 if(page.product?.price)add('price',`${page.product.currency==='USD'?'$':''}${page.product.price}${page.product.currency&&page.product.currency!=='USD'?' '+page.product.currency:''}`,`Listed price: ${page.product.price} ${page.product.currency??''}`);
 // A quotation keeps who said it (the "— Sara, owner of …" line after it) as its source.
 for(const [i,q] of page.quotes.entries()){if(credit.test(q))continue;const by=page.quotes[i+1]&&credit.test(page.quotes[i+1]!)?' '+page.quotes[i+1]:'';const t=q.replace(/^["“«]|["”»]$/g,'');add('quote',t,t+by);}
 // Prices and figures first, each kept with its whole sentence.
 for(const block of [page.description,...page.headings,...page.items,...page.paragraphs])for(const s of sentences(block)){if(credit.test(s))continue;
  if(/(\$|€|£|USD|EUR|IQD|دینار|دۆلار)\s?\d|\d\s?(\$|€|£|USD|EUR|IQD|دۆلار|دینار)|\/\s?(mo|month|year)\b|per (month|year)|مانگانە|ساڵانە/i.test(s))add('price',s);
  else if(numbersIn(s).length&&!/©|cookie|\b(19|20)\d\d\b(?!\s?%)/.test(s))add('number',s);}
 // What it is: the description and the main heading (its tagline).
 for(const d of [page.product?.description,page.description,page.headings[0]].filter(Boolean) as string[])for(const s of sentences(d))add('what',s);
 // Features: list items (not section titles such as "Why teams switch" or "Pricing").
 for(const t of page.items)if(words(t)>=2&&words(t)<=14&&!credit.test(t)&&!/cookie|privacy|terms|sign in|log in|subscribe|©|all rights/i.test(t))add('feature',t);
 for(const p of page.paragraphs.slice(0,12))for(const s of sentences(p).slice(0,2))if(facts.length<60&&!credit.test(s))add('what',s);
 const language=o.language??detectLanguage([page.title,page.description,...page.paragraphs.slice(0,5)].join(' '));
 if(facts.filter(f=>f.kind!=='name').length<3)notes.push('Little readable text on this page (it may need a login or be mostly images): check the facts, or add a topic.');
 return {kind:'url',input,url,title:page.title||name,language,facts:facts.slice(0,60),notes};
}

/** A plan for a short video of `seconds` from the research. */
export function brief(r:Research,o:{seconds?:number;language?:Language}={}):Brief{
 const seconds=Math.max(10,Math.min(120,o.seconds??30)),language=o.language??r.language,rate=SPEECH[language]??2.4;
 // Sized with the same timing as checkScript and the scene planner: a scene without a voice-over
 // lasts words/2.5 + 0.9 s, with one about words/rate + 0.35 s; the slower of the two decides.
 const lines=Math.max(4,Math.min(12,Math.round(seconds/4.2))),total=Math.round(Math.min((seconds-.9*lines)*2.5,(seconds-.35*lines)*rate));
 const has=(k:Fact['kind'])=>r.facts.some(f=>f.kind===k);
 const proof=has('number')||has('quote')||has('price')?1:0,problem=lines>=7?2:1,solution=Math.max(1,lines-2-proof-problem);
 const beats:Beat[]=[
  {beat:'hook',lines:1,guidance:'The problem, a surprising true figure from the facts, or a sharp question. Short (under 12 words). No greeting, no "in this video".'},
  ...(problem>0?[{beat:'problem' as const,lines:problem,guidance:'What it costs the viewer today: concrete, in their words. A list of three ("X, Y and Z") reads as cards piling up.'}]:[]),
  {beat:'solution',lines:solution,guidance:`What ${r.facts.find(f=>f.kind==='name')?.text??'it'} does, from the facts: name it once ("Meet …"), then a change ("from X to Y", "turns X into Y") and the features as a list of three.`},
  ...(proof?[{beat:'proof' as const,lines:1,guidance:'One figure, price or real quotation from the facts, on its own line (the designer makes it the visual).'}]:[]),
  {beat:'cta',lines:1,guidance:'One call to action with a verb (Try, Start, Download, Book, Visit) and when ("today", "free").'}];
 const rules=[
  'One sentence per line; that line is one scene and its headline.',
  `About ${total} words in all (${Math.round(total*.85)}–${Math.round(total*1.15)}), ${language==='ckb'||language==='ar'||language==='fa'?'5 to 12':'6 to 14'} words a line.`,
  'Use only the facts listed for names, figures, prices, results and quotations, word for word for quotations. Never invent a number, a customer, a review or a superlative ("the best", "#1") that the facts do not support.',
  'Give the designer material: one list of three, one change (from X to Y), and a figure on its own line when the facts have one.',
  language==='ckb'?'Write in Sorani (Central Kurdish) in Arabic script, the way people speak; keep product names as the brand writes them.':language==='en'?'Write in plain spoken English: short words, active verbs, "you".':`Write in ${language}.`,
  'Run `pnpm dimensaz write --check SCRIPT.txt --brief BRIEF.json` and fix what it reports before `make`.'];
 return {version:1,research:r,language,seconds,lines,words:[Math.round(total*.85),Math.round(total*1.15)],beats,rules};
}

export function briefMarkdown(b:Brief){
 const r=b.research,f=(k:Fact['kind'],title:string)=>{const x=r.facts.filter(y=>y.kind===k);return x.length?`\n### ${title}\n\n${x.map(y=>`- **${y.id}** ${y.text}${y.source!==y.text?`  \n  _Source: "${y.source}"_`:''}`).join('\n')}\n`:'';};
 return `# Script brief: ${r.title}

${r.url?`Source: ${r.url}`:`Topic: ${r.input}`} · Language: **${b.language}** · Target: **${b.seconds} s**, **${b.lines} lines**, **${b.words[0]}–${b.words[1]} words**
${r.notes.map(n=>`\n> ${n}`).join('')}

## Plan

| Beat | Lines | What it does |
| --- | --- | --- |
${b.beats.map(x=>`| ${x.beat} | ${x.lines} | ${x.guidance} |`).join('\n')}

## Rules

${b.rules.map(x=>'- '+x).join('\n')}

## Facts you may use
${r.facts.length?f('name','Name')+f('what','What it is')+f('feature','Features')+f('number','Figures (with their sentence)')+f('price','Prices')+f('quote','Quotations (word for word)'):'\nNone: the script names no figures, prices, results or quotations.\n'}`;
}

export type ScriptIssue={severity:'hard'|'soft';line?:number;detail:string};
export type ScriptCheck={passed:boolean;issues:ScriptIssue[];seconds:{voice:number;silent:number;target?:number};words:number;
 lines:{n:number;text:string;words:number;role:string;visual:string}[]};

/** Checks a written script (one sentence a line) against its brief, before `make`. */
export function checkScript(text:string,b?:Brief,o:{seconds?:number;language?:Language}={}):ScriptCheck{
 const lines=splitSentences(text),issues:ScriptIssue[]=[];
 const language=o.language??b?.language??detectLanguage(text),rate=SPEECH[language]??2.4,target=o.seconds??b?.seconds;
 if(!lines.length)return {passed:false,issues:[{severity:'hard',detail:'The script is empty'}],seconds:{voice:0,silent:0,...(target?{target}:{})},words:0,lines:[]};
 const total=lines.reduce((n,l)=>n+words(l),0);
 // Length: as spoken by a voice-over, and as scenes without one (the scene planner's timing).
 const voice=total/rate+lines.length*.35,silent=lines.reduce((s,l)=>s+Math.max(2.4,words(l)/2.5+.9),0);
 if(target){const len=Math.max(voice,silent);if(len>target*1.3)issues.push({severity:'hard',detail:`About ${Math.round(len)} s, longer than the ${target} s target: cut ${Math.round((len-target)*rate)} words or a line`});
  else if(len<target*.7)issues.push({severity:'soft',detail:`About ${Math.round(len)} s, shorter than the ${target} s target`});}
 // Hook first, call to action last.
 const first=lines[0]!;
 if(/^(hi|hello|hey|welcome|in this video|today we|today i|سڵاو|بەخێربێن|مرحبا|أهلا|سلام)\b/i.test(first.trim()))issues.push({severity:'hard',line:1,detail:'The first line greets instead of hooking: open with the problem, a true figure or a question'});
 if(words(first)>14)issues.push({severity:'soft',line:1,detail:`The hook has ${words(first)} words: under 12 keeps it sharp`});
 const lastRole=classifyRole(lines.at(-1)!,lines.length-1,lines.length);
 if(lines.length>1&&lastRole!=='cta'&&lastRole!=='download')issues.push({severity:'hard',line:lines.length,detail:'The last line is not a call to action: end with a verb the viewer can act on (Try, Start, Download, Book, Visit)'});
 // Every figure and quotation must come from the facts.
 const facts=b?.research.facts??[],pool=facts.map(f=>norm(f.text+' '+f.source)).join(' | ')+' | '+norm(b?.research.input??'');
 const values=new Set(facts.flatMap(f=>numbersIn(f.text+' '+f.source).map(n=>n.value)));for(const n of numbersIn(b?.research.input??''))values.add(n.value);
 lines.forEach((l,i)=>{
  for(const n of numbersIn(l)){const small=!n.prefix&&!n.suffix&&n.value<=3;if(small||values.has(n.value))continue;
   issues.push({severity:'hard',line:i+1,detail:`"${(n.prefix??'')+n.value+(n.suffix??'')}" is not in the facts: use a figure from the brief, or none`});}
  for(const m of l.matchAll(/["“«]([^"“”«»]{4,})["”»]/g)){if(!pool.includes(norm(m[1]!)))issues.push({severity:'hard',line:i+1,detail:`The quotation "${m[1]!.slice(0,60)}" is not word for word in the facts`});}
  if(/\b(the best|best in the world|#1|number one|world'?s first|guaranteed)\b/i.test(l)&&!pool.includes(norm(l.match(/\b(the best|best in the world|#1|number one|world'?s first|guaranteed)\b/i)![0])))
   issues.push({severity:'hard',line:i+1,detail:'A superlative or guarantee the facts do not support'});
  const w=words(l),max=language==='ckb'||language==='ar'||language==='fa'?13:15;
  if(w>max)issues.push({severity:'soft',line:i+1,detail:`${w} words: a headline reads best under ${max}; split it into two lines`});
 });
 // What the designer will make of each line, and whether the visuals will vary.
 const plans=designScenes(lines,{seed:'check'}),plain=plans.filter(p=>['statement','burst'].includes(p.piece.designed?.archetype??'')).length;
 if(lines.length>=4&&plain>lines.length/2)issues.push({severity:'soft',detail:`${plain} of ${lines.length} lines get a plain statement visual: add a list of three, a change ("from X to Y") or a figure for richer visuals`});
 return {passed:!issues.some(x=>x.severity==='hard'),issues,seconds:{voice:Number(voice.toFixed(1)),silent:Number(silent.toFixed(1)),...(target?{target}:{})},words:total,
  lines:plans.map(p=>({n:p.index+1,text:p.sentence,words:words(p.sentence),role:p.role,visual:p.piece.designed?.archetype??'composed'}))};
}
