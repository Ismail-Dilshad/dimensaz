// Talking-head tightening from a word-timed transcript: cut long pauses, filler words and
// dead air at the start and end, keep natural breaths, and retime captions to the new edit.
// Produces an edit decision list for review; nothing is cut until the editor runs it.
import type {Word} from '../engine/transcribe.js';
import type {Language} from '../engine/languages.js';
import type {Cue,Operation} from './edl.js';
import {retime} from './srt.js';
import {normalizeWord} from './caption-builder.js';
import {styleFields} from './caption-styles.js';

// Conservative: words that are almost always hesitation sounds. "like" or "you know" are
// left alone because they are often real words.
export const fillers:Record<string,string[]>={
 en:['um','umm','uhm','uh','uhh','er','erm','ah','ahh','hmm','hm','mm','mmm','mhm'],
 ckb:['ئە','ئەم','ئەمم','ئەممم','ئا','ئاا','ئێ','هم','همم','هەم'],
 kmr:['ee','eee','em','emm','hm','hmm','ah'],
 ar:['اه','آه','ام','امم','اممم','ممم'],
 fa:['اِم','ام','امم','اه','ممم'],
};
fillers.badini=fillers.kmr;

export type TightenOptions={maxPause?:number;keepPause?:number;minCut?:number;fillers?:boolean;trimEnds?:boolean;extraFillers?:string[]};
export type Removal={start:number;end:number;reason:'pause'|'filler'|'start'|'end';text?:string};

function merge(ranges:Removal[]){
 const sorted=[...ranges].sort((a,b)=>a.start-b.start);const out:Removal[]=[];
 for(const r of sorted){const last=out.at(-1);if(last&&r.start<=last.end+.02){last.end=Math.max(last.end,r.end);if(r.reason==='filler'){last.reason='filler';last.text=[last.text,r.text].filter(Boolean).join(' ');}}else out.push({...r});}
 return out;
}

export function planTighten(words:Word[],duration:number,language:Language,o:TightenOptions={}){
 const maxPause=o.maxPause??.6,keep=o.keepPause??.18,minCut=o.minCut??.25;
 const list=new Set([...(fillers[language]??[]),...(language!=='en'?fillers.en:[]),...(o.extraFillers??[])].map(normalizeWord));
 const spoken=words.filter(w=>w.type==='word'&&w.text.trim());
 const isFiller=(w:Word)=>o.fillers!==false&&list.has(normalizeWord(w.text));
 const kept=spoken.filter(w=>!isFiller(w));
 const cuts:Removal[]=[];
 if(!kept.length)return {cuts:[],removedSeconds:0,resultSeconds:duration,keptWords:0,fillerCount:0};
 if(o.trimEnds!==false){
  if(kept[0].start-keep>minCut)cuts.push({start:0,end:kept[0].start-keep,reason:'start'});
  if(duration-(kept.at(-1)!.end+keep)>minCut)cuts.push({start:kept.at(-1)!.end+keep,end:duration,reason:'end'});
 }
 // Gaps between kept words, measured after fillers are taken out, so "word … um … word"
 // becomes one tight join instead of two half-pauses.
 for(let i=1;i<kept.length;i++){
  const gapStart=kept[i-1].end,gapEnd=kept[i].start;
  const fillerHere=spoken.filter(w=>isFiller(w)&&w.start>=gapStart-.01&&w.end<=gapEnd+.01);
  const gap=gapEnd-gapStart;
  if(fillerHere.length){
   const s=gapStart+Math.min(keep,gap/2),e=gapEnd-Math.min(keep,gap/2);
   if(e-s>.05)cuts.push({start:s,end:e,reason:'filler',text:fillerHere.map(w=>w.text).join(' ')});
  }else if(gap>maxPause){
   const s=gapStart+keep,e=gapEnd-keep;
   if(e-s>=minCut)cuts.push({start:s,end:e,reason:'pause'});
  }
 }
 const merged=merge(cuts).map(c=>({...c,start:Number(Math.max(0,c.start).toFixed(3)),end:Number(Math.min(duration,c.end).toFixed(3))})).filter(c=>c.end-c.start>.05);
 const removed=merged.reduce((t,c)=>t+c.end-c.start,0);
 return {cuts:merged,removedSeconds:Number(removed.toFixed(3)),resultSeconds:Number((duration-removed).toFixed(3)),keptWords:kept.length,
  fillerCount:spoken.length-kept.length};
}

/** Maps a source time to the edited timeline, or null if it falls inside a cut. */
export function timeMap(cuts:{start:number;end:number}[]){
 const sorted=[...cuts].sort((a,b)=>a.start-b.start);
 return (t:number)=>{let shift=0;for(const c of sorted){if(t>=c.end)shift+=c.end-c.start;else if(t>c.start)return c.start-shift;else break;}return Number((t-shift).toFixed(3));};
}

export function tightenEdl(input:string,cuts:Removal[],captions?:{cues:Cue[];language:Language;style?:string}):{version:1;input:string;operations:Operation[]}{
 const operations:Operation[]=[];
 if(cuts.length)operations.push({op:'cut',ranges:cuts.map(c=>({start:c.start,end:c.end}))});
 if(captions?.cues.length){
  const cues=retime(captions.cues,timeMap(cuts)).filter(c=>c.end-c.start>=.2);
  if(cues.length)operations.push({op:'captions',cues,language:captions.language,size:.055,color:'#FFFFFF',stroke:'#000000',strokeWidth:.14,background:null,position:'bottom',margin:.16,maxWidth:.86,weight:700,safeArea:true,...styleFields(captions.style)});
 }
 return {version:1,input,operations};
}
