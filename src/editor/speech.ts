// What is said in footage, read as text: its sentences, the lines said more than once (takes) and
// which take is strongest, and the moments that would open the video best (hooks). Every finding
// says why, in words, so the user can disagree. Nothing here cuts anything.
import type {Word} from '../engine/transcribe.js';
import type {Language} from '../engine/languages.js';
import {fillers} from './tighten.js';
import {normalizeWord} from './caption-builder.js';

export type Spoken={i:number;text:string;start:number;end:number;logprob?:number;filler?:boolean};
export type Sentence={n:number;from:number;to:number;start:number;end:number;text:string};

/** The spoken words, numbered, with the fillers marked. */
export function spokenWords(words:Word[],language:Language,extra:string[]=[]):Spoken[]{
 const list=new Set([...(fillers[language]??[]),...(language!=='en'?fillers.en:[]),...extra].map(normalizeWord));
 return words.filter(w=>w.type==='word'&&w.text.trim()).map((w,i)=>({i,text:w.text.trim(),start:w.start,end:w.end,...(w.logprob!==undefined?{logprob:w.logprob}:{}),...(list.has(normalizeWord(w.text))?{filler:true}:{})}));
}
/** Sentences: at the end of a sentence mark, or where the speaker stops for more than `pause` seconds. */
export function sentencesOf(words:Spoken[],pause=.9):Sentence[]{
 const out:Sentence[]=[];let from=0;
 const close=(to:number)=>{if(to<=from)return;const ws=words.slice(from,to);out.push({n:out.length+1,from,to,start:ws[0]!.start,end:ws.at(-1)!.end,text:ws.map(w=>w.text).join(' ')});from=to;};
 for(let k=0;k<words.length;k++){
  if(k>from&&words[k]!.start-words[k-1]!.end>pause)close(k);
  if(/[.!?؟…]["'”»)]*$/u.test(words[k]!.text))close(k+1);
 }
 close(words.length);
 // A restart inside a sentence ("Most people brew it the Most people brew it the wrong way") is two
 // takes: split where its first three words come again.
 const norm=(w:Spoken)=>normalizeWord(w.text);
 return out.flatMap(s=>{const parts:Sentence[]=[];let a=s.from;
  // The next three words from a place, fillers skipped ("Most people um brew" restarts "Most people brew").
  const three=(i:number)=>{const o:string[]=[];for(let j=i;j<s.to&&o.length<3;j++)if(!words[j]!.filler)o.push(norm(words[j]!));return o;};
  for(let k=s.from+2;k+2<s.to;k++){const head=three(a),here=three(k);
   if(k-a>=2&&!words[k]!.filler&&here.length===3&&head.every((h,i)=>h===here[i])){parts.push({n:0,from:a,to:k,start:words[a]!.start,end:words[k-1]!.end,text:words.slice(a,k).map(w=>w.text).join(' ')});a=k;}}
  parts.push({n:0,from:a,to:s.to,start:words[a]!.start,end:words[s.to-1]!.end,text:words.slice(a,s.to).map(w=>w.text).join(' ')});return parts;}).map((s,i)=>({...s,n:i+1}));
}

const STOP=new Set(['the','a','an','and','or','to','of','in','on','is','it','i','so','um','uh','that','this','we','you','for','with','be','are','was']);
const tokens=(s:string)=>s.toLowerCase().normalize('NFKC').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const content=(s:string)=>tokens(s).filter(t=>!STOP.has(t));

export type Take={sentence:number;score:number;notes:string[]};
export type TakeGroup={id:string;sentences:number[];best:number;why:string;takes:Take[]};
/** Lines said again: neighbouring sentences (within 30 s) that start alike and share most of their
 *  words. In each group the strongest take is kept, with the reason; the others are cut. */
export function findTakes(sentences:Sentence[],words:Spoken[]):TakeGroup[]{
 const same=(a:Sentence,b:Sentence)=>{
  const A=content(a.text),B=content(b.text);if(A.length<2||B.length<2)return false;
  const head=(x:string[])=>x.slice(0,3).join(' '),overlap=A.filter(t=>B.includes(t)).length/Math.min(A.length,B.length);
  const ta=tokens(a.text),tb=tokens(b.text),start=ta.slice(0,3).filter((t,i)=>tb[i]===t).length>=2||head(A)===head(B);
  return overlap>=.6&&(start||overlap>=.8);};
 const groups:number[][]=[];
 for(let i=0;i<sentences.length;i++){
  const g=groups.find(x=>x.includes(i));if(g)continue;
  const members=[i];
  for(let j=i+1;j<sentences.length&&j<=members.at(-1)!+3;j++){if(sentences[j]!.start-sentences[members.at(-1)!]!.end>30)break;if(same(sentences[members.at(-1)!]!,sentences[j]!)||same(sentences[i]!,sentences[j]!))members.push(j);}
  if(members.length>1)groups.push(members);
 }
 return groups.map((g,k)=>{
  const all=new Set(g.flatMap(i=>content(sentences[i]!.text)));
  const takes=g.map((i,pos)=>{const s=sentences[i]!,ws=words.slice(s.from,s.to),notes:string[]=[];let score=0;
   const complete=/[.!?؟…]["'”»)]*$/u.test(ws.at(-1)!.text)&&!ws.at(-1)!.filler;
   if(complete){score+=2;}else notes.push('stops mid-sentence');
   const f=ws.filter(w=>w.filler).length;if(f){score-=f;notes.push(`${f} filler${f>1?'s':''}`);}
   const gaps=ws.slice(1).filter((w,j)=>w.start-ws[j]!.end>.6).length;if(gaps){score-=.7*gaps;notes.push(`${gaps} long pause${gaps>1?'s':''}`);}
   const repeats=ws.slice(1).filter((w,j)=>normalizeWord(w.text)===normalizeWord(ws[j]!.text)&&!w.filler).length;if(repeats){score-=repeats;notes.push(`${repeats} stumble${repeats>1?'s':''}`);}
   const cover=content(s.text).filter(t=>all.has(t)).length/Math.max(1,all.size);score+=2*cover;if(cover<.75)notes.push('leaves words out');
   const probs=ws.map(w=>w.logprob).filter((x):x is number=>x!==undefined);if(probs.length){const m=probs.reduce((a,b)=>a+b,0)/probs.length;score+=Math.max(-1,m);if(m<-.6)notes.push('unclear');}
   if(pos===g.length-1)score+=.3; // people usually say it again until it is right
   return {sentence:s.n,score:+score.toFixed(2),notes};});
  const best=takes.reduce((a,b)=>b.score>=a.score?b:a),others=takes.filter(t=>t!==best);
  const why=`Take ${takes.indexOf(best)+1} of ${takes.length} kept: ${best.notes.length?best.notes.join(', '):'complete, clean and clear'}`+
   (others.length?` (${others.map(t=>`take ${takes.indexOf(t)+1}: ${t.notes.join(', ')||'weaker'}`).join('; ')})`:'');
  return {id:'take-'+(k+1),sentences:g.map(i=>sentences[i]!.n),best:best.sentence,why,takes};});
}

export type Hook={rank:number;start:number;end:number;sentences:number[];text:string;score:number;why:string[]};
const GREETING=/^(hi|hello|hey|welcome|good (morning|evening|afternoon)|today|in this video|my name|so today|what'?s up|assalam|سڵاو|مرحبا|سلام)\b/i;
const NEEDS_BEFORE=/^(and|but also|also|then|so|which|as i said|like i said|this|that|it|they|he|she|these|those)\b/i;
const STRONG=/\b(mistake|mistakes|never|stop|secret|nobody|no one|everyone|worst|best|wrong|truth|actually|changed|free|money|lost|saved|why|how|only|first|biggest|fastest|simple|easy|hard|problem|fail|failed|wish)\b/i;
const QUESTION=/\?|؟|^(why|how|what|did you|have you|do you|would you|can you)\b/i;
const NUMBER=/\d|\b(one|two|three|five|ten|hundred|thousand|million|half|double|twice)\b/i;
/** The moments that would open the video best: one or two sentences, 3 to 15 seconds, scored for a
 *  question, a figure, a strong claim, speaking to the viewer and a turn; a greeting or a line that
 *  needs what came before scores low. The best ten that do not overlap, ranked. */
export function findHooks(sentences:Sentence[],words:Spoken[],o:{limit?:number;skip?:(s:Sentence)=>boolean}={}):Hook[]{
 const live=sentences.filter(s=>!o.skip?.(s));
 const cands:Omit<Hook,'rank'>[]=[];
 for(let k=0;k<live.length;k++)for(const len of [1,2]){
  const part=live.slice(k,k+len);if(part.length<len)continue;if(len===2&&part[1]!.n!==part[0]!.n+1)continue;
  const start=part[0]!.start,end=part.at(-1)!.end,dur=end-start;if(dur<1.5||dur>15)continue;
  const text=part.map(s=>s.text).join(' '),first=part[0]!.text.trim(),why:string[]=[];let score=0;
  // The first sentence carries the hook; a second one adds half of what it brings.
  const has=(re:RegExp,w:number,label:string)=>{const a=re.test(first),b=len===2&&re.test(part[1]!.text);if(a||b){score+=a?w:w/2;why.push(label);}};
  if(QUESTION.test(first)){score+=2;why.push('asks a question');}
  has(NUMBER,2,'has a concrete number');
  has(STRONG,1.5,'makes a strong claim');
  has(/\b(you|your)\b/i,1,'speaks to the viewer');
  has(/\b(but|instead|until|except|turns out|the problem)\b/i,1,'has a turn');
  if(tokens(first).length<=12){score+=.5;why.push('short and direct');}
  if(GREETING.test(first)){score-=3;why.push('a greeting, not a hook');}
  if(NEEDS_BEFORE.test(first)){score-=1.5;why.push('needs what came before');}
  const f=words.slice(part[0]!.from,part.at(-1)!.to).filter(w=>w.filler).length;if(f){score-=f;why.push(`${f} filler${f>1?'s':''}`);}
  if(dur>10){score-=.5*(dur-10)/5;}
  if(len===2)score-=1; // one sentence is the stronger opening when it carries the idea
  if(score>0)cands.push({start,end,sentences:part.map(s=>s.n),text,score:+score.toFixed(2),why});
 }
 const picked:Omit<Hook,'rank'>[]=[];
 for(const c of cands.sort((a,b)=>b.score-a.score||a.sentences.length-b.sentences.length||a.start-b.start)){if(picked.length>=(o.limit??10))break;if(picked.every(p=>c.end<=p.start||c.start>=p.end))picked.push(c);}
 return picked.map((c,i)=>({rank:i+1,...c}));
}
