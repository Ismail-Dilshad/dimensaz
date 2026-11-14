// Builds readable caption cues from word timestamps, optionally anchored to the user's exact
// script so the caption text is never the recogniser's guess. Times come only from
// recognised words; tokens that could not be matched get no time of their own.
import type {Cue} from './edl.js';
import type {Word} from '../engine/transcribe.js';
import type {Language} from '../engine/languages.js';

export type CaptionOptions={maxCharsPerLine?:number;maxLines?:number;maxDuration?:number;minDuration?:number;pauseSplit?:number};
type Token={text:string;start:number|null;end:number|null};

const sentenceEnd=/[.!?؟…]["'”»)]*$/u;
const clauseEnd=/[,،;؛:]["'”»)]*$/u;

/** Normalises a word for matching: case, punctuation, Arabic-script letter variants and marks. */
export function normalizeWord(word:string){
 return word.normalize('NFKC').toLowerCase()
  .replace(/[ً-ٰٟـ‌‍]/g,'')
  // Lenient on purpose (matching only): recognisers often drop Kurdish letter marks.
  .replace(/[يىێ]/g,'ی').replace(/ك/g,'ک').replace(/[ةەهھ]/g,'ە').replace(/[أإآ]/g,'ا')
  .replace(/ڕ/g,'ر').replace(/ڵ/g,'ل').replace(/[ۆۊ]/g,'و')
  .replace(/[^\p{L}\p{N}]+/gu,'');
}

/** Splits a script into words, keeping each word's exact original spelling. */
export function scriptTokens(script:string){return script.split(/\s+/u).filter(Boolean);}

/** Longest-common-subsequence alignment of script tokens to recognised words. */
export function anchorToScript(words:Word[],script:string):{tokens:Token[];matched:number}{
 const spoken=words.filter(w=>w.type==='word'&&normalizeWord(w.text));
 const target=scriptTokens(script);
 const a=target.map(normalizeWord),b=spoken.map(w=>normalizeWord(w.text));
 const n=a.length,m=b.length;
 if(n*m>16_000_000)throw new Error('Script too long to align in one pass; split it into parts');
 const dp=new Int32Array((n+1)*(m+1));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i*(m+1)+j]=a[i]&&a[i]===b[j]?dp[(i+1)*(m+1)+j+1]+1:Math.max(dp[(i+1)*(m+1)+j],dp[i*(m+1)+j+1]);
 const tokens:Token[]=target.map(text=>({text,start:null,end:null}));
 let i=0,j=0,matched=0;
 while(i<n&&j<m){
  if(a[i]&&a[i]===b[j]){tokens[i].start=spoken[j].start;tokens[i].end=spoken[j].end;matched++;i++;j++;}
  else if(dp[(i+1)*(m+1)+j]>=dp[i*(m+1)+j+1])i++;else j++;
 }
 return {tokens,matched};
}

function balance(text:string,maxChars:number,maxLines:number){
 const words=text.split(' ');
 if(text.length<=maxChars||maxLines<2||words.length<2)return text;
 let best=1,score=Infinity;
 for(let k=1;k<words.length;k++){const l=words.slice(0,k).join(' ').length,r=words.slice(k).join(' ').length,s=Math.max(l,r)+Math.abs(l-r)*.25;if(s<score){score=s;best=k;}}
 return words.slice(0,best).join(' ')+'\n'+words.slice(best).join(' ');
}

/** Groups timed tokens into cues. Untimed tokens join the cue around them. */
export function groupCues(tokens:Token[],o:CaptionOptions={}):Cue[]{
 const maxChars=o.maxCharsPerLine??32,maxLines=o.maxLines??2,maxDuration=o.maxDuration??4.5,minDuration=o.minDuration??.8,pauseSplit=o.pauseSplit??.6;
 const limit=maxChars*maxLines;
 const groups:Token[][]=[];let current:Token[]=[];
 const timed=(g:Token[])=>g.filter(t=>t.start!==null);
 for(const [i,t] of tokens.entries()){
  const text=[...current,t].map(x=>x.text).join(' ');
  const first=timed(current)[0],lastTimed=timed(current).at(-1);
  const tooLong=current.length>0&&text.length>limit;
  const tooSlow=!!first&&t.end!==null&&t.end-first.start!>maxDuration;
  const paused=!!lastTimed&&t.start!==null&&t.start-lastTimed.end!>=pauseSplit;
  if(current.length&&(tooLong||tooSlow||paused)){groups.push(current);current=[];}
  current.push(t);
  const next=tokens[i+1];
  if(sentenceEnd.test(t.text)||(clauseEnd.test(t.text)&&current.map(x=>x.text).join(' ').length>maxChars*.6)||!next){groups.push(current);current=[];}
 }
 if(current.length)groups.push(current);
 // Groups with no recognised word cannot be timed: fold them into a neighbour.
 const merged:Token[][]=[];
 for(const g of groups){if(!timed(g).length&&merged.length)merged[merged.length-1].push(...g);else merged.push(g);}
 if(merged.length>1&&!timed(merged[0]).length){merged[1].unshift(...merged[0]);merged.shift();}
 const cues:Cue[]=[];
 for(const g of merged){
  const t=timed(g);if(!t.length)continue;
  // Each word keeps its time (a word with none sits right after the one before), for captions that follow the words.
  let at=t[0].start!;const words=g.map(x=>{const w={text:x.text,start:+(x.start??at).toFixed(3),end:+(x.end??Math.max(at,x.start??at)+.05).toFixed(3)};at=w.end;return w;});
  cues.push({start:t[0].start!,end:t.at(-1)!.end!,text:balance(g.map(x=>x.text).join(' '),maxChars,maxLines),words});
 }
 for(const [i,c] of cues.entries()){
  const next=cues[i+1]?.start??Infinity;
  c.end=Math.min(Math.max(c.end+.12,c.start+minDuration),next-.04);
  if(c.end<=c.start)c.end=c.start+.05;
  c.start=Number(c.start.toFixed(3));c.end=Number(c.end.toFixed(3));
 }
 return cues;
}

export function captionsFromWords(words:Word[],o:CaptionOptions&{script?:string;language?:Language}={}){
 if(o.script){
  const {tokens,matched}=anchorToScript(words,o.script);
  return {cues:groupCues(tokens,{maxCharsPerLine:o.language&&['ckb','ar','fa','kmr','badini'].includes(o.language)?28:32,...o}),
   source:'script' as const,matchedWords:matched,scriptWords:tokens.length,unmatched:tokens.filter(t=>t.start===null).map(t=>t.text)};
 }
 const tokens=words.filter(w=>w.type==='word').map(w=>({text:w.text.trim(),start:w.start,end:w.end})).filter(t=>t.text);
 return {cues:groupCues(tokens,o),source:'transcript' as const,matchedWords:tokens.length,scriptWords:null,unmatched:[]};
}
