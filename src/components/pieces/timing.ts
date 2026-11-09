// When each piece animates, without a browser: the piece's length (used by the compositor to
// fit the piece in its scene) and its sound cues (a pop when a layer lands, ticks while a number
// counts, a click when the cursor clicks...). The times mirror the animation in compose.ts and
// index.ts; change both together.
import type {Piece,ComposeContent} from '../../engine/scene-pieces-schema.js';

export type SoundKind='whoosh'|'click'|'tick'|'pop'|'success'|'impact';
/** A cue in seconds from the start of the piece's scene (before speed fitting). */
export type Cue={at:number;sound:SoundKind;gain:number;why:string};
type Timed={length:number;cues:Cue[]};
const cue=(at:number,sound:SoundKind,why:string,gain=1):Cue=>({at,sound,gain,why});
const shift=(cs:Cue[],by:number)=>cs.map(c=>({...c,at:c.at+by}));

/** When each layer enters, and the sound that marks it. */
export function contentTiming(p:ComposeContent):Timed{
 const cues:Cue[]=[];
 for(const l of p.layers){const a=l.in;
  const auto:SoundKind|'none'=a.sound??(a.from==='pop'||a.from==='scale'?'pop':a.from==='draw'?'whoosh':a.from==='count'||a.from==='type'||a.from==='grow'?'tick':'none');
  if(auto==='none')continue;
  if(a.sound===undefined&&(a.from==='count'||a.from==='type')){for(let x=a.at;x<a.at+a.dur;x+=.12)cues.push(cue(x,'tick','counting',.4));if(a.from==='count')cues.push(cue(a.at+a.dur,'impact','number lands',.7));}
  else cues.push(cue(a.at+(auto==='pop'?.12:0),auto,'layer '+(l.type),auto==='whoosh'?.45:.7));
 }
 return {length:composeLength(p),cues};
}
/** A piece lasts until its last layer has entered (or its own length). */
export function composeLength(p:ComposeContent){return p.length??Math.max(.6,...p.layers.map(l=>l.in.at+l.in.dur))+.4;}

type Spoken={text:string;duration:number;wordCues?:{from:number;to:number;start:number;end:number}[]};
const norm=(s:string)=>s.toLowerCase().normalize('NFKC').replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x660)).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-0x6f0)).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const same=(a:string,b:string)=>a===b||a.length>=4&&b.length>=4&&(a.startsWith(b.slice(0,4))&&b.startsWith(a.slice(0,4)));
/** With a voice-over (the scene's word timings), each layer that stands for some of the sentence's
 *  words (`says`) enters just as they are spoken; a number lands on its word. Layers without
 *  words move with the next layer that has them, and the opening layers stay where they were.
 *  The same piece drives the animation and its sounds, so both follow the voice. */
export function speechTimed(p:Piece,s:Spoken):Piece{
 if(!s.wordCues?.length||!p.layers.some(l=>l.says))return p;
 const spoken=s.wordCues.map(c=>({w:norm(s.text.slice(c.from,c.to)),at:c.start}));
 let cursor=0;
 const when=(says:string)=>{
  const ws=norm(says).split(' ').filter(w=>w.length>1||/\d/.test(w));
  for(const from of [cursor,0])for(let i=from;i<spoken.length;i++)if(ws.some(w=>spoken[i]!.w.split(' ').some(x=>same(x,w)))){cursor=i;return spoken[i]!.at;}
  return undefined;
 };
 const latest=Math.max(0,s.duration*.85-.35-p.delay);
 const layers=p.layers.map(l=>({...l,in:{...l.in}}));
 const shift:(number|undefined)[]=layers.map(l=>{
  if(!l.says)return undefined;const t=when(l.says);if(t===undefined)return undefined;
  const at=Math.min(latest,Math.max(0,(l.type==='number'&&l.in.from==='count'?t-l.in.dur*.8:t-.12)-p.delay));
  return at-l.in.at;
 });
 const firstSaid=Math.min(...layers.flatMap((l,i)=>shift[i]===undefined?[]:[l.in.at]));
 layers.forEach((l,i)=>{
  let d=shift[i];
  if(d===undefined&&l.in.at>=firstSaid){d=shift.slice(i+1).find(x=>x!==undefined)??shift.slice(0,i).reverse().find(x=>x!==undefined);}
  if(d!==undefined)l.in.at=Number(Math.min(latest,Math.max(0,l.in.at+d)).toFixed(3));
 });
 const natural=Math.max(.6,...layers.map(l=>l.in.at+l.in.dur))+.4;
 return {...p,layers,length:Number(Math.max(.5,Math.min(natural,s.duration*.85-p.delay)).toFixed(3))};
}

/** Length and cues of a whole piece, in seconds from the scene start. */
export function pieceTiming(p:Piece):Timed{
 const inner=contentTiming(p),length=p.delay+inner.length;
 const delayed=shift(inner.cues,p.delay);
 // The cursor is not delayed; it clicks where the path says click.
 const clicks=(p.cursor?.path??[]).filter(q=>q.click).map(q=>cue(q.at,'click','cursor click',1.1));
 return {length,cues:[...delayed,...clicks].sort((a,b)=>a.at-b.at)};
}

const TRANSITION_SOUND:Record<Piece['transition'],number>={none:0,fade:0,wipe:.7,push:.8,'zoom-through':1,'mask-reveal':.7,'circle-reveal':.8};
/** Scene-time cues for one scene: its transition in, then the piece's own cues, fitted to the
 *  scene the way the compositor fits the animation (a long piece plays faster). */
export function sceneCues(p:Piece,duration:number){
 const t=pieceTiming(p),speed=Math.max(1,t.length/Math.max(.5,duration*.85));
 const out:Cue[]=[];
 const transition=TRANSITION_SOUND[p.transition]>0;
 if(transition)out.push(cue(0,'whoosh',p.transition+' transition',TRANSITION_SOUND[p.transition]));
 for(const c of t.cues){if(transition&&c.at<.4&&c.sound==='whoosh')continue; // one whoosh per entrance
 const at=c.at/speed;if(at<duration-.05)out.push({...c,at});}
 // Keep the soundscape clean: nothing closer than 70 ms, the stronger cue wins; 14 at most.
 const kept:Cue[]=[];
 for(const c of out.sort((a,b)=>a.at-b.at)){const last=kept.at(-1);if(last&&c.at-last.at<.07){if(c.gain>last.gain)kept[kept.length-1]=c;continue;}kept.push(c);}
 return kept.length>14?kept.filter(c=>c.sound!=='tick').concat(kept.filter(c=>c.sound==='tick')).slice(0,14).sort((a,b)=>a.at-b.at):kept;
}
