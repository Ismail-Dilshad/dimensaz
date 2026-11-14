// The script doctor: every line of a script scored before any video is made, for its job (the
// hook first, the call to action last), its clarity and how long it takes to say, with the reason
// and what to change. Every figure, price, date, quotation and claim is checked against its
// source. The agent (or any AI) writes better versions of weak lines as suggestions; the user keeps
// or declines each one, and a kept one replaces the line in the script. Nothing is rewritten
// silently, and a script the user wrote is only ever changed by the user's own "keep".
import fs from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {checkScript,SPEECH,type Brief} from './script-writer.js';
import {numbersIn,splitSentences,classifyRole} from './storyboard.js';
import {detectLanguage,type Language} from './languages.js';

export type Verdict='strong'|'ok'|'weak';
export type Claim={text:string;kind:'number'|'price'|'date'|'quote'|'claim';status:'sourced'|'unsourced'|'doubtful';source?:string};
export type Suggestion={id:string;line:number;was:string;text:string;why:string;by:string;at:string;status:'open'|'kept'|'declined'};
export type Source={line:number;claim:string;url:string;note:string;by:string;at:string};
export type DoctorLine={n:number;text:string;words:number;seconds:number;role:string;job:'hook'|'cta'|'body';score:number;verdict:Verdict;
 notes:{what:string;fix:string}[];claims:Claim[];suggestions:Suggestion[]};
export type Doctor={language:Language;score:number;verdict:Verdict;seconds:{spoken:number;target:number|null};lines:DoctorLine[];
 weak:number[];unsourced:{line:number;claim:string}[];issues:{severity:'hard'|'soft';line?:number;detail:string}[];answered:boolean};

const words=(s:string)=>s.trim().split(/\s+/u).filter(Boolean);
const toAscii=(s:string)=>s.replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x660)).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-0x6f0));
const norm=(s:string)=>toAscii(s).toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}%$€£.]+/gu,' ').trim();
const RTL=new Set(['ckb','ar','fa','badini','kmr']);
/** Words that weaken a line without adding meaning. */
const FILLER:Record<string,RegExp>={en:/\b(very|really|basically|actually|just|simply|literally|totally|things?|stuff|kind of|sort of|in order to)\b/gi,
 ckb:/(زۆر زۆر|بە ڕاستی|بە گشتی|شتێک)/g,ar:/(حقا|فعلا|بشكل أساسي|نوعا ما)/g,fa:/(واقعا|اساسا|یه جورایی)/g};
const GREETING=/^(hi|hello|hey|welcome|in this video|today we|today i|so,? |سڵاو|بەخێربێن|مرحبا|أهلا|سلام|درود)/i;
const HOOK_GOOD=/^(why|how|what|stop|don'?t|never|you|your|imagine|this|\d|[$€£]|did you|لەبەرچی|چۆن|چی|بۆچی|ئایا|لماذا|كيف|هل|چرا|چطور)/i;
const CTA=/^(try|start|download|book|visit|get|join|order|sign up|follow|call|buy|shop|grab|tap|click|see|learn|watch|come|بیبینە|داونلۆد|سەردان|تاقی|بەشداربە|جرب|احجز|زر|اشترك|ابدأ|امتحان|دانلود|ببین)/i;
/** Claims that need a source: superlatives, firsts, guarantees, results and studies. */
const CLAIM=/\b(the best|#1|number one|first|only|fastest|cheapest|leading|proven|guaranteed?|clinically|scientifically|studies show|research shows|award[- ]winning|most popular|100% )\b|باشترین|یەکەمین|تەنها|خێراترین|زانستی|أفضل|الأول|الوحيد|الأسرع|مضمون|بهترین|اولین|تنها|سریع‌ترین/i;
/** Figures in a line: a price, a percentage, a multiple, or a plain number ("2 minutes" is 2, not 2 million). */
function figures(line:string){
 const out:{value:number;shown:string;price:boolean;unit:string}[]=[];
 for(const m of toAscii(line).matchAll(/([$€£])?\s?(\d+(?:[.,]\d+)*)\s?(%|percent\b|x\b|×|k(?![a-z])|m(?![a-z])|\+)?/gi)){
  const raw=m[2]!,value=Number(raw.includes('.')&&!raw.includes(',')?raw:raw.replace(/,/g,''));if(!Number.isFinite(value))continue;
  const unit=(m[3]??'').toLowerCase().replace('percent','%');out.push({value,shown:(m[1]??'')+raw+(unit==='m'?'M':unit),price:!!m[1],unit});
 }
 return out;
}
const PASSIVE=/\b(is|are|was|were|been|being|be)\s+\w+(ed|en)\b/i;

export function doctorFile(script:string){return script+'.doctor.json';}
const sideSchema=z.object({suggestions:z.array(z.object({id:z.string(),line:z.number(),was:z.string(),text:z.string(),why:z.string(),by:z.string(),at:z.string(),status:z.enum(['open','kept','declined'])})).default([]),
 sources:z.array(z.object({line:z.number(),claim:z.string(),url:z.string(),note:z.string(),by:z.string(),at:z.string()})).default([]),
 accepted:z.string().optional()});
type Side=z.infer<typeof sideSchema>;
export function readSide(script:string):Side{try{return sideSchema.parse(JSON.parse(fs.readFileSync(doctorFile(script),'utf8')));}catch{return {suggestions:[],sources:[]};}}
function writeSide(script:string,s:Side){fs.writeFileSync(doctorFile(script),JSON.stringify(s,null,1)+'\n');}

/** Scores every line of a script. With a brief, figures and quotations are traced to its facts. */
export function doctor(text:string,o:{brief?:Brief;seconds?:number;language?:Language;side?:Side}={}):Doctor{
 const lines=splitSentences(text),language=o.language??o.brief?.language??detectLanguage(text),rate=SPEECH[language]??2.4,side=o.side??{suggestions:[],sources:[]};
 const max=RTL.has(language)?13:15,check=checkScript(text,o.brief,{...(o.seconds?{seconds:o.seconds}:{}),language});
 const facts=o.brief?.research.facts??[],pool=facts.map(f=>norm(f.text+' '+f.source)).join(' | ')+' | '+norm(o.brief?.research.input??'');
 const factValues=new Map<number,string>();for(const f of facts)for(const n of numbersIn(f.text+' '+f.source))factValues.set(n.value,o.brief?.research.url??f.source.slice(0,140));
 const out:DoctorLine[]=lines.map((line,i)=>{
  const w=words(line),notes:{what:string;fix:string}[]=[],claims:Claim[]=[];let score=100;
  const job=i===0&&lines.length>1?'hook':i===lines.length-1&&lines.length>1?'cta':'body';
  const seconds=Number((w.length/rate+.35).toFixed(1));
  // Length when spoken.
  if(w.length>max){score-=Math.min(35,(w.length-max)*5);notes.push({what:`${w.length} words, about ${seconds} s to say`,fix:`Split it in two, or cut to ${max} words or fewer`});}
  // The line's job.
  if(job==='hook'){
   if(GREETING.test(line.trim())){score-=45;notes.push({what:'It greets instead of hooking',fix:'Open with the problem, a true figure or a question'});}
   else if(!HOOK_GOOD.test(line.trim())&&!numbersIn(line).length){score-=15;notes.push({what:'The opening is a statement',fix:'Start with a question, a number, "you", or a sharp contrast'});}
   if(w.length>12){score-=10;notes.push({what:'A long hook',fix:'Under 12 words stops the scroll'});}
  }
  if(job==='cta'&&!CTA.test(line.trim())&&!['cta','download'].includes(classifyRole(line,i,lines.length))){score-=30;notes.push({what:'The last line asks nothing of the viewer',fix:'End with a verb they can act on: Try, Start, Book, Visit'});}
  // Clarity.
  const fill=[...line.matchAll(FILLER[language]??FILLER.en!)].map(m=>m[0]);
  if(fill.length){score-=Math.min(20,fill.length*8);notes.push({what:`Filler: ${[...new Set(fill.map(f=>f.toLowerCase()))].join(', ')}`,fix:'Cut them; the line gets stronger'});}
  const commas=(line.match(/[,،;]/g)??[]).length;if(commas>=2){score-=12;notes.push({what:`${commas+1} clauses in one line`,fix:'One idea a line reads better on screen'});}
  if(language==='en'&&PASSIVE.test(line)){score-=8;notes.push({what:'Passive voice',fix:'Say who does it: "We ship it in a day", not "It is shipped"'});}
  if(language==='en'){const long=w.filter(x=>x.replace(/[^\p{L}]/gu,'').length>=12);if(long.length){score-=Math.min(12,long.length*6);notes.push({what:`Long words: ${long.slice(0,3).join(', ')}`,fix:'Use the word you would say out loud'});}}
  if(/\(|\)|\.\.\.|…/.test(line)){score-=6;notes.push({what:'Brackets or trailing dots',fix:'A voice cannot say them; rewrite as a plain sentence'});}
  if(i>0&&words(lines[i-1]!)[0]?.toLowerCase()===w[0]?.toLowerCase()&&w.length>2){score-=6;notes.push({what:`Starts like the line before ("${w[0]}")`,fix:'Vary how lines start'});}
  // Facts: every figure, price, date, quotation and claim needs a source.
  const own=side.sources.filter(s=>s.line===i+1);
  const sourced=(claim:string)=>own.find(s=>norm(s.claim)===norm(claim));
  for(const n of figures(line)){
   const year=!n.price&&!n.unit&&n.value>=1900&&n.value<=2100&&Number.isInteger(n.value);
   if(!n.price&&!n.unit&&n.value<=3)continue;
   const kind:Claim['kind']=n.price?'price':year?'date':'number',src=factValues.get(n.value)??sourced(n.shown)?.url;
   claims.push({text:n.shown,kind,status:src?'sourced':'unsourced',...(src?{source:src}:{})});
  }
  for(const m of line.matchAll(/["“«]([^"“”«»]{4,})["”»]/g)){const ok=pool.includes(norm(m[1]!)),src=sourced(m[1]!)?.url;claims.push({text:m[1]!.slice(0,80),kind:'quote',status:ok||src?'sourced':'unsourced',...(src?{source:src}:{})});}
  for(const said of new Set([...line.matchAll(new RegExp(CLAIM.source,'giu'))].map(m=>m[0].trim().toLowerCase()))){if([...said].length<2)continue;
   const src=sourced(said)?.url??(pool.includes(norm(said))?o.brief?.research.url??'the brief':undefined);claims.push({text:said,kind:'claim',status:src?'sourced':'doubtful',...(src?{source:src}:{})});}
  const missing=claims.filter(x=>x.status!=='sourced');
  if(missing.length){score-=Math.min(40,missing.length*20);notes.push({what:`No source for ${missing.map(x=>`"${x.text}"`).join(', ')}`,fix:'Use a figure from the brief, add its source, or take it out'});}
  score=Math.max(0,Math.round(score));
  return {n:i+1,text:line,words:w.length,seconds,role:classifyRole(line,i,lines.length),job,score,verdict:score>=80?'strong':score>=60?'ok':'weak',notes,claims,
   suggestions:side.suggestions.filter(s=>s.line===i+1&&s.status==='open'&&s.was===line)};
 });
 const spoken=Number(out.reduce((a,l)=>a+l.seconds,0).toFixed(1)),score=out.length?Math.round(out.reduce((a,l)=>a+l.score,0)/out.length):0;
 const weak=out.filter(l=>l.verdict==='weak').map(l=>l.n),unsourced=out.flatMap(l=>l.claims.filter(c=>c.status!=='sourced').map(c=>({line:l.n,claim:c.text})));
 return {language,score,verdict:score>=80?'strong':score>=60?'ok':'weak',seconds:{spoken,target:o.seconds??o.brief?.seconds??null},lines:out,weak,unsourced,
  issues:check.issues.filter(x=>!x.line),answered:!weak.length&&!unsourced.length||!!side.accepted};
}

/** Reads a script file and its brief (brief.json beside it, when there is one). */
export function doctorScript(file:string,o:{seconds?:number;brief?:string}={}){
 const text=fs.readFileSync(file,'utf8'),briefFile=o.brief??path.join(path.dirname(file),'brief.json');
 let brief:Brief|undefined;try{brief=JSON.parse(fs.readFileSync(briefFile,'utf8')) as Brief;}catch{/* no brief: a topic or the user's own script */}
 return doctor(text,{...(brief?{brief}:{}),...(o.seconds?{seconds:o.seconds}:{}),side:readSide(file)});
}
const lineOf=(file:string,n:number)=>{const l=splitSentences(fs.readFileSync(file,'utf8'))[n-1];if(!l)throw new Error(`The script has no line ${n}`);return l;};
/** A better version of one line, from the agent or any AI, for the user to keep or decline. */
export function suggest(file:string,n:number,text:string,o:{why?:string;by?:string}={}){
 const was=lineOf(file,n),t=text.trim().replace(/\s+/g,' ');if(t.length<2)throw new Error('Give the new line');if(t===was)throw new Error('That is the same line');
 const side=readSide(file);for(const s of side.suggestions)if(s.line===n&&s.status==='open'&&s.was===was&&s.text===t)throw new Error('That suggestion is already there');
 const s:Suggestion={id:'s'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),line:n,was,text:t,why:(o.why??'').trim().slice(0,200),by:o.by??'agent',at:new Date().toISOString(),status:'open'};
 side.suggestions.push(s);writeSide(file,side);return s;
}
/** The user keeps a suggestion: the line is replaced in the script, word for word. */
export function keep(file:string,id:string){
 const side=readSide(file),s=side.suggestions.find(x=>x.id===id);if(!s)throw new Error('No such suggestion');if(s.status!=='open')throw new Error('That suggestion was already '+s.status);
 const text=fs.readFileSync(file,'utf8');if(!text.includes(s.was)){s.status='declined';writeSide(file,side);throw new Error('That line has changed since; the suggestion no longer fits');}
 fs.writeFileSync(file,text.replace(s.was,s.text));s.status='kept';
 // Other suggestions for the same line are now for a line that is gone.
 for(const o of side.suggestions)if(o!==s&&o.status==='open'&&o.was===s.was)o.status='declined';
 writeSide(file,side);return {kept:s.text,line:s.line};
}
export function decline(file:string,id:string){const side=readSide(file),s=side.suggestions.find(x=>x.id===id);if(!s)throw new Error('No such suggestion');s.status='declined';writeSide(file,side);return {declined:id};}
/** A source for a figure or claim on a line: the page it comes from. */
export function addSource(file:string,n:number,claim:string,url:string,o:{note?:string;by?:string}={}){
 lineOf(file,n);if(!/^https?:\/\/\S+$/i.test(url.trim()))throw new Error('The source is a link (https://...)');
 const side=readSide(file);side.sources=side.sources.filter(s=>!(s.line===n&&norm(s.claim)===norm(claim)));
 side.sources.push({line:n,claim:claim.trim(),url:url.trim(),note:(o.note??'').trim().slice(0,200),by:o.by??'agent',at:new Date().toISOString()});writeSide(file,side);return {line:n,claim,url};
}
/** The weak lines stay as they are, for a reason the user gave (or the brief asks for). */
export function acceptAsIs(file:string,why:string){if(why.trim().length<4)throw new Error('Say why the script stays as it is');const side=readSide(file);side.accepted=why.trim().slice(0,300);writeSide(file,side);return {accepted:side.accepted};}
