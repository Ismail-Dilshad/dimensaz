// Caption files for a finished video: SubRip (.srt) and WebVTT (.vtt) next to the video, so
// platforms show closed captions (YouTube, TikTok, Instagram, LinkedIn, the web), plus an
// optional copy with the captions burned in. For a motion video made with a voice-over the
// text is the script and the timing is the voice's own word timing, so nothing is guessed.
import fs from 'node:fs/promises';
import path from 'node:path';
import type {Project} from '../engine/schema.js';
import type {Cue} from './edl.js';
import {groupCues} from './caption-builder.js';
import {writeSrt} from './srt.js';

const RTL=['ckb','ar','fa','kmr','badini'];

/** Readable caption cues (two lines at most, split at sentences, clauses and pauses) from the
 *  word timings of a project's scenes. Empty when the video has no voice timing. */
export function projectCaptions(p:Project):Cue[]{
 const tokens=p.scenes.flatMap(s=>(s.wordCues??[]).map(c=>({text:s.text.slice(c.from,c.to),start:s.start+c.start,end:s.start+c.end})));
 if(!tokens.length)return [];
 return groupCues(tokens,{maxCharsPerLine:RTL.includes(p.config.language)?28:32});
}

const vttTime=(t:number)=>{const ms=Math.round(t*1000),h=Math.floor(ms/3600000),m=Math.floor(ms/60000)%60,s=Math.floor(ms/1000)%60;
 return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;};
/** WebVTT; right-to-left cues are marked so players lay them out right to left. */
export function writeVtt(cues:Cue[],language?:string){
 const rtl=!!language&&RTL.includes(language);
 return 'WEBVTT\n\n'+cues.map((c,i)=>`${i+1}\n${vttTime(c.start)} --> ${vttTime(c.end)}\n${rtl?c.text.split('\n').map(l=>'‫'+l+'‬').join('\n'):c.text}\n`).join('\n');
}

const exists=(f:string)=>fs.access(f).then(()=>true,()=>false);
/** Writes NAME.srt and NAME.vtt beside each video (never overwriting), and with burn a copy
 *  NAME_captions.mp4 of the first video with the captions drawn on it. */
export async function exportCaptions(p:Project,videos:string[],o:{burn?:boolean}={}){
 const cues=projectCaptions(p);if(!cues.length)return null;
 const files:string[]=[];
 for(const v of videos){const base=v.replace(/\.[^.]+$/,'');
  for(const [ext,text] of [['.srt',writeSrt(cues)],['.vtt',writeVtt(cues,p.config.language)]] as const){const f=base+ext;if(await exists(f))continue;await fs.writeFile(f,text,{flag:'wx'});files.push(f);}}
 let burned:string|undefined;
 if(o.burn&&videos[0]){
  const out=videos[0].replace(/\.[^.]+$/,'')+'_captions.mp4';
  if(!await exists(out)){const {runEdl}=await import('./editor.js');
   burned=(await runEdl({version:1,input:videos[0],output:out,operations:[{op:'captions',cues,language:p.config.language}],export:{preset:'social'}},path.dirname(videos[0]))).output;}
 }
 return {cues:cues.length,files,...(burned?{burned}:{})};
}
