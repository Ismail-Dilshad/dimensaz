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
