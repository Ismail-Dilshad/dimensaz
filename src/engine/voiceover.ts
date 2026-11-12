// ElevenLabs voice-over (text to speech), only when the user asks for it. Returns the audio
// and word timings from ElevenLabs' character alignment, saved as a voice alignment that
// video:create accepts (`voiceover` + `wordAlignment`), so motion lands on the spoken words.
// Results are cached by text, voice, model and settings, so the same line is never paid for twice.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {ROOT} from './config.js';

export const TTS_BASE='https://api.elevenlabs.io/v1';
export const DEFAULT_TTS_MODEL=process.env.ELEVENLABS_TTS_MODEL||'eleven_multilingual_v2';

const alignmentSchema=z.object({characters:z.array(z.string()),character_start_times_seconds:z.array(z.number()),character_end_times_seconds:z.array(z.number())}).passthrough();
const responseSchema=z.object({audio_base64:z.string().min(1),alignment:alignmentSchema.nullable().optional(),normalized_alignment:alignmentSchema.nullable().optional()}).passthrough();
export type VoiceoverOptions={voiceId?:string;model?:string;language?:string;stability?:number;similarity?:number;style?:number;speed?:number;out?:string;refresh?:boolean;apiKey?:string;fetcher?:typeof fetch};
type Word={text:string;start:number;end:number};

const key=(o:VoiceoverOptions)=>o.apiKey??process.env.ELEVENLABS_API_KEY?.trim();
const need=(o:VoiceoverOptions)=>{const k=key(o);if(!k)throw new Error('ELEVENLABS_API_KEY is not set. Add it to .env to make voice-overs (see .env.example).');return k;};

/** Groups ElevenLabs' character timings into words (whitespace splits words). */
export function wordsFromAlignment(a:z.infer<typeof alignmentSchema>):Word[]{
 const words:Word[]=[];let text='',start=0,end=0;
 a.characters.forEach((ch,i)=>{
  if(/\s/.test(ch)){if(text){words.push({text,start,end});text='';}return;}
  if(!text)start=a.character_start_times_seconds[i]??end;
  text+=ch;end=Math.max(start,a.character_end_times_seconds[i]??end);
 });
 if(text)words.push({text,start,end});
 return words.map(w=>({...w,end:w.end>w.start?w.end:w.start+.05}));
}

export async function listVoices(o:VoiceoverOptions={}){
 const r=await (o.fetcher??fetch)(`${TTS_BASE}/voices`,{headers:{'xi-api-key':need(o)}});
 const body=await r.text();if(!r.ok)throw new Error(`ElevenLabs voices failed (${r.status}): ${body.slice(0,300)}`);
 const d=JSON.parse(body) as {voices:{voice_id:string;name:string;category?:string;labels?:Record<string,string>;preview_url?:string}[]};
 return d.voices.map(v=>({id:v.voice_id,name:v.name,category:v.category??null,labels:v.labels??{},preview:v.preview_url??null}));
}

/** Makes a voice-over MP3 and its word timings. */
export async function synthesize(text:string,o:VoiceoverOptions={}){
 const clean=text.replace(/\r\n/g,'\n').trim();
 if(!clean)throw new Error('The voice-over text is empty');
 if(clean.length>5000)throw new Error('Text is over 5,000 characters; split it into parts');
 const voiceId=o.voiceId??process.env.ELEVENLABS_VOICE_ID?.trim();
 if(!voiceId)throw new Error('Choose a voice: --voice VOICE_ID (list them with pnpm tempoloom media voices) or set ELEVENLABS_VOICE_ID in .env');
 const model=o.model??DEFAULT_TTS_MODEL;
 const settings={stability:o.stability??.5,similarity_boost:o.similarity??.75,style:o.style??0,use_speaker_boost:true,...(o.speed?{speed:o.speed}:{})};
 const id=createHash('sha256').update(JSON.stringify({clean,voiceId,model,settings,language:o.language??null})).digest('hex').slice(0,20);
 const dir=path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','cache','voiceovers');await fs.mkdir(dir,{recursive:true});
 const cachedMp3=path.join(dir,id+'.mp3'),cachedJson=path.join(dir,id+'.json');
 let cached=false;
 if(!o.refresh&&await fs.access(cachedMp3).then(()=>true,()=>false)&&await fs.access(cachedJson).then(()=>true,()=>false))cached=true;
 else{
  const body={text:clean,model_id:model,voice_settings:settings,...(o.language?{language_code:o.language}:{})};
  const r=await (o.fetcher??fetch)(`${TTS_BASE}/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`,
   {method:'POST',headers:{'xi-api-key':need(o),'content-type':'application/json',accept:'application/json'},body:JSON.stringify(body)});
  const raw=await r.text();
  if(!r.ok)throw new Error(`ElevenLabs text-to-speech failed (${r.status}): ${raw.slice(0,400)}`);
  const d=responseSchema.parse(JSON.parse(raw));
  const audio=Buffer.from(d.audio_base64,'base64');
  const align=d.alignment??d.normalized_alignment;
  if(!align)throw new Error('ElevenLabs returned no timing for this voice-over');
  const words=wordsFromAlignment(align);
  await fs.writeFile(cachedMp3,audio);
  await fs.writeFile(cachedJson,JSON.stringify({version:1,provider:'elevenlabs',model,voiceId,text:clean,words,createdAt:new Date().toISOString()},null,1)+'\n');
 }
 const meta=JSON.parse(await fs.readFile(cachedJson,'utf8')) as {words:Word[];model:string};
 const audioSha256=createHash('sha256').update(await fs.readFile(cachedMp3)).digest('hex');
 // Copy to the requested place (never overwriting) and write the alignment video:create uses.
 const outMp3=o.out?path.resolve(o.out):path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','voiceovers',`voiceover-${id}.mp3`);
 await fs.mkdir(path.dirname(outMp3),{recursive:true});
 if(!await fs.access(outMp3).then(()=>true,()=>false))await fs.copyFile(cachedMp3,outMp3);
 const alignmentFile=outMp3.replace(/\.mp3$/i,'')+'.alignment.json';
 const alignment={audioSha256,method:'provider',source:`elevenlabs text-to-speech ${meta.model}, voice ${voiceId}`,reviewed:true,words:meta.words};
 await fs.writeFile(alignmentFile,JSON.stringify(alignment,null,1)+'\n');
 const duration=meta.words.at(-1)?.end??0;
 return {audio:outMp3,alignment:alignmentFile,words:meta.words.length,durationSeconds:Number(duration.toFixed(2)),cached,voiceId,model:meta.model,
  next:'Use it in a request: "voiceover": "<audio>", "wordAlignment": <contents of the alignment file>; listen before rendering.'};
}
