import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import {ROOT} from './config.js';
import {load,dir,inside,revise,save,writeJSON} from './project.js';
import {words} from './rtl-layout.js';
import {applyWordAlignment,validateWordAlignment} from './voice-alignment.js';
import {reviewHTML} from '../components/AlignmentReview.js';
import type {Project} from './schema.js';

export const audioAnalysisSchema=z.object({
 schemaVersion:z.literal(1),script:z.string(),audioSha256:z.string().regex(/^[a-f0-9]{64}$/),
 audioFile:z.string(),duration:z.number().positive(),sampleRate:z.number().positive(),
 backend:z.object({name:z.string()}).passthrough(),reviewed:z.boolean(),
 confidenceMeaning:z.string(),errors:z.array(z.unknown()),waveform:z.array(z.number().finite()),
 pauses:z.array(z.object({start:z.number().nonnegative(),end:z.number().positive(),duration:z.number().positive()})),
 sentences:z.array(z.object({id:z.number(),text:z.string(),firstWord:z.number(),lastWord:z.number(),start:z.number().nullable(),end:z.number().nullable()})),
 words:z.array(z.object({index:z.number().int().nonnegative(),text:z.string(),from:z.number().int().nonnegative(),to:z.number().int().positive(),
  originalWord:z.string().optional(),normalizedWord:z.string().optional(),sentenceId:z.number().int().positive().optional(),alignmentMethod:z.string().optional(),reviewRequired:z.boolean().optional(),
  start:z.number().nonnegative().nullable(),end:z.number().positive().nullable(),confidence:z.number().min(0).max(1).nullable(),
  flags:z.array(z.string()),reviewed:z.boolean(),reviewer:z.string().nullable()}))
});
export type AudioAnalysis=z.infer<typeof audioAnalysisSchema>;
export async function runAudioPython(args:string[], timeoutMs=45*60*1000):Promise<unknown>{
 const executable=process.env.VIDEO_PYTHON||path.join(ROOT,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
 await fs.access(executable).catch(()=>{throw new Error('Project .venv Python is unavailable: '+executable);});
 const cacheArg=args.indexOf('--cache');const modelHome=path.resolve(cacheArg>=0?args[cacheArg+1]:(process.env.VIDEO_MODEL_DIR||path.join(ROOT,'workspace/cache/audio-models')));
 const temp=path.join(ROOT,'workspace/cache/temp');await fs.mkdir(temp,{recursive:true});
 return new Promise((resolve,reject)=>{
  const child=spawn(executable,['-m','audio_pipeline.cli',...args],{cwd:ROOT,windowsHide:true,
   env:{...process.env,TMP:temp,TEMP:temp,HF_HOME:path.join(modelHome,'hub-home'),HF_HUB_CACHE:path.join(modelHome,'hub'),HF_XET_CACHE:path.join(modelHome,'xet'),HF_HUB_DISABLE_TELEMETRY:'1',PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8'},stdio:['ignore','pipe','pipe']});
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  let out='',err='';const timeout=setTimeout(()=>{child.kill();reject(new Error('Audio operation timed out; model/cache state retained'));},timeoutMs);
  child.stdout.on('data',chunk=>{out+=chunk;if(out.length>16*1024*1024){child.kill();reject(new Error('Python protocol output exceeds limit'));}});
  child.stderr.on('data',chunk=>err=(err+chunk).slice(-16000));
  child.once('error',error=>{clearTimeout(timeout);reject(error);});
  child.once('close',code=>{clearTimeout(timeout);if(code!==0)return reject(new Error('Audio pipeline failed: '+err));try{resolve(JSON.parse(out));}catch{reject(new Error('Invalid Python JSON protocol: '+err));}});
 });
}
export async function readAudioAnalysis(file:string){
 const a=audioAnalysisSchema.parse(JSON.parse(await fs.readFile(file,'utf8')));
 if(a.sentences.map(s=>s.text).join('')!==a.script)throw new Error('Sentence grouping changed the exact script');
 const tokens=words(a.script);
 if(tokens.length!==a.words.length||a.words.some((w,i)=>w.index!==i||w.text!==tokens[i].text||(w.originalWord!==undefined&&w.originalWord!==w.text)||w.from!==tokens[i].start||w.to!==tokens[i].end))throw new Error('Analysis changed the exact script or word offsets');
 return a;
}
export function analysisToAlignment(a:AudioAnalysis){
 if(!a.words.length||a.words.some(w=>!w.reviewed||!w.reviewer?.trim()||w.start===null||w.end===null))throw new Error('Review/correct every word before applying; unresolved timings cannot be interpolated.');
 const evidence={audioSha256:a.audioSha256,method:'manual-review' as const,source:'Reviewed local '+a.backend.name+' analysis',reviewed:true as const,
  words:a.words.map(w=>({text:w.text,start:w.start!,end:w.end!}))};
 return validateWordAlignment(a.script,evidence,a.duration);
}
export async function analyzeProjectAudio(p:Project,options:{backend?:'auto'|'ctc'|'whisper'|'pauses';model?:string;download?:boolean;refresh?:boolean;device?:'auto'|'cpu'|'cuda';computeType?:string;chunkSeconds?:number}={}){
 const voices=p.media.filter(m=>m.kind==='voice');
 if(voices.length!==1||voices[0].at!==0)throw new Error('Audio analysis currently requires one voiceover starting at zero');
 const cacheFile=path.join(dir(p.id,p.config),'audio-analysis-cache.json');
 const {audioHash}=await import('./voice-alignment.js');
 const modelRoot=path.resolve(process.env.VIDEO_MODEL_DIR||path.join(ROOT,'workspace/cache/audio-models'));
 const key=createHash('sha256').update(JSON.stringify({script:p.script,language:p.config.language,audio:await audioHash(p),modelRoot,python:process.env.VIDEO_PYTHON,options}));
 for(const name of (await fs.readdir(path.join(modelRoot,'installed')).catch(()=>[])).sort())if(name.endsWith('.json'))key.update(await fs.readFile(path.join(modelRoot,'installed',name)));
 const environment=await runAudioPython(['identity','--cache',modelRoot]);key.update(JSON.stringify(environment));
 for(const file of ['audio_pipeline/core.py','audio_pipeline/backends.py','audio_pipeline/cli.py','audio_pipeline/setup.py','audio_pipeline/hardware.py','config/speech-models.json'])key.update(await fs.readFile(path.join(ROOT,file)));
 const digest=key.digest('hex');
 if(!options.refresh){try{const cached=JSON.parse(await fs.readFile(cacheFile,'utf8'));if(cached.key===digest){const analysis=await readAudioAnalysis(cached.result.file);await fs.access(cached.result.review);if(!analysis.errors.length)return cached.result as {file:string;review:string;summary:unknown};}}catch{}}
 const base=path.join(dir(p.id,p.config),'audio-analysis',randomUUID());await fs.mkdir(base,{recursive:true});
 const script=path.join(base,'source-script.txt'),file=path.join(base,'alignment.json');await fs.writeFile(script,p.script,'utf8');
 const args=['analyze','--audio',inside(dir(p.id,p.config),voices[0].path),'--script',script,'--output',file,'--backend',options.backend||'auto','--language',p.config.language,'--cache',modelRoot];
 if(options.device)args.push('--device',options.device);if(options.computeType)args.push('--compute-type',options.computeType);if(options.chunkSeconds!==undefined)args.push('--chunk-seconds',String(options.chunkSeconds));
 if(options.model)args.push('--model',options.model);if(options.download)args.push('--allow-download');
 const summary=await runAudioPython(args),analysis=await readAudioAnalysis(file);
 const review=path.join(base,'review.html');await fs.writeFile(review,reviewHTML(analysis,path.relative(base,analysis.audioFile).replaceAll('\\','/')),'utf8');
 await writeJSON(path.join(base,'summary.json'),summary);
 const result={file,review,summary};if(!analysis.errors.length)await writeJSON(cacheFile,{key:digest,result});return result;
}
export async function applyAudioAnalysis(id:string,file:string){
 const original=await load(id),a=await readAudioAnalysis(file);
 if(a.script!==original.script)throw new Error('Analysis script differs from the authoritative project script');
 const evidence=analysisToAlignment(a);
 // Check the voice hash before reserving a new revision.
 const {audioHash}=await import('./voice-alignment.js');
 if(evidence.audioSha256!==await audioHash(original))throw new Error('Analysis belongs to different audio');
 const p=await revise(id);await applyWordAlignment(p,evidence);await save(p);
 await writeJSON(path.join(dir(p.id,p.config),'alignment-reviewed.json'),a);
 return {project:p.id,words:evidence.words.length,voiceTiming:p.config.voiceTiming};
}
