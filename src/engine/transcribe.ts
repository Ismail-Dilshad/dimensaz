// Speech-to-text with word timestamps through ElevenLabs Scribe. The audio is extracted
// with FFmpeg, hashed, and every transcript is cached by that hash so the same recording
// is never sent (or billed) twice. Requires ELEVENLABS_API_KEY; nothing else calls out.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {z} from 'zod';
import {ROOT} from './config.js';
import {ffmpeg,probe} from '../renderer/ffmpeg-encoder.js';
import {languageSchema,detectLanguage,type Language} from './languages.js';

export const ENDPOINT='https://api.elevenlabs.io/v1/speech-to-text';
export const DEFAULT_MODEL=process.env.ELEVENLABS_STT_MODEL||'scribe_v2';

// ElevenLabs lists Kurdish only as `kur` (moderate accuracy tier); other codes are ISO 639-1.
const providerLanguage:Record<Language,string>={en:'en',ar:'ar',fa:'fa',ckb:'kur',kmr:'kur',badini:'kur'};

export const wordSchema=z.object({text:z.string(),start:z.number().nonnegative(),end:z.number().nonnegative(),
 type:z.enum(['word','spacing','audio_event']),speaker:z.string().optional(),logprob:z.number().optional()}).strict();
export type Word=z.infer<typeof wordSchema>;
export const transcriptSchema=z.object({version:z.literal(1),provider:z.literal('elevenlabs'),model:z.string(),source:z.string(),
 audioSha256:z.string().regex(/^[a-f0-9]{64}$/),createdAt:z.string(),language:languageSchema,providerLanguage:z.string().nullable(),
 languageProbability:z.number().nullable(),text:z.string(),words:z.array(wordSchema),reviewed:z.literal(false)}).strict();
export type Transcript=z.infer<typeof transcriptSchema>;

const responseSchema=z.object({language_code:z.string().nullable().optional(),language_probability:z.number().nullable().optional(),text:z.string(),
 words:z.array(z.object({text:z.string(),start:z.number().nullable().optional(),end:z.number().nullable().optional(),type:z.string(),
  speaker_id:z.string().nullable().optional(),logprob:z.number().nullable().optional()}).passthrough()).default([])}).passthrough();

export type TranscribeOptions={language?:Language|'auto';diarize?:boolean;keyterms?:string[];refresh?:boolean;apiKey?:string;
 fetcher?:typeof fetch;cacheDir?:string};

const cacheRoot=()=>path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','cache','transcripts');

async function extractAudio(file:string){
 const streams=(await probe(file)).streams as {codec_type:string}[];
 if(!streams.some(s=>s.codec_type==='audio'))throw new Error('This file has no sound: '+file);
 const out=path.join(ROOT,'workspace/cache/temp','stt-'+randomUUID()+'.flac');
 await fs.mkdir(path.dirname(out),{recursive:true});
 // Mono 16 kHz FLAC: lossless for speech and far smaller than the source video.
 await new Promise<void>((resolve,reject)=>{const c=spawn(ffmpeg,['-v','error','-i',file,'-vn','-ac','1','-ar','16000','-c:a','flac',out],{windowsHide:true});
  let err='';c.stderr.on('data',d=>err+=d);c.once('error',reject);c.once('close',code=>code===0?resolve():reject(new Error('Audio extraction failed: '+err)));});
 return out;
}

/** Converts the provider response; null timestamps are kept out rather than invented. */
export function fromResponse(raw:unknown,meta:{model:string;source:string;audioSha256:string;language?:Language}):Transcript{
 const r=responseSchema.parse(raw);
 const words:Word[]=[];
 for(const w of r.words){
  if(w.start==null||w.end==null||!['word','spacing','audio_event'].includes(w.type))continue;
  words.push({text:w.text,start:w.start,end:Math.max(w.start,w.end),type:w.type as Word['type'],...(w.speaker_id?{speaker:w.speaker_id}:{}),...(w.logprob!=null?{logprob:w.logprob}:{})});
 }
 const code=r.language_code??null;
 const language=meta.language??(code&&/^(kur|ku|ckb|kmr)/.test(code)?detectLanguage(r.text)==='en'?'kmr':'ckb':code?.startsWith('ar')?'ar':code?.startsWith('fa')||code==='per'?'fa':detectLanguage(r.text));
 return transcriptSchema.parse({version:1,provider:'elevenlabs',model:meta.model,source:meta.source,audioSha256:meta.audioSha256,createdAt:new Date().toISOString(),
  language,providerLanguage:code,languageProbability:r.language_probability??null,text:r.text,words,reviewed:false});
}

export function hasApiKey(){return !!process.env.ELEVENLABS_API_KEY?.trim();}

export async function transcribe(file:string,o:TranscribeOptions={}):Promise<Transcript&{cached:boolean;file:string}>{
 const source=path.resolve(file);await fs.access(source);
 const audio=await extractAudio(source);
 try{
  const bytes=await fs.readFile(audio);
  const audioSha256=createHash('sha256').update(bytes).digest('hex');
  const language=o.language&&o.language!=='auto'?o.language:undefined;
  const key=createHash('sha256').update(JSON.stringify({audioSha256,model:DEFAULT_MODEL,language:language??null,diarize:!!o.diarize,keyterms:o.keyterms??[]})).digest('hex').slice(0,24);
  const dir=o.cacheDir??cacheRoot();await fs.mkdir(dir,{recursive:true});
  const cached=path.join(dir,key+'.json');
  if(!o.refresh){try{return {...transcriptSchema.parse(JSON.parse(await fs.readFile(cached,'utf8'))),cached:true,file:cached};}catch{/* not cached */}}
  const apiKey=o.apiKey??process.env.ELEVENLABS_API_KEY?.trim();
  if(!apiKey)throw new Error('ELEVENLABS_API_KEY is not set. Add it to .env to transcribe speech (see .env.example).');
  const form=new FormData();
  form.append('model_id',DEFAULT_MODEL);
  form.append('file',new Blob([bytes],{type:'audio/flac'}),path.basename(audio));
  form.append('timestamps_granularity','word');
  form.append('tag_audio_events','true');
  form.append('diarize',o.diarize?'true':'false');
  if(language)form.append('language_code',providerLanguage[language]);
  for(const term of o.keyterms??[])form.append('keyterms',term);
  const response=await (o.fetcher??fetch)(ENDPOINT,{method:'POST',headers:{'xi-api-key':apiKey},body:form});
  const body=await response.text();
  if(!response.ok)throw new Error(`ElevenLabs speech-to-text failed (${response.status}): ${body.slice(0,500)}`);
  const transcript=fromResponse(JSON.parse(body),{model:DEFAULT_MODEL,source,audioSha256,language});
  await fs.writeFile(cached,JSON.stringify(transcript,null,1)+'\n');
  return {...transcript,cached:false,file:cached};
 }finally{await fs.rm(audio,{force:true});}
}

export async function readTranscript(file:string){return transcriptSchema.parse(JSON.parse(await fs.readFile(file,'utf8')));}
