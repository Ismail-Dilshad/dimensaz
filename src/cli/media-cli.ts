// Media tools: silence, scenes, beats, reframe, cutout (Python, media_tools/), plus setup and doctor.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {runPythonModule} from '../engine/audio-analysis.js';
import {ROOT} from '../engine/config.js';
import {ffmpeg} from '../renderer/ffmpeg-encoder.js';

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

Every command prints JSON and accepts --output FILE. Inputs are never changed.`;

const audioExtensions=new Set(['.wav','.flac','.ogg','.mp3']);

// librosa reads audio files only; pull a mono WAV out of video files first.
async function audioCopy(file:string){
 if(audioExtensions.has(path.extname(file).toLowerCase()))return {file,cleanup:async()=>{}};
 const out=path.join(ROOT,'workspace/cache/temp','beats-'+randomUUID()+'.wav');
 await fs.mkdir(path.dirname(out),{recursive:true});
 await new Promise<void>((resolve,reject)=>{const c=spawn(ffmpeg,['-v','error','-i',file,'-vn','-ac','1','-ar','22050',out],{windowsHide:true});
  let err='';c.stderr.on('data',d=>err+=d);c.once('error',reject);c.once('close',code=>code===0?resolve():reject(new Error('Audio extraction failed: '+err)));});
 return {file:out,cleanup:()=>fs.rm(out,{force:true})};
}

export async function runMedia(argv:string[]):Promise<unknown>{
 const [command,...rest]=argv;
 if(!command||command==='help'||command==='--help')return {usage};
 const run=(args:string[],timeoutMs=60*60*1000)=>runPythonModule('media_tools.cli',args,{timeoutMs,label:'Media tool '+command});
 const resolveInput=(i:number)=>{const a=[...rest];if(a[i]&&!a[i].startsWith('--'))a[i]=path.resolve(a[i]);return a;};
 switch(command){
  case 'doctor':return run(['doctor'],120000);
  case 'setup':return run(['setup']);
  case 'silence':case 'scenes':case 'reframe':return run([command,...resolveInput(0)]);
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
