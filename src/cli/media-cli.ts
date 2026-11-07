// Media tools: silence, scenes, beats, reframe, cutout (Python, media_tools/), plus setup and doctor.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {runPythonModule} from '../engine/audio-analysis.js';
import {ROOT} from '../engine/config.js';
import {ffmpeg} from '../renderer/ffmpeg-encoder.js';
import {renderLottie,lottieInfo,formats,type LottieFormat} from '../renderer/lottie.js';

const usage=`Usage: reelwright media <command> [options]

  setup                         Install the media tools into the project .venv
  doctor                        Show which media tools are installed
  silence FILE [--threshold 0.04] [--margin 0.2] [--min-cut 0.3] [--edl-out EDIT.json]
                                Find silences to cut (auto-editor)
  scenes FILE [--min-shot 0.4] [--content]
                                Find shots and cuts, and the editing rhythm (PySceneDetect)
  beats FILE [--per-bar 4]      Tempo, beats, bar starts and onsets of the music (librosa)
  reframe FILE [--aspect 9:16] [--allow-download] [--edl-out EDIT.json]
                                Where the speaker's face is, for cropping (MediaPipe)
  cutout IMAGE... [--model birefnet-general-lite] [--out-dir DIR] [--allow-download]
                                Remove image backgrounds (rembg with BiRefNet)
  separate FILE [--stems vocals|all] [--model htdemucs] [--out-dir DIR] [--allow-download]
                                Split voice from music and noise (Demucs)
  quality FILE                  Sharpness, exposure, contrast and noise of a video or image (OpenCV)
  motion FILE                   Camera pans, zoom and shake (OpenCV)
  stabilize FILE [--out FILE] [--smoothing 1.0] [--zoom 1.06]
                                Write a stabilized copy, audio kept (OpenCV)
  lottie FILE.json [--format mov|webm|png|mp4] [--scale 1 | --width PX] [--fps N] [--loops N] [--background #RRGGBB] [--out FILE]
                                Render a Lottie animation with transparency (lottie-web)
  lottie-info FILE.json         Size, length, frame rate and features of a Lottie file

Every command prints JSON; the Python ones also accept --output FILE. Inputs are never changed.`;

const audioExtensions=new Set(['.wav','.flac','.ogg','.mp3']);

// The Python audio tools read audio files only; pull a WAV out of video files first.
async function audioCopy(file:string,{channels=1,rate=22050,always=false}={}){
 if(!always&&audioExtensions.has(path.extname(file).toLowerCase()))return {file,cleanup:async()=>{}};
 const out=path.join(ROOT,'workspace/cache/temp','audio-'+randomUUID()+'.wav');
 await fs.mkdir(path.dirname(out),{recursive:true});
 await new Promise<void>((resolve,reject)=>{const c=spawn(ffmpeg,['-v','error','-i',file,'-vn','-ac',String(channels),'-ar',String(rate),out],{windowsHide:true});
  let err='';c.stderr.on('data',d=>err+=d);c.once('error',reject);c.once('close',code=>code===0?resolve():reject(new Error('Audio extraction failed: '+err)));});
 return {file:out,cleanup:()=>fs.rm(out,{force:true})};
}

export async function runMedia(argv:string[]):Promise<unknown>{
 const [command,...rest]=argv;
 if(!command||command==='help'||command==='--help')return {usage};
 const run=(args:string[],timeoutMs=60*60*1000)=>runPythonModule('media_tools.cli',args,{timeoutMs,label:'Media tool '+command,env:{FFMPEG_PATH:ffmpeg}});
 const flag=(name:string)=>{const i=rest.indexOf(name);return i<0?undefined:rest[i+1];};
 const number=(name:string)=>{const v=flag(name);if(v===undefined)return undefined;const x=Number(v);if(!Number.isFinite(x))throw new Error(name+' must be a number');return x;};
 const resolveInput=(i:number)=>{const a=[...rest];if(a[i]&&!a[i].startsWith('--'))a[i]=path.resolve(a[i]);return a;};
 switch(command){
  case 'doctor':return run(['doctor'],120000);
  case 'setup':return run(['setup']);
  case 'silence':case 'scenes':case 'reframe':case 'quality':case 'motion':return run([command,...resolveInput(0)]);
  case 'stabilize':{const a=resolveInput(0);const i=a.indexOf('--out');if(i>=0&&a[i+1])a[i+1]=path.resolve(a[i+1]);return run(['stabilize',...a]);}
  case 'separate':{
   if(!rest[0]||rest[0].startsWith('--'))throw new Error('Usage: reelwright media separate FILE');
   const original=path.resolve(rest[0]);
   const audio=await audioCopy(original,{channels:2,rate:44100,always:path.extname(original).toLowerCase()!=='.wav'});
   const extra=rest.slice(1);const o=extra.indexOf('--out-dir');if(o>=0&&extra[o+1])extra[o+1]=path.resolve(extra[o+1]);
   if(o<0)extra.push('--out-dir',path.dirname(original));
   try{const result=await run(['separate',audio.file,'--name',original,...extra]) as Record<string,unknown>;return {...result,input:original};}
   finally{await audio.cleanup();}
  }
  case 'lottie-info':{if(!rest[0])throw new Error('Usage: reelwright media lottie-info FILE.json');return lottieInfo(path.resolve(rest[0]));}
  case 'lottie':{
   if(!rest[0]||rest[0].startsWith('--'))throw new Error('Usage: reelwright media lottie FILE.json [--format mov|webm|png|mp4]');
   const format=flag('--format');if(format&&!(formats as readonly string[]).includes(format))throw new Error('--format must be one of '+formats.join(', '));
   return renderLottie(path.resolve(rest[0]),{format:format as LottieFormat|undefined,out:flag('--out'),scale:number('--scale'),width:number('--width'),fps:number('--fps'),
    loops:number('--loops'),background:flag('--background')});
  }
  case 'beats':{
   if(!rest[0]||rest[0].startsWith('--'))throw new Error('Usage: reelwright media beats FILE');
   const audio=await audioCopy(path.resolve(rest[0]));
   try{const result=await run(['beats',audio.file,...rest.slice(1)]) as Record<string,unknown>;return {...result,input:path.resolve(rest[0])};}
   finally{await audio.cleanup();}
  }
  case 'cutout':return run(['cutout',...rest.map(a=>a.startsWith('--')||!/\.(png|jpe?g|webp|bmp|tiff?)$/i.test(a)?a:path.resolve(a))]);
  default:throw new Error('Unknown media command: '+command+'\n\n'+usage);
 }
}

if(process.argv[1]&&path.resolve(process.argv[1]).endsWith(path.join('cli','media-cli.ts'))){
 try{const result=await runMedia(process.argv.slice(2));
  if(result&&typeof result==='object'&&'usage' in result)console.log((result as {usage:string}).usage);
  else console.log(JSON.stringify(result,null,2));}
 catch(error){console.error(error instanceof Error?error.message:String(error));process.exit(1);}
}
