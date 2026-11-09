// Sound checks on a finished video: overall loudness (LUFS), true peak, and how busy the
// piece sounds are, so effects never end up too quiet, too loud or machine-gun dense.
import {ffmpeg,run} from '../renderer/ffmpeg-encoder.js';
import type {Project} from './schema.js';
import type {SoundQuality} from '../renderer/visual-qa.js';

/** Integrated loudness (LUFS) and true peak (dBFS) of a file's audio. */
export async function measureLoudness(file:string){
 const out=await run(ffmpeg,['-hide_banner','-nostats','-i',file,'-vn','-af','ebur128=peak=true:metadata=1,ametadata=print:file=-','-f','null','-']).catch(()=> '');
 const last=(key:string)=>{const all=[...out.matchAll(new RegExp(key.replace(/\./g,'\\.')+'=(-?[\\d.inf]+)','g'))].map(m=>Number(m[1])).filter(Number.isFinite);return all.length?all[all.length-1]!:null;};
 const peaks=[last('lavfi.r128.true_peaks_ch0'),last('lavfi.r128.true_peaks_ch1')].filter((x):x is number=>x!==null);
 const tp=peaks.length?20*Math.log10(Math.max(...peaks.map(p=>p>0?p:1e-9))):null;
 const i=last('lavfi.r128.I');
 return {lufs:i===null?null:Number(i.toFixed(1)),peak:tp===null?null:Number(tp.toFixed(1))};
}
export async function soundQuality(file:string,p:Project):Promise<SoundQuality>{
 const issues:string[]=[];let lufs:number|null=null,peak:number|null=null;
 const hasAudio=p.media.some(m=>['voice','music','sfx'].includes(m.kind));
 if(hasAudio){
  ({lufs,peak}=await measureLoudness(file));
  const voice=p.media.some(m=>m.kind==='voice');
  if(lufs!==null&&lufs<(voice?-20:-28))issues.push(`quiet overall (${lufs} LUFS)`);
  if(lufs!==null&&lufs>-9)issues.push(`loud overall (${lufs} LUFS)`);
  if(peak!==null&&peak>-.3)issues.push(`peaks at ${peak} dBFS (risk of clipping)`);
 }
 const cues=p.media.find(m=>m.metadata?.pieceSounds)?.metadata?.cues as {time:number}[]|undefined;
 const duration=p.scenes.reduce((m,s)=>Math.max(m,s.start+s.duration),0)||1;
 const perSecond=cues?Number((cues.length/duration).toFixed(2)):null;
 if(perSecond!==null&&perSecond>3.2)issues.push(`busy effects (${perSecond} cues a second)`);
 if(cues){let worst=0;for(let t=0;t<duration;t+=.5){const n=cues.filter(c=>c.time>=t&&c.time<t+1).length;worst=Math.max(worst,n);}if(worst>7)issues.push(`${worst} effects within one second`);}
 return {integratedLufs:lufs,truePeakDb:peak,cuesPerSecond:perSecond,issues};
}
