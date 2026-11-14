// The sound design layer of an edit: whooshes, pops, clicks and hits where something moves (a
// visual comes in, b-roll cuts in, the frame punches in, the opening hands over to the talk), from
// the same sounds as motion videos (assets/sfx, or a synthesised kit), and kept under the voice:
// the layer is pushed down while someone speaks.
import type {Operation} from './edl.js';
import type {SoundKind} from '../components/pieces/timing.js';

export type SoundCue={time:number;sound:SoundKind;gain:number;why:string};
/** Cues from the moving parts of an edit list (times on the edit's own timeline: operations after
 *  the last cut or arrangement). At most one cue every 0.35 s; the stronger one wins. */
export function cuesFromOps(ops:Operation[],o:{joins?:number[]}={}):SoundCue[]{
 const out:SoundCue[]=[];
 for(const op of ops){
  if(op.op==='overlays')for(const it of op.items){const full=it.width>=.95;out.push({time:it.start,sound:full?'whoosh':'pop',gain:full?.8:.9,why:full?'b-roll cuts in':'a visual comes in'});}
  if(op.op==='overlay')out.push({time:op.start,sound:'pop',gain:.8,why:'a picture comes in'});
  if(op.op==='punch')for(const r of op.ranges)if(r.scale>1.05)out.push({time:r.start,sound:'whoosh',gain:.35,why:'the frame punches in'});
 }
 for(const t of o.joins??[])out.push({time:t,sound:'impact',gain:.7,why:'the opening hands over to the talk'});
 const kept:SoundCue[]=[];
 for(const c of out.filter(x=>x.time>=0).sort((a,b)=>a.time-b.time)){const last=kept.at(-1);if(last&&c.time-last.time<.35){if(c.gain>last.gain)kept[kept.length-1]=c;continue;}kept.push({...c,time:+c.time.toFixed(3)});}
 return kept;
}
