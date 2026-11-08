// Automatic sound for animated scene pieces: every scene's transition, cursor clicks,
// notifications landing, counters ticking, tasks done... come from the piece's own timing
// (components/pieces/timing.ts) and the CC0 sounds in assets/sfx. All cues are mixed into one
// sound bed, levelled by each sound's measured loudness, so the mix stays clean.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import type {Project} from './schema.js';
import {sceneCues,type Cue,type SoundKind} from '../components/pieces/timing.js';
import {readSfxIndex,type Sfx} from './sfx.js';
import {ffmpeg,run} from '../renderer/ffmpeg-encoder.js';

/** Which sound plays each cue: preferred files first, then any licensed sound of the category. */
const CHOICE:Record<SoundKind,{category:string;prefer:string[];targetDb:number;maxLength:number}>={
 whoosh:{category:'whooshes',prefer:['gentle-text-transition-whoosh','kenney-open'],targetDb:-31,maxLength:1},
 click:{category:'clicks',prefer:['kenney-click'],targetDb:-27,maxLength:.2},
 // The scroll sound is a rattle; its first 60 ms is a crisp tick.
 tick:{category:'ticks',prefer:['kenney-scroll'],targetDb:-34,maxLength:.06},
 pop:{category:'pops',prefer:['soft-typography-pop','kenney-maximize'],targetDb:-28,maxLength:.4},
 success:{category:'success',prefer:['kenney-confirmation'],targetDb:-31,maxLength:1},
 impact:{category:'impacts',prefer:['soft-typography-impact','kenney-drop'],targetDb:-28,maxLength:.5},
};
/** Openly licensed (CC0) sounds short enough to be cut into cues. */
export const cueSounds=(items:Sfx[])=>items.filter(s=>s.license==='CC0-1.0'&&s.duration>0&&s.duration<=1.5);
export type PlacedCue=Cue&{scene:number;time:number;file:string;volume:number;length:number};

export function pickSound(kind:SoundKind,sounds:Sfx[]){
 const c=CHOICE[kind],pool=sounds.filter(s=>s.category===c.category);
 return c.prefer.map(name=>pool.find(s=>path.basename(s.file).startsWith(name))).find(Boolean)??pool[0];
}

/** Cues for every scene with a piece, on the video's timeline, with the file and volume to use. */
export function planPieceSounds(scenes:Pick<Project['scenes'][number],'start'|'duration'|'piece'>[],sounds:Sfx[],{underVoice=false}={}){
 const placed:PlacedCue[]=[];
 scenes.forEach((s,scene)=>{
  if(!s.piece)return;
  for(const c of sceneCues(s.piece,s.duration)){
   const sound=pickSound(c.sound,sounds);if(!sound)continue;
   const level=CHOICE[c.sound].targetDb-(sound.rmsDb??CHOICE[c.sound].targetDb);
   const volume=Math.min(4,10**(level/20)*c.gain*(underVoice?.5:1));
   placed.push({...c,scene,time:Number((s.start+c.at).toFixed(3)),file:sound.file,volume:Number(volume.toFixed(3)),length:Number(Math.min(sound.duration,CHOICE[c.sound].maxLength).toFixed(3))});
  }
 });
 return placed;
}

/** Renders the cues into one stereo WAV the length of the video. */
export async function renderSoundBed(cues:PlacedCue[],duration:number,out:string){
 const files=[...new Set(cues.map(c=>c.file))];
 const args=['-v','error','-y'];for(const f of files)args.push('-i',f);
 const filters:string[]=[];
 files.forEach((f,i)=>{const n=cues.filter(c=>c.file===f).length;filters.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo,asplit=${n}${Array.from({length:n},(_,k)=>`[s${i}_${k}]`).join('')}`);});
 const used=files.map(()=>0);
 const labels=cues.map((c,j)=>{const i=files.indexOf(c.file),k=used[i]!++;const fade=Math.min(.03,c.length*.4);filters.push(`[s${i}_${k}]atrim=0:${c.length},afade=t=out:st=${(c.length-fade).toFixed(3)}:d=${fade.toFixed(3)},volume=${c.volume},adelay=${Math.round(c.time*1000)}:all=1[e${j}]`);return `[e${j}]`;});
 filters.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=longest,apad=whole_dur=${duration.toFixed(3)},alimiter=limit=0.9:level=0[out]`);
 // -t as well: the bed can never run past the video.
 args.push('-filter_complex',filters.join(';'),'-map','[out]','-t',duration.toFixed(3),'-c:a','pcm_s16le',out);
 await run(ffmpeg,args);
 return out;
}

/** Plans and renders the piece sounds for a project; returns the WAV path and the cues. */
export async function pieceSoundBed(p:Project){
 const sounds=cueSounds(await readSfxIndex());
 const duration=p.scenes.reduce((m,s)=>Math.max(m,s.start+s.duration),0);
 const cues=planPieceSounds(p.scenes,sounds,{underVoice:p.media.some(m=>m.kind==='voice')});
 if(!cues.length)return null;
 const id=createHash('sha256').update(JSON.stringify(cues)).digest('hex').slice(0,12);
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dz-piece-sounds-'));
 const file=await renderSoundBed(cues,duration,path.join(dir,`piece-sounds-${id}.wav`));
 return {file,cues,dir};
}
