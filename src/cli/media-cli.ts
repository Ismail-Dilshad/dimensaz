// Media tools: silence, scenes, beats, reframe, cutout (Python, media_tools/), plus setup and doctor.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {runPythonModule} from '../engine/audio-analysis.js';
import {ROOT} from '../engine/config.js';
import {ffmpeg,probe} from '../renderer/ffmpeg-encoder.js';
import {renderLottie,lottieInfo,formats,type LottieFormat} from '../renderer/lottie.js';
import {transcribe} from '../engine/transcribe.js';
import {languageInputSchema,resolveLanguage} from '../engine/languages.js';
import {captionsFromWords} from '../editor/caption-builder.js';
import {writeSrt} from '../editor/srt.js';
import {writeVtt} from '../editor/subtitles.js';
import {planTighten,tightenEdl} from '../editor/tighten.js';
import {mediaInfo} from '../editor/editor.js';
import {scanBrand} from '../engine/brand-scan.js';
import {exportFormats,makeThumbnail,formatNames,type FormatName} from '../editor/finishing.js';
import {synthesize,listVoices} from '../engine/voiceover.js';

async function freeFile(file:string){const ext=path.extname(file),stem=file.slice(0,file.length-ext.length);
 for(let i=1;;i++){const f=i===1?file:`${stem}-${i}${ext}`;try{await fs.access(f);}catch{return f;}}}

const usage=`Usage: tempoloom media <command> [options]

  setup                         Install the media tools into the project .venv
  doctor                        Show which media tools are installed
  download [all|face|cutout|separation]
                                Download models only (about 305 MB for all; once)
  silence FILE [--threshold 0.04] [--margin 0.2] [--min-cut 0.3] [--edl-out EDIT.json]
                                Find silences to cut (auto-editor)
  scenes FILE [--min-shot 0.4] [--content]
                                Find shots and cuts, and the editing rhythm (PySceneDetect)
  beats FILE [--per-bar 4]      Tempo, beats, bar starts and onsets of the music (librosa)
  reframe FILE [--aspect 9:16] [--follow] [--allow-download] [--edl-out EDIT.json]
                                Where the speaker's face is, for cropping (MediaPipe); --follow: a crop that
                                glides with the speaker over time instead of one place
  cutout IMAGE... [--model birefnet-general-lite] [--out-dir DIR] [--allow-download]
                                Remove image backgrounds (rembg with BiRefNet)
  separate FILE [--stems vocals|all] [--model htdemucs] [--out-dir DIR] [--allow-download]
                                Split voice from music and noise (Demucs)
  quality FILE                  Sharpness, exposure, contrast and noise of a video or image (OpenCV)
  motion FILE                   Camera pans, zoom and shake (OpenCV)
  pacing FILE [--max-static 1.5] [--max-plain 1.0]
                                Fail on stretches with no movement or plain text-on-background frames
  stabilize FILE [--out FILE] [--smoothing 1.0] [--zoom 1.06]
                                Write a stabilized copy, audio kept (OpenCV)
  lottie FILE.json [--format mov|webm|png|mp4] [--scale 1 | --width PX] [--fps N] [--loops N] [--background #RRGGBB] [--out FILE]
                                Render a Lottie animation with transparency (lottie-web)
  lottie-info FILE.json         Size, length, frame rate and features of a Lottie file
  brand-scan URL [--download]   A product's logo candidates, theme colour, CSS colours and fonts from its website;
                                --download saves the logo files to workspace/research/<site>/
  style FILE... [--name NAME] [--save [--title T]]
                                Reference style brief (palette roles, cut rhythm, motion, easing); --save adds it
                                to references/styles as a reusable style (frames kept, videos become a motion sheet)
  transcribe FILE [--language auto|en|ckb|kmr|ar|fa] [--diarize] [--keyterm WORD]... [--refresh]
                                Word-timed transcript (ElevenLabs; needs ELEVENLABS_API_KEY)
  captions FILE [--script SCRIPT.txt] [--language L] [--out FILE.srt]
                                SRT captions from speech; with --script the text is exactly your script
  formats FILE --to 1:1,16:9[,9:16,4:5] [--mode auto|crop|fit] [--focus-x 0.5] [--focus-y 0.45] [--background blur|#RRGGBB] [--out-dir DIR]
                                The master in other shapes: narrower ones crop around the focus (face), wider ones
                                fit the whole frame over a blurred copy, so nothing is cut off
  thumbnail FILE [--title "TEXT"] [--at SECONDS] [--size 16:9|9:16|1:1] [--no-logo] [--out FILE]
                                Picks the sharpest settled frame (or --at), adds the title and logo: PNG and JPEG
  voiceover (--text "TEXT" | --file SCRIPT.txt) [--voice ID] [--model ID] [--language CODE] [--speed 1.0] [--out FILE.mp3]
                                ElevenLabs voice-over with word timings (only when the user asks; needs ELEVENLABS_API_KEY)
  voices                        ElevenLabs voices available to your key
  tighten FILE [--max-pause 0.6] [--no-fillers] [--captions] [--script SCRIPT.txt] [--brand] [--edl-out EDIT.json]
                                Edit list that removes pauses, filler words and dead air (review, then edit)

Every command prints JSON; the Python ones also accept --output FILE. Inputs are never changed.`;

const audioExtensions=new Set(['.wav','.flac','.ogg','.mp3']);

// The Python audio tools read audio files only; pull a WAV out of video files first.
async function audioCopy(file:string,{channels=1,rate=22050,always=false}={}){
 if(!always&&audioExtensions.has(path.extname(file).toLowerCase()))return {file,cleanup:async()=>{}};
 const streams=(await probe(file)).streams as {codec_type:string}[];
 if(!streams.some(s=>s.codec_type==='audio'))throw new Error('This file has no sound: '+file+'\nChoose a video or audio file with a voice or music.');
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
  case 'download':return run(['download',...rest.slice(0,1)]);
  case 'reframe':{
   // --follow: the crop glides with the speaker instead of one place for the whole video.
   const follow=rest.includes('--follow'),args=resolveInput(0).filter(x=>x!=='--follow');
   const r=await run(['reframe',...args]) as {track?:import('../editor/follow.js').TrackPoint[];durationSeconds?:number|null;aspect?:string;edlOperation?:Record<string,unknown>|null};
   if(!follow||!r.track||!r.edlOperation)return r;
   const {followPath}=await import('../editor/follow.js'),{cropOf}=await import('../editor/text-edit.js'),info=await mediaInfo(String(args[0]));
   const path_=followPath(r.track,{crop:cropOf(info.width,info.height,(r.aspect??'9:16') as '9:16'),duration:info.duration});
   return {...r,edlOperation:{...r.edlOperation,follow:path_},note:path_.length?'edlOperation follows the speaker; put it in an edit list (edit --edl), or use edit text DOC --shape 9:16.':'No face was found to follow; the crop stays where it is.'};}
  case 'silence':case 'scenes':case 'quality':case 'motion':case 'pacing':return run([command,...resolveInput(0)]);
  case 'stabilize':{const a=resolveInput(0);const i=a.indexOf('--out');if(i>=0&&a[i+1])a[i+1]=path.resolve(a[i+1]);return run(['stabilize',...a]);}
  case 'separate':{
   if(!rest[0]||rest[0].startsWith('--'))throw new Error('Usage: tempoloom media separate FILE');
   const original=path.resolve(rest[0]);
   const audio=await audioCopy(original,{channels:2,rate:44100,always:path.extname(original).toLowerCase()!=='.wav'});
   const extra=rest.slice(1);const o=extra.indexOf('--out-dir');if(o>=0&&extra[o+1])extra[o+1]=path.resolve(extra[o+1]);
   if(o<0)extra.push('--out-dir',path.dirname(original));
   try{const result=await run(['separate',audio.file,'--name',original,...extra]) as Record<string,unknown>;return {...result,input:original};}
   finally{await audio.cleanup();}
  }
  case 'style':return run(['style',...rest.map((a,i)=>a.startsWith('--')||['--name','--title','--max-frames'].includes(rest[i-1])?a:path.resolve(a))]);
  case 'transcribe':case 'captions':case 'tighten':{
   if(!rest[0]||rest[0].startsWith('--'))throw new Error('Usage: tempoloom media '+command+' FILE');
   const file=path.resolve(rest[0]);
   const all=(name:string)=>rest.flatMap((a,i)=>a===name&&rest[i+1]?[rest[i+1]]:[]);
   const scriptFile=flag('--script'),script=scriptFile?await fs.readFile(path.resolve(scriptFile),'utf8'):undefined;
   const language=languageInputSchema.parse(flag('--language')??(script?resolveLanguage('auto',script):'auto'));
   const t=await transcribe(file,{language,diarize:rest.includes('--diarize'),keyterms:all('--keyterm'),refresh:rest.includes('--refresh')});
   const summary={transcript:t.file,cached:t.cached,language:t.language,providerLanguage:t.providerLanguage,languageProbability:t.languageProbability,
    words:t.words.filter(w=>w.type==='word').length,events:t.words.filter(w=>w.type==='audio_event').map(w=>w.text)};
   if(command==='transcribe')return {...summary,text:t.text};
   const caps=captionsFromWords(t.words,{script,language:t.language});
   if(command==='captions'){
    const out=await freeFile(flag('--out')?path.resolve(flag('--out')!):file.replace(/\.[^.]+$/,'')+'.srt');
    await fs.writeFile(out,writeSrt(caps.cues),{flag:'wx'});
    const vtt=await freeFile(out.replace(/\.srt$/i,'')+'.vtt');await fs.writeFile(vtt,writeVtt(caps.cues,t.language),{flag:'wx'});
    return {...summary,srt:out,vtt,cues:caps.cues.length,captionText:caps.source,...(script?{matchedWords:caps.matchedWords,scriptWords:caps.scriptWords,unmatched:caps.unmatched.slice(0,30)}:{}),
     note:caps.source==='transcript'?'Text is the recogniser output: proofread it, especially Kurdish (moderate accuracy).':'Text is your script; timing comes from recognised words. Check cues around unmatched words.'};
   }
   const info=await mediaInfo(file);
   const plan=planTighten(t.words,info.duration,t.language,{maxPause:number('--max-pause'),fillers:!rest.includes('--no-fillers')});
   const edl=tightenEdl(file,plan.cuts,rest.includes('--captions')?{cues:caps.cues,language:t.language}:undefined) as {version:1;input:string;operations:unknown[]};
   if(rest.includes('--brand'))edl.operations.push({op:'brand'});
   const out=await freeFile(flag('--edl-out')?path.resolve(flag('--edl-out')!):file.replace(/\.[^.]+$/,'')+'.tighten.json');
   await fs.writeFile(out,JSON.stringify(edl,null,1)+'\n',{flag:'wx'});
   return {...summary,edl:out,durationSeconds:Number(info.duration.toFixed(3)),resultSeconds:plan.resultSeconds,removedSeconds:plan.removedSeconds,
    fillersRemoved:plan.fillerCount,cuts:plan.cuts,next:'Review the cuts, then: pnpm tempoloom edit --edl '+out};
  }
  case 'formats':{
   if(!rest[0]||rest[0].startsWith('--'))throw new Error('Usage: tempoloom media formats FILE --to 1:1,16:9');
   const to=(flag('--to')??'9:16,1:1,16:9').split(',').map(s=>s.trim()) as FormatName[];
   const bad=to.filter(t=>!formatNames.includes(t));if(bad.length)throw new Error('Unknown format: '+bad.join(', ')+'. Use '+formatNames.join(', '));
   const mode=flag('--mode') as 'auto'|'crop'|'fit'|undefined;
   return exportFormats(rest[0],{to,mode,focusX:number('--focus-x'),focusY:number('--focus-y'),background:flag('--background'),outDir:flag('--out-dir')});
  }
  case 'thumbnail':{
   if(!rest[0]||rest[0].startsWith('--'))throw new Error('Usage: tempoloom media thumbnail FILE [--title TEXT]');
   const size=flag('--size') as '16:9'|'9:16'|'1:1'|undefined;if(size&&!['16:9','9:16','1:1'].includes(size))throw new Error('--size must be 16:9, 9:16 or 1:1');
   return makeThumbnail(rest[0],{title:flag('--title'),at:number('--at'),size,logo:!rest.includes('--no-logo'),out:flag('--out')});
  }
  case 'voiceover':{
   const file=flag('--file'),text=file?await fs.readFile(path.resolve(file),'utf8'):flag('--text');
   if(!text)throw new Error('Usage: tempoloom media voiceover --text "..." | --file SCRIPT.txt [--voice ID]');
   return synthesize(text,{voiceId:flag('--voice'),model:flag('--model'),language:flag('--language'),speed:number('--speed'),out:flag('--out'),refresh:rest.includes('--refresh')});
  }
  case 'voices':return listVoices();
  case 'brand-scan':{if(!rest[0]||rest[0].startsWith('--'))throw new Error('Usage: tempoloom media brand-scan URL [--download]');
   return scanBrand(/^https?:\/\//.test(rest[0])?rest[0]:'https://'+rest[0],{download:rest.includes('--download')});}
  case 'lottie-info':{if(!rest[0])throw new Error('Usage: tempoloom media lottie-info FILE.json');return lottieInfo(path.resolve(rest[0]));}
  case 'lottie':{
   if(!rest[0]||rest[0].startsWith('--'))throw new Error('Usage: tempoloom media lottie FILE.json [--format mov|webm|png|mp4]');
   const format=flag('--format');if(format&&!(formats as readonly string[]).includes(format))throw new Error('--format must be one of '+formats.join(', '));
   return renderLottie(path.resolve(rest[0]),{format:format as LottieFormat|undefined,out:flag('--out'),scale:number('--scale'),width:number('--width'),fps:number('--fps'),
    loops:number('--loops'),background:flag('--background')});
  }
  case 'beats':{
   if(!rest[0]||rest[0].startsWith('--'))throw new Error('Usage: tempoloom media beats FILE');
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
