// One command from a script to a finished video: storyboard (visuals and a style designed from
// zero), an ElevenLabs voice-over with word timings when asked, the video job, its preview with
// quality checks, and after approval the final render, the other shapes and a thumbnail.
// Everything for one video lives in workspace/makes/<title>/ (never overwritten).
import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT} from './config.js';
import {storyboard,storyboardMarkdown,splitSentences} from './storyboard.js';
import {requestSchema,produce} from './production.js';

export type MakeOptions={
 script:string;
 /** Voice-over: only when the user asks. true uses ELEVENLABS_VOICE_ID; a string is a voice id. */
 voice?:boolean|string;
 /** The user's own words for the look ("dark and glowing"). */
 look?:string;
 /** Master shape (default 9:16) and the other shapes to export (default 1:1 and 16:9). */
 aspectRatio?:'9:16'|'1:1'|'16:9';formats?:('9:16'|'1:1'|'16:9'|'4:5')[];
 thumbnail?:boolean;
 /** Caption files for a voiced video (default); burned also makes a copy with captions drawn on. */
 captions?:'auto'|'burned'|'off';
 /** Background music (default auto: a library track of the video's mood, else an original score) and its mood. */
 music?:'auto'|'library'|'composed'|'off';mood?:string;
 /** Faster, lower-quality render for a quick look. */
 draft?:boolean;
 /** Finish without stopping at the preview when its quality checks pass (unattended use). */
 yes?:boolean;
 title?:string;out?:string;seed?:string;
 /** A look learned from a video you like (pnpm tempoloom look learn): it steers the style and music, never copies. */
 like?:string;
 /** Copy parts of the look as they are, only when asked: colors uses the reference's own colours. */
 copy?:('colors')[];
 /** Tests: a stand-in for the ElevenLabs call. */
 fetcher?:typeof fetch;
 onStep?:(step:string)=>void;
};
export type MakeRecord={version:1;dir:string;title:string;job?:string;project?:string;status:string;request:string;storyboard:string;voiceover?:string;
 style?:string;scenes:number;preview?:string;quality?:{score:number;passed:boolean;issues:string[]};artDirector?:{before:number;after:number;changes:string[];notes:string[]};output?:string;formats?:unknown;thumbnail?:unknown;captions?:unknown;music?:unknown;next?:string;updated:string};

const exists=(f:string)=>fs.access(f).then(()=>true,()=>false);
async function free(dir:string){for(let i=1;;i++){const d=i===1?dir:`${dir}-${i}`;if(!await exists(d))return d;}}
const slug=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'').slice(0,40)||'video';
const makesRoot=()=>path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','makes');
async function write(r:MakeRecord){r.updated=new Date().toISOString();await fs.writeFile(path.join(r.dir,'make.json'),JSON.stringify(r,null,1)+'\n');return r;}

type Result=Awaited<ReturnType<typeof produce>>;
function previewOf(r:Result){
 const x=r as {preview?:{sheet?:string};quality?:{score:number;passed:boolean;issues:string[]};artDirector?:MakeRecord['artDirector']};
 return {sheet:x.preview?.sheet,quality:x.quality,artDirector:x.artDirector};
}

/** Script in; a video waiting for preview approval (or, with yes and a clean preview, finished) out. */
export async function make(o:MakeOptions):Promise<MakeRecord>{
 const step=o.onStep??(()=>{});
 const sentences=splitSentences(o.script);if(!sentences.length)throw new Error('The script is empty');
 // Check the voice first, so nothing is made before a missing key or voice is reported.
 const voiceId=o.voice===undefined||o.voice===false?undefined:typeof o.voice==='string'?o.voice:process.env.ELEVENLABS_VOICE_ID?.trim();
 if(o.voice&&!o.fetcher&&!process.env.ELEVENLABS_API_KEY?.trim())throw new Error('A voice-over needs ELEVENLABS_API_KEY in .env. Run without --voice for a video without narration.');
 if(o.voice&&!voiceId)throw new Error('Choose a voice: --voice VOICE_ID (list them with pnpm tempoloom media voices) or set ELEVENLABS_VOICE_ID in .env');

 step('Designing the storyboard and a new style');
 const {designStyle,styleKnowledge,usedGenomes,learnedTraits}=await import('./style-choice.js');
 const learned=await learnedTraits(),seed=o.seed??`${Date.now()}-${Math.random()}`;
 const look=o.like?await (await import('./looks.js')).readLook(o.like):undefined;
 const copied=look&&o.copy?.includes('colors')?(await import('./looks.js')).copiedTheme(look):undefined;
 const style=designStyle({seed,brief:o.script,direction:o.look,used:await usedGenomes(),knowledge:await styleKnowledge(o.script),learned,...(copied?{brand:copied}:{}),...(look?{like:{name:look.name,steer:look.steer,summary:look.summary}}:{})});
 const sb=storyboard(o.script,{genome:style.genome,styleWhy:style.why,learned,seed,...(look?.layout?{layout:look.layout}:{})});
 const title=(o.title?.trim()||sb.request.title).slice(0,80);
 const dir=await free(path.resolve(o.out??path.join(makesRoot(),slug(title))));await fs.mkdir(dir,{recursive:true});
 await fs.writeFile(path.join(dir,'storyboard.md'),storyboardMarkdown(sb));

 const request:Record<string,unknown>={...sb.request,title,purpose:'production',aspectRatio:o.aspectRatio??'9:16',renderPreset:o.draft?'draft':'final',artDirector:'auto',
  formats:(o.formats??['1:1','16:9']).filter(f=>f!==(o.aspectRatio??'9:16')),thumbnail:o.thumbnail===false?false:{title},captions:o.captions??'auto',music:o.music??'auto',...(look?{like:look.name,...(o.copy?.length?{likeCopy:o.copy}:{})}:{}),...(o.mood?{musicMood:o.mood}:{})};
 let voiceover:string|undefined;
 if(voiceId){
  step('Recording the voice-over (ElevenLabs)');
  const {synthesize}=await import('./voiceover.js');
  const v=await synthesize(sb.request.script,{voiceId,out:path.join(dir,'voiceover.mp3'),fetcher:o.fetcher,...(o.fetcher?{apiKey:'test'}:{})});
  voiceover=v.audio;Object.assign(request,{voiceover:v.audio,wordAlignment:JSON.parse(await fs.readFile(v.alignment,'utf8')),sync:'exact'});
 }
 requestSchema.parse(request);
 const requestFile=path.join(dir,'request.json');await fs.writeFile(requestFile,JSON.stringify(request,null,1)+'\n');
 const record:MakeRecord={version:1,dir,title,status:'planned',request:requestFile,storyboard:path.join(dir,'storyboard.md'),...(voiceover?{voiceover}:{}),
  style:style.genome.name,scenes:sb.scenes,updated:''};
 await write(record);

 step('Building the video and its preview (art director and quality checks)');
 const r=await produce({manifest:requestFile});
 Object.assign(record,{job:r.job,project:'project' in r?r.project:r.job,status:r.status});
 const pv=previewOf(r);if(pv.sheet)record.preview=pv.sheet;if(pv.quality)record.quality=pv.quality;if(pv.artDirector)record.artDirector=pv.artDirector;
 if(r.status==='preview-review'&&o.yes&&pv.quality?.passed){await write(record);return finish(r.job,{onStep:step,dir});}
 record.next=r.status==='preview-review'
  ?`Look at the preview (${record.preview}) and storyboard.md, then finish with: pnpm tempoloom make --approve ${r.job}`
  :r.status==='alignment-review'?`The voice-over timing needs a look: ${'error' in r?String(r.error):''}`
  :`The job stopped at ${r.status}; see ${path.join(dir,'make.json')}`;
 return write(record);
}

/** After the preview is approved: the final render, the other shapes and the thumbnail. */
export async function finish(job:string,o:{onStep?:(s:string)=>void;dir?:string}={}):Promise<MakeRecord>{
 const dir=o.dir??await findMake(job);
 const record=JSON.parse(await fs.readFile(path.join(dir,'make.json'),'utf8')) as MakeRecord;
 (o.onStep??(()=>{}))('Rendering the final video, other shapes and thumbnail');
 const r=await produce({resume:job,approve:true});
 if(r.status!=='complete'){record.status=r.status;record.next='The preview changed or is not approved yet; run pnpm tempoloom make --approve '+job+' again after looking at it.';return write(record);}
 const x=r as {file?:string;finishing?:{formats?:unknown;thumbnail?:unknown;captions?:unknown;music?:unknown}};
 Object.assign(record,{status:'complete',output:x.file,...(x.finishing?.formats?{formats:x.finishing.formats}:{}),...(x.finishing?.thumbnail?{thumbnail:x.finishing.thumbnail}:{}),...(x.finishing?.captions?{captions:x.finishing.captions}:{}),...(x.finishing?.music?{music:x.finishing.music}:{})});
 record.next='Watch it; record the verdict so the next video learns: pnpm tempoloom brain verdict '+job+' approved|rejected';
 return write(record);
}
async function findMake(job:string){
 for(const d of await fs.readdir(makesRoot()).catch(()=>[] as string[])){
  try{const m=JSON.parse(await fs.readFile(path.join(makesRoot(),d,'make.json'),'utf8')) as MakeRecord;if(m.job===job)return path.join(makesRoot(),d);}catch{/* next */}}
 throw new Error('No video made with job '+job+' under '+makesRoot());
}
