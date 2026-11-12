// Music for a video: a track from your library (assets/music) when one fits the video's mood,
// otherwise an original piece composed for the video (compose.ts). Either way it is cut to the
// video: a library track starts on a beat, loops on whole bars when it is short, and fades out
// over its last bar exactly at the video's end; a composed one is written to the video's length
// with its chords changing where the scenes change.
import fs from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {ROOT} from '../config.js';
import {ffmpeg,run} from '../../renderer/ffmpeg-encoder.js';
import {analyzeMusic} from './analyze.js';
import {composeMusic,moods,type Mood} from './compose.js';
import type {Genome} from '../../components/pieces/genome.js';

export const trackSchema=z.object({id:z.string().regex(/^[a-z0-9][a-z0-9-]{0,60}$/),file:z.string(),title:z.string(),moods:z.array(z.enum(moods)).min(1),
 bpm:z.number(),beat:z.number(),offset:z.number(),duration:z.number(),confidence:z.number(),
 license:z.string(),credit:z.string().optional(),source:z.string().optional(),added:z.string()}).strict();
export type Track=z.infer<typeof trackSchema>;
export const musicDir=()=>process.env.TEMPOLOOM_MUSIC_DIR??path.join(ROOT,'assets','music');
const indexFile=()=>path.join(musicDir(),'index.json');
export async function readLibrary():Promise<Track[]>{
 try{return z.object({tracks:z.array(trackSchema)}).parse(JSON.parse(await fs.readFile(indexFile(),'utf8'))).tracks;}catch{return [];}
}
async function writeLibrary(tracks:Track[]){await fs.mkdir(musicDir(),{recursive:true});await fs.writeFile(indexFile(),JSON.stringify({version:1,tracks},null,1)+'\n');}

const LICENSES=/^(cc0|pdm|cc-by(-sa)?|own|licensed)$/;
/** Adds a track you may use (CC0, CC BY, your own, or licensed to you), analysed for tempo and beats. Never overwrites. */
export async function addTrack(file:string,o:{moods:Mood[];title?:string;license:string;credit?:string;source?:string}){
 if(!LICENSES.test(o.license))throw new Error('License must be one of cc0, pdm, cc-by, cc-by-sa, own or licensed (music you have the right to use)');
 if(o.license.startsWith('cc-by')&&!o.credit)throw new Error('A CC BY track needs --credit "Title by Artist (license, link)" so videos can credit it');
 const a=await analyzeMusic(file);
 const id=(o.title??path.basename(file,path.extname(file))).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'track';
 const tracks=await readLibrary();let name=id,k=2;while(tracks.some(t=>t.id===name))name=`${id}-${k++}`;
 const dest=path.join(musicDir(),name+path.extname(file).toLowerCase());
 await fs.mkdir(musicDir(),{recursive:true});await fs.copyFile(file,dest,fs.constants.COPYFILE_EXCL);
 const t=trackSchema.parse({id:name,file:path.relative(musicDir(),dest),title:o.title??path.basename(file,path.extname(file)),moods:o.moods,bpm:a.bpm,beat:a.beat,offset:a.offset,
  duration:Number(a.duration.toFixed(2)),confidence:a.confidence,license:o.license,...(o.credit?{credit:o.credit}:{}),...(o.source?{source:o.source}:{}),added:new Date().toISOString()});
 await writeLibrary([...tracks,t]);return t;
}

const WORDS:[Mood,RegExp][]=[
 ['calm',/\b(calm|relax|peace|sleep|mindful|wellness|meditat|gentle|slow|finance|advice|trust|care|health)\w*/i],
 ['warm',/\b(family|home|friend|together|community|love|cozy|coffee|story|thank)\w*/i],
 ['inspiring',/\b(future|planet|dream|change|grow|vision|mission|impact|build|clean|energy|journey|world)\w*/i],
 ['playful',/\b(kids?|fun|play|game|learn|school|toy|happy|colorful|pets?)\w*/i],
 ['energetic',/\b(sale|launch|now|fast|fitness|sport|drop|limited|boost|power|win)\w*/i],
 ['dark',/\b(night|security|hack|cyber|debug|dark|risk|threat|crime|mystery)\w*/i],
 ['upbeat',/\b(team|work|app|product|saas|startup|tool|easy|simple|today|try)\w*/i],
];
/** The mood a video's music should have: from the words of its script, then its style. */
export function moodFor(script:string,genome?:Genome):Mood{
 const score=new Map<Mood,number>();for(const [m,re] of WORDS){const n=(script.match(new RegExp(re.source,'gi'))??[]).length;if(n)score.set(m,n);}
 if(genome){const add=(m:Mood,v:number)=>score.set(m,(score.get(m)??0)+v);
  if(genome.tone==='dark')add('dark',.8);if(genome.tone==='paper')add('calm',.8);
  if(genome.motion.curve==='snap')add('energetic',.6);if(genome.motion.curve==='elastic'||genome.type.display==='round')add('playful',.6);if(genome.motion.curve==='smooth')add('calm',.5);}
 return [...score].sort((a,b)=>b[1]-a[1])[0]?.[0]??'upbeat';
}

export type Fitted={file:string;source:'library'|'composed';title:string;mood:Mood;bpm:number;key?:string;license:string;credit?:string};
/** Music for one video, cut to its length. `prefer` forces the library or composing. */
export async function musicFor(o:{script:string;duration:number;seed:string;cuts:number[];genome?:Genome;mood?:Mood;underVoice?:boolean;prefer?:'library'|'composed';out:string;
 /** A tempo to aim for (a learned look's): the closest library tracks, or the composer's tempo. */
 bpm?:number}):Promise<Fitted>{
 const mood=o.mood??moodFor(o.script,o.genome);
 const lib=o.prefer==='composed'?[]:(await readLibrary()).filter(t=>t.moods.includes(mood));
 if(lib.length){
  // Tracks of the mood, varied per video; a long enough track avoids looping.
  let h=0;for(const c of o.seed)h=(h*31+c.charCodeAt(0))>>>0;
  const near=(t:Track)=>o.bpm?Math.min(Math.abs(t.bpm-o.bpm),Math.abs(t.bpm*2-o.bpm),Math.abs(t.bpm/2-o.bpm)):0;
  const pool=o.bpm?[...lib].sort((a,b)=>near(a)-near(b)).filter((t,_,a)=>near(t)<=near(a[0]!)+8):lib;
  const ranked=[...pool].sort((a,b)=>Number(b.duration-b.offset>=o.duration)-Number(a.duration-a.offset>=o.duration));
  const fits=ranked.filter(t=>t.duration-t.offset>=o.duration);const t=(fits.length?fits:ranked)[h%(fits.length||ranked.length)]!;
  await fitTrack(path.join(musicDir(),t.file),t,o.duration,o.out);
  return {file:o.out,source:'library',title:t.title,mood,bpm:t.bpm,license:t.license,...(t.credit?{credit:t.credit}:{})};
 }
 if(o.prefer==='library')throw new Error(`No ${mood} track in assets/music; add one with pnpm tempoloom music add FILE --mood ${mood}`);
 const wav=o.out.replace(/\.[^.]+$/,'')+'.wav';
 const c=await composeMusic({mood,duration:o.duration,seed:o.seed,cuts:o.cuts,underVoice:o.underVoice,bpm:o.bpm},wav);
 await run(ffmpeg,['-v','error','-y','-i',wav,'-af','loudnorm=I=-14:TP=-1.5:LRA=11','-ar','48000','-c:a','aac','-b:a','192k',o.out]);await fs.rm(wav,{force:true});
 return {file:o.out,source:'composed',title:`Original score (${mood}, ${c.key}, ${c.bpm} BPM)`,mood,bpm:c.bpm,key:c.key,license:'composed for this video by Tempoloom (free to use)'};
}
/** Cuts a library track to the video: starts on its first beat, loops on whole bars if short,
 *  fades over the last bar so it ends with the video, levelled to −14 LUFS. */
export async function fitTrack(file:string,t:Pick<Track,'beat'|'offset'|'duration'>,duration:number,out:string){
 const bar=t.beat*4,usable=t.duration-t.offset,loopLen=Math.max(bar,Math.floor(usable/bar)*bar),fade=Math.min(Math.max(bar,1.2),Math.max(.5,duration/4));
 const copies=Math.max(1,Math.ceil(duration/loopLen)),xf=Math.min(.25,t.beat/2);
 const parts=[...Array.from({length:copies},(_,k)=>`[${k}:a]atrim=start=${t.offset}:end=${(t.offset+loopLen+(k<copies-1?xf:0)).toFixed(3)},asetpts=PTS-STARTPTS[p${k}]`)];
 let chain='[p0]';for(let k=1;k<copies;k++){parts.push(`${chain}[p${k}]acrossfade=d=${xf}:c1=tri:c2=tri[x${k}]`);chain=`[x${k}]`;}
 parts.push(`${chain}atrim=duration=${duration.toFixed(3)},afade=t=in:st=0:d=0.05,afade=t=out:st=${Math.max(0,duration-fade).toFixed(3)}:d=${fade.toFixed(3)},loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[out]`);
 await run(ffmpeg,['-v','error','-y',...Array.from({length:copies},()=>['-i',file]).flat(),'-filter_complex',parts.join(';'),'-map','[out]','-c:a','aac','-b:a','192k',out]);
 return out;
}
