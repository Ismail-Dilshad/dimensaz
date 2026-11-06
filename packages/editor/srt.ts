// SubRip (SRT) parsing and writing. Text is kept exactly as written (no reordering).
import type {Cue} from './edl.js';

const stamp=/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;
function seconds(s:string){const m=s.match(stamp);if(!m)throw new Error('Bad SRT time: '+s);return +m[1]*3600+ +m[2]*60+ +m[3]+ +m[4].padEnd(3,'0')/1000;}

export function parseSrt(text:string):Cue[]{
 const cues:Cue[]=[];
 for(const block of text.replace(/^﻿/,'').replace(/\r\n?/g,'\n').split(/\n{2,}/)){
  const lines=block.split('\n').filter((l,i)=>i>0||l.trim()!=='');
  const at=lines.findIndex(l=>l.includes('-->'));if(at<0)continue;
  const [a,b]=lines[at].split('-->');const body=lines.slice(at+1).join('\n').trim();
  if(body)cues.push({start:seconds(a),end:seconds(b),text:body});
 }
 if(!cues.length)throw new Error('No captions found in SRT');
 return cues;
}

const fmt=(t:number)=>{const ms=Math.round(t*1000),h=Math.floor(ms/3600000),m=Math.floor(ms/60000)%60,s=Math.floor(ms/1000)%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
export function writeSrt(cues:Cue[]){return cues.map((c,i)=>`${i+1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${c.text}\n`).join('\n');}

/** Shift and clip cues after an edit changed the timeline. `map` returns the new time or null if removed. */
export function retime(cues:Cue[],map:(t:number)=>number|null):Cue[]{
 return cues.flatMap(c=>{const s=map(c.start),e=map(c.end);return s!==null&&e!==null&&e>s?[{...c,start:s,end:e}]:[];});
}
