// Tempo and beat grid of a music file, with FFmpeg only (no Python): an onset envelope from
// the rise of loudness in short frames, its autocorrelation for the tempo (70–180 BPM, gently
// preferring 90–130), and the beat phase that lines up best with the onsets.
import {ffmpeg,run} from '../../renderer/ffmpeg-encoder.js';
import {spawn} from 'node:child_process';

const SR=11025,HOP=256;
async function pcm(file:string):Promise<Float32Array>{
 return await new Promise((resolve,reject)=>{
  const p=spawn(ffmpeg,['-v','error','-i',file,'-ac','1','-ar',String(SR),'-f','f32le','-']);const chunks:Buffer[]=[];
  p.stdout.on('data',c=>chunks.push(c));p.on('error',reject);
  p.on('close',code=>{if(code!==0)return reject(new Error('Could not read the audio of '+file));const b=Buffer.concat(chunks);resolve(new Float32Array(b.buffer,b.byteOffset,Math.floor(b.length/4)));});
 });
}
export type Analysis={duration:number;bpm:number;beat:number;offset:number;confidence:number;onsetsPerSecond:number};
export async function analyzeMusic(file:string):Promise<Analysis>{
 void run;
 const x=await pcm(file),frames=Math.floor(x.length/HOP);if(frames<64)throw new Error('The track is too short to analyse');
 const energy=new Float32Array(frames);
 for(let f=0;f<frames;f++){let s=0;for(let i=f*HOP;i<(f+1)*HOP;i++)s+=x[i]!*x[i]!;energy[f]=Math.log(1e-9+s/HOP);}
 const onset=new Float32Array(frames);for(let f=1;f<frames;f++)onset[f]=Math.max(0,energy[f]!-energy[f-1]!);
 const mean=onset.reduce((a,b)=>a+b,0)/frames;for(let f=0;f<frames;f++)onset[f]=Math.max(0,onset[f]!-mean);
 const fps=SR/HOP;let best={bpm:120,score:-1};const scores:number[]=[];
 for(let bpm=70;bpm<=180;bpm+=.5){const lag=fps*60/bpm,l0=Math.floor(lag),fr=lag-l0;let s=0;
  for(let f=0;f+l0+1<frames;f++)s+=onset[f]!*(onset[f+l0]!*(1-fr)+onset[f+l0+1]!*fr);
  s/=frames-l0;s*=Math.exp(-((Math.log2(bpm/112))**2)/(2*.5**2)); // prefer 90–130 when two tempos fit
  scores.push(s);if(s>best.score)best={bpm,score:s};}
 // A fast tempo whose half also fits well is usually the half (hi-hats double the onsets).
 if(best.bpm>140){const half=best.bpm/2,k=scores[Math.round((half-70)/.5)];if(half>=70&&k!==undefined&&k>=best.score*.45)best={bpm:half,score:k};}
 const beat=60/best.bpm,period=beat*fps;let phase=0,ph=-1;
 for(let o=0;o<period;o+=.5){let s=0;for(let t=o;t<frames;t+=period)s+=onset[Math.round(t)]??0;if(s>ph){ph=s;phase=o;}}
 // How clearly this tempo wins against tempos that are really different (not its neighbours, half or double).
 const rival=Math.max(0,...scores.filter((_,k)=>{const b=70+k*.5;return Math.abs(b-best.bpm)>8&&Math.abs(b-best.bpm/2)>6&&Math.abs(b-best.bpm*2)>6&&Math.abs(b-best.bpm*1.5)>6&&Math.abs(b-best.bpm/1.5)>6;}));
 const confidence=best.score>0?Math.min(1,Math.max(0,1-rival/best.score)):0;
 // Distinct sound events: onset peaks well above the typical level, at least 80 ms apart.
 let events=0,lastE=-1e9;const thr=Math.max(...onset)*.25;for(let f=1;f<frames-1;f++)if(onset[f]!>thr&&onset[f]!>=onset[f-1]!&&onset[f]!>=onset[f+1]!&&f-lastE>=.08*fps){events++;lastE=f;}
 return {onsetsPerSecond:Number((events/(x.length/SR)).toFixed(2)),duration:x.length/SR,bpm:Math.round(best.bpm*2)/2,beat:Number(beat.toFixed(4)),offset:Number((phase/fps).toFixed(3)),confidence:Number(confidence.toFixed(2))};
}
