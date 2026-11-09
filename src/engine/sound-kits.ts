// Sound kits: whole families of interface sounds, so a video's sound matches its design style.
// "library" uses the CC0 recordings in assets/sfx; the others are original sounds synthesised
// with FFmpeg from formulas (no samples, no licences needed), two pitch variants each so
// repeated cues never sound like a machine gun. Generated once and cached.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT} from './config.js';
import {ffmpeg,run} from '../renderer/ffmpeg-encoder.js';
import type {SoundKind} from '../components/pieces/timing.js';

export const soundKits=['library','soft','digital','punchy','minimal'] as const;
export type SoundKit=typeof soundKits[number];
export const kitDescriptions:Record<SoundKit,string>={
 library:'CC0 recordings: natural clicks, pops, whooshes and a chime',
 soft:'Warm, rounded synth tones: gentle pops, soft clicks, airy whooshes, a bell chord',
 digital:'Crisp square-wave blips and bit-crushed whooshes for tech and night styles',
 punchy:'Short, loud transients with low-end hits for bold and playful styles',
 minimal:'Only transitions and clicks, very quiet; for calm, editorial and technical styles',
};
/** Cues each kit plays (minimal leaves out the busy ones). */
export const kitPlays=(kit:SoundKit,kind:SoundKind)=>kit!=='minimal'||kind==='whoosh'||kind==='click'||kind==='success';

type Synth={expr?:string;noise?:{color:string;filter:string};d:number};
// f = pitch factor of the variant. Expressions are FFmpeg aevalsrc formulas of t (seconds).
const SYNTH:Record<Exclude<SoundKit,'library'>,Record<SoundKind,(f:number)=>Synth>>={
 soft:{
  click:f=>({expr:`sin(2*PI*${1400*f}*t)*exp(-t*90)*0.6`,d:.06}),
  tick:f=>({expr:`sin(2*PI*${2200*f}*t)*exp(-t*170)*0.5`,d:.04}),
  pop:f=>({expr:`sin(2*PI*(${380*f}+${700*f}*exp(-t*30))*t)*exp(-t*18)*0.7`,d:.22}),
  whoosh:f=>({noise:{color:'pink',filter:`bandpass=f=${900*f}:t=h:w=1400,lowpass=f=2400,afade=t=in:d=0.22,afade=t=out:st=0.22:d=0.26,volume=0.9`},d:.48}),
  success:f=>({expr:`(sin(2*PI*${523*f}*t)*exp(-t*6)+gt(t,0.08)*sin(2*PI*${659*f}*(t-0.08))*exp(-(t-0.08)*6)+gt(t,0.16)*sin(2*PI*${784*f}*(t-0.16))*exp(-(t-0.16)*5))*0.3`,d:.9}),
  impact:f=>({expr:`sin(2*PI*(${70*f}+${90*f}*exp(-t*20))*t)*exp(-t*9)*0.9`,d:.45}),
 },
 digital:{
  click:f=>({expr:`sgn(sin(2*PI*${3000*f}*t))*exp(-t*140)*0.35`,d:.04}),
  tick:f=>({expr:`sgn(sin(2*PI*${4200*f}*t))*exp(-t*260)*0.3`,d:.03}),
  pop:f=>({expr:`sgn(sin(2*PI*(${900*f}+${1500*f}*exp(-t*35))*t))*exp(-t*22)*0.3`,d:.16}),
  whoosh:f=>({noise:{color:'white',filter:`highpass=f=${1800*f},acrusher=bits=6:mode=lin:mix=0.6,afade=t=in:d=0.18,afade=t=out:st=0.18:d=0.2,volume=0.45`},d:.38}),
  success:f=>({expr:`(sgn(sin(2*PI*${880*f}*t))*lt(t,0.09)+gt(t,0.09)*lt(t,0.18)*sgn(sin(2*PI*${1175*f}*t))+gt(t,0.18)*sgn(sin(2*PI*${1760*f}*t))*exp(-(t-0.18)*8))*0.18`,d:.6}),
  impact:f=>({expr:`sgn(sin(2*PI*(${60*f}+${140*f}*exp(-t*25))*t))*exp(-t*10)*0.45`,d:.35}),
 },
 punchy:{
  click:f=>({expr:`((random(0)*2-1)*exp(-t*220)*0.5+sin(2*PI*${1800*f}*t)*exp(-t*80)*0.5)`,d:.05}),
  tick:f=>({expr:`(random(0)*2-1)*exp(-t*300)*0.45`,d:.025}),
  pop:f=>({expr:`sin(2*PI*(${200*f}+${900*f}*exp(-t*45))*t)*exp(-t*14)*0.9`,d:.2}),
  whoosh:f=>({noise:{color:'white',filter:`bandpass=f=${1100*f}:t=h:w=1800,afade=t=in:d=0.12,afade=t=out:st=0.12:d=0.2,volume=1.2`},d:.32}),
  success:f=>({expr:`(sin(2*PI*${659*f}*t)+sin(2*PI*${830*f}*t)+sin(2*PI*${988*f}*t))*exp(-t*7)*0.25`,d:.55}),
  impact:f=>({expr:`(sin(2*PI*(${55*f}+${120*f}*exp(-t*25))*t)*exp(-t*6)+(random(0)*2-1)*exp(-t*45)*0.5)*0.9`,d:.5}),
 },
 minimal:{
  click:f=>({expr:`sin(2*PI*${1100*f}*t)*exp(-t*120)*0.35`,d:.04}),
  tick:f=>({expr:`sin(2*PI*${1800*f}*t)*exp(-t*200)*0.2`,d:.03}),
  pop:f=>({expr:`sin(2*PI*${600*f}*t)*exp(-t*30)*0.3`,d:.12}),
  whoosh:f=>({noise:{color:'brown',filter:`lowpass=f=${1200*f},afade=t=in:d=0.25,afade=t=out:st=0.25:d=0.3,volume=0.8`},d:.55}),
  success:f=>({expr:`(sin(2*PI*${784*f}*t)*exp(-t*5)+gt(t,0.12)*sin(2*PI*${1046*f}*(t-0.12))*exp(-(t-0.12)*5))*0.18`,d:.8}),
  impact:f=>({expr:`sin(2*PI*${90*f}*t)*exp(-t*12)*0.5`,d:.3}),
 },
};
const VARIANTS=[1,1.12];
export type KitSound={file:string;rmsDb:number;duration:number};

/** The kit's sound for a cue kind and variant, generated (once) when needed. */
export async function kitSound(kit:Exclude<SoundKit,'library'>,kind:SoundKind,variant=0):Promise<KitSound>{
 const f=VARIANTS[variant%VARIANTS.length]!,spec=SYNTH[kit][kind](f);
 const id=createHash('sha256').update(JSON.stringify([kit,kind,spec])).digest('hex').slice(0,10);
 const dir=path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','cache','sound-kits',kit);await fs.mkdir(dir,{recursive:true});
 const file=path.join(dir,`${kind}-${variant}-${id}.wav`),meta=file+'.json';
 try{return JSON.parse(await fs.readFile(meta,'utf8')) as KitSound;}catch{/* make it */}
 const src=spec.expr?`aevalsrc='${spec.expr}':s=48000:d=${spec.d}`:`anoisesrc=d=${spec.d}:c=${spec.noise!.color}:r=48000:a=0.6:seed=7`;
 const chain=`${spec.noise?spec.noise.filter+',':''}aformat=channel_layouts=stereo,afade=t=out:st=${(spec.d*.8).toFixed(3)}:d=${(spec.d*.2).toFixed(3)}`;
 await run(ffmpeg,['-v','error','-y','-f','lavfi','-i',src,'-af',chain,'-t',String(spec.d),'-c:a','pcm_s16le',file]);
 const stats=await run(ffmpeg,['-v','error','-i',file,'-af','astats=metadata=1,ametadata=print:file=-','-f','null','-']);
 const levels=[...stats.matchAll(/Overall.RMS_level=(-?[\d.]+)/g)].map(m=>Number(m[1])).filter(Number.isFinite);
 const out={file,rmsDb:levels.at(-1)??-30,duration:spec.d};
 await fs.writeFile(meta,JSON.stringify(out));return out;
}
