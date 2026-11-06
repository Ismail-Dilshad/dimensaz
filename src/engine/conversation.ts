import {beginDirector,answerDirector,readDirector,directorView} from './style-director.js';
import {produce} from './production.js';
import {referenceStyleIds} from './reference-motion-schema.js';
import {sceneSchema} from './schema.js';
import {applyDirector,planDirectorSound} from './director-integration.js';
import {directorValuesSchema,factoryStyle} from './style-director-schema.js';
import {languageInputSchema,resolveLanguage} from './languages.js';
import {analyzeProjectAudio} from './audio-analysis.js';
import {voiceAlignmentSchema,applyWordAlignment} from './voice-alignment.js';
import {z} from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {ROOT,defaults,roots} from './config.js';
import {create,save,load,dir,importMedia,writeJSON} from './project.js';
import {planProject} from './timeline-builder.js';
import {preview,render} from '../renderer/render-controller.js';
import {probe} from '../renderer/ffmpeg-encoder.js';
import {updateLibrary} from '../motion-library/library.js';
export const preferences=z.object({
 style:z.enum([...referenceStyleIds,'viral','minimal','saas','clay','cinematic','auto']).optional(),
 visual:z.enum(['white','white-grid','dark','gradient','auto']).optional(),
 energy:z.enum(['smooth','balanced','high']).optional(),
 assets:z.enum(['text','objects','auto']).optional(),
 format:z.enum(['9:16','1:1','16:9']).default('9:16')
});
export const briefSchema=z.object({
 legacyStyle:z.boolean().default(false),scenes:z.array(sceneSchema).optional(),
 director:z.object({mode:z.enum(['quick','standard','advanced','auto']).default('standard'),scope:z.enum(['all','typography','sound','background']).default('all'),values:directorValuesSchema.partial().optional(),resolution:z.enum(['auto','default']).optional()}).optional(),
 language:languageInputSchema.default('auto'),
 wordAlignment:voiceAlignmentSchema.optional(),
 sync:z.enum(['exact','estimated']).default('exact'),
 title:z.string().refine(s=>!!s.trim(),'Title is empty'),script:z.string().refine(s=>!!s.trim(),'Script is empty'),auto:z.boolean().default(false),
 preferences:preferences.default({format:'9:16'}),
 media:z.array(z.object({file:z.string(),kind:z.enum(['voice','video','image','music','sfx'])})).default([]),
 alignment:z.array(z.object({text:z.string(),start:z.number().nonnegative(),end:z.number().positive()})).optional()
});
type Brief=z.infer<typeof briefSchema>;
type Session={productionJob?:string;directorSession?:string;id:string;brief:Brief;projectId?:string;prepared?:boolean;attempts?:string[];mediaInfo:unknown[];limitations:string[]};
const labels={style:'1 Animation: Viral CapCut/Reels | Minimal Kinetic | Premium SaaS | Claymorphism 3D | Cinematic | Auto Creative',visual:'2 Visual: White (plain) | White Grid | Dark | Gradient | Auto',energy:'3 Energy: Smooth | Balanced | High Energy',assets:'4 Assets: Text Only | Animated Objects | Auto'};
function questions(s:Session){if(s.brief.auto)return [];return (Object.keys(labels) as (keyof typeof labels)[]).filter(k=>!s.brief.preferences[k]).map(k=>labels[k]);}
function sessionPath(id:string){if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('Invalid session ID');return path.join(rootsConfig(),'briefs',id+'.json');}
function rootsConfig(){return path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace');}
async function read(id:string):Promise<Session>{return JSON.parse(await fs.readFile(sessionPath(id),'utf8'));}
async function store(s:Session){await writeJSON(sessionPath(s.id),s);}
export async function beginBrief(input:unknown){
 const brief=briefSchema.parse(input),mediaInfo=[];
 for(const m of brief.media)mediaInfo.push({file:m.file,kind:m.kind,metadata:await probe(path.resolve(m.file))});
 const pref=brief.preferences,values:any={...brief.director?.values};
 if(pref.style&&referenceStyleIds.includes(pref.style as typeof referenceStyleIds[number]))values.referenceStyle=pref.style;
 else if(pref.style&&pref.style!=='auto'&&!values.creativeDirection)values.creativeDirection=pref.style;
 if(pref.visual&&pref.visual!=='auto'&&!values.background)values.background=({white:'solid','white-grid':'white-grid',dark:'black-grid',gradient:'flow-gradient'})[pref.visual];
 if(pref.assets&&pref.assets!=='auto'&&!values.illustrations)values.illustrations=pref.assets==='text'?'none':'existing-assets';
 if(pref.energy&&!values.animation)values.animation={...factoryStyle.animation,energy:{smooth:.3,balanced:.6,high:.85}[pref.energy]};
 if(pref.format!=='9:16'&&!values.export)values.export={...factoryStyle.export,...(pref.format==='1:1'?{width:1080,height:1080}:{width:1920,height:1080})};
 const director=await beginDirector({script:brief.script,voice:brief.media.some(m=>m.kind==='voice'),...brief.director,legacy:brief.legacyStyle,values,mode:brief.auto?'auto':brief.director?.mode,resolution:brief.auto?'auto':brief.director?.resolution});
 if(brief.auto)await answerDirector(director.session,'confirm');
 const s:Session={id:randomUUID(),brief,mediaInfo,limitations:[],directorSession:director.session};await store(s);
 return {session:s.id,directorSession:director.session,questions:director.question?[director.question]:[],ready:director.ready,mediaInfo,summary:director.summary};
}
export function parseAnswers(text:string){
 if(/^(surprise me|auto|use defaults)$/i.test(text.trim()))return {auto:true,preferences:{}};
 const aliases:Record<string,Record<string,string>>={
 style:{auto:'auto','auto creative':'auto','viral capcut/reels':'viral',viral:'viral',capcut:'viral',reels:'viral','minimal kinetic':'minimal',minimal:'minimal','premium saas':'saas',saas:'saas','claymorphism 3d':'clay',clay:'clay',cinematic:'cinematic'},
 visual:{white:'white','plain white':'white','white grid':'white-grid',dark:'dark',gradient:'gradient',auto:'auto'},
 energy:{smooth:'smooth',balanced:'balanced','high energy':'high',high:'high'},
 assets:{'text only':'text',text:'text','animated objects':'objects',objects:'objects',auto:'auto'},
 format:{'9:16':'9:16','1:1':'1:1','16:9':'16:9'}
 };
 const keys=['style','visual','energy','assets','format'],out:Record<string,string>={};
 const re=/(?:^|[,;\n]\s*|\s+)([1-5])\s+(.+?)(?=(?:[,;\n]\s*|\s+)[1-5]\s|$)/g;
 for(const m of text.toLowerCase().matchAll(re)){const key=keys[Number(m[1])-1],v=aliases[key][m[2].trim()];if(!v)throw new Error('Unknown answer for '+key+': '+m[2]);out[key]=v;}
 if(!Object.keys(out).length)throw new Error('Use numbered choices, or Auto/use defaults.');
 return {auto:false,preferences:out};
}
export async function answerBrief(id:string,text:string){
 const s=await read(id);
 if(s.directorSession){let result;
 if(/^[1-5]\s/.test(text.trim())){
  const answers=parseAnswers(text).preferences as Record<string,string>;
  for(const [key,value] of Object.entries(answers)){
   const current=(await readDirector(s.directorSession)).style.resolved;
   const field=({style:'creativeDirection',visual:'background',energy:'animation',assets:'illustrations',format:'export'} as Record<string,string>)[key];
   let converted:any=value;
   if(key==='visual')converted=({white:'solid','white-grid':'white-grid',dark:'black-grid',gradient:'flow-gradient',auto:'auto'} as Record<string,string>)[value];
   if(key==='assets')converted=value==='text'?'none':value==='objects'?'existing-assets':'auto';
   if(key==='energy')converted={...current.animation,energy:({smooth:.3,balanced:.6,high:.85} as Record<string,number>)[value]};
   if(key==='format')converted={...current.export,...(value==='1:1'?{width:1080,height:1080}:value==='16:9'?{width:1920,height:1080}:{width:1080,height:1920})};
   await answerDirector(s.directorSession,'change '+field);await answerDirector(s.directorSession,typeof converted==='string'?converted:JSON.stringify(converted));
  }
  result=directorView(await readDirector(s.directorSession));
 }else result=await answerDirector(s.directorSession,text);
if(s.projectId){if(result.confirmed&&!s.productionJob){const p=await load(s.projectId);p.config.director=(await readDirector(s.directorSession)).style;await save(p);}else s.prepared=false;}await store(s);return {...result,session:id,directorSession:s.directorSession,questions:result.question?[result.question]:[]};}
 if(s.projectId)throw new Error('Project already created; request a revision instead.');
 const parsed=parseAnswers(text);s.brief=briefSchema.parse({...s.brief,auto:s.brief.auto||parsed.auto,preferences:{...s.brief.preferences,...parsed.preferences}});await store(s);
 return {session:id,questions:questions(s),ready:questions(s).length===0};
}
export async function prepareBrief(id:string){
 const s=await read(id);if(s.directorSession&&!directorView(await readDirector(s.directorSession)).ready)throw new Error('Answer the current style question first');if(!s.directorSession&&questions(s).length)throw new Error('Missing preferences: '+questions(s).join('; '));
 if(s.directorSession&&(await readDirector(s.directorSession)).referenceOnly){
  const director=(await readDirector(s.directorSession)).style;
  if(!director.confirmed)throw new Error('Confirm the resolved reference style before preparing the video');
  if(s.productionJob){
   const job=JSON.parse(await fs.readFile(path.join(dir(s.productionJob,await defaults()),'job.json'),'utf8'));
   const p=await load(job.project);s.projectId=p.id;
   if(JSON.stringify(p.config.director??job.request.director)!==JSON.stringify(director))throw new Error('Style changed after creation. Create a separate project revision and attach it with video:create --resume '+s.productionJob+' --revision ID; preserve the source and reviewed assets.');
  }
  let result:Awaited<ReturnType<typeof produce>>;
  if(s.productionJob)result=await produce({resume:s.productionJob});
  else{
   const voice=s.brief.media.find(m=>m.kind==='voice');
   const manifest=path.join(rootsConfig(),'briefs',s.id+'-production-request.json');
   await writeJSON(manifest,{schemaVersion:1,title:s.brief.title,script:s.brief.script,language:resolveLanguage(s.brief.language,s.brief.script),
     preset:'reference-'+director.resolved.referenceStyle,aspectRatio:s.brief.preferences.format,director,scenes:s.brief.scenes,sync:s.brief.sync,
    voiceover:voice?path.resolve(voice.file):undefined,wordAlignment:s.brief.wordAlignment,
    media:s.brief.media.filter(m=>m.kind!=='voice').map(m=>({file:path.resolve(m.file),kind:m.kind})),
    resolution:{width:director.resolved.export.width,height:director.resolved.export.height},fps:director.resolved.export.fps});
   try{result=await produce({manifest});s.productionJob=result.job;}
   catch(error){const job=String(error).match(/Job (\S+) failed:/)?.[1];if(job){s.productionJob=job;s.projectId=job;s.prepared=false;await store(s);}throw error;}
  }
  s.projectId='project' in result&&typeof result.project==='string'?result.project:result.job;s.prepared=result.status==='preview-review';await store(s);
  return {...result,session:id,projectId:s.projectId,preview:'preview' in result?result.preview:undefined,limitations:s.limitations};
 }
 if(s.projectId&&s.prepared)return {session:id,projectId:s.projectId,preview:await preview(await load(s.projectId)),limitations:s.limitations};
 // Failed/interrupted attempts are retained; never mistake an imported but unplanned project for a ready one.
 if(s.projectId)s.attempts=[...(s.attempts||[]),s.projectId];
 s.limitations=[];
 const pref=s.brief.preferences,style=pref.style||'auto';
 const theme=({viral:'bold-viral',minimal:'minimal-kinetic',saas:'saas-motion',clay:'clay-motion',cinematic:'editorial',auto:'minimal-kinetic'} as Record<string,'bold-viral'|'minimal-kinetic'|'saas-motion'|'clay-motion'|'editorial'>)[style]??'editorial';
 const [width,height]=({'9:16':[1080,1920],'1:1':[1080,1080],'16:9':[1920,1080]})[pref.format];
 const voice=s.brief.media.some(m=>m.kind==='voice');
 const p=await create(s.brief.title,s.brief.script,{language:resolveLanguage(s.brief.language,s.brief.script),theme,width,height,textTreatment:'kinetic',voiceTiming:voice&&s.brief.sync!=='estimated'?'required':'estimated',progress:false,visuals:pref.assets==='objects',
 background:pref.visual==='dark'?'black-grid':pref.visual==='gradient'?'flow-gradient':pref.visual==='white'?'solid':'white-grid',
 intensity:pref.energy==='high'?.85:pref.energy==='smooth'?.3:.6,normalize:voice?false:true,fadeIn:voice?0:.2,fadeOut:voice?0:.5});
 s.projectId=p.id;s.prepared=false;await store(s);
 for(const m of s.brief.media)await importMedia(p,m.file,m.kind);
 await updateLibrary();p.scenes=planProject(p);
 for(const scene of p.scenes)if(pref.energy&&scene.motion)scene.motion.intensity=p.config.intensity;
 if(voice){
  const duration=Math.max(...p.media.filter(m=>m.kind==='voice').map(m=>Number(m.metadata.format.duration)));
  if(duration<s.brief.script.trim().split(/\s+/u).length/4)s.limitations.push('Fast narration exceeds four words per second. Review readability; the recording and script have not been changed.');
  if(s.brief.alignment){
   const aligned=s.brief.alignment;if(aligned.length!==p.scenes.length)throw new Error('Alignment must contain one entry per scene.');
   let end=0;for(let i=0;i<aligned.length;i++){const a=aligned[i];if(a.text!==p.scenes[i].text||Math.abs(a.start-end)>.001||a.end<=a.start||a.end>duration+.05)throw new Error('Alignment must preserve exact scene text and contiguous valid times.');p.scenes[i].start=a.start;p.scenes[i].duration=a.end-a.start;end=a.end;}
   p.scenes.at(-1)!.duration+=Math.ceil(duration*p.config.fps)/p.config.fps-end;
  }else{
   const total=p.scenes.reduce((n,x)=>n+x.duration,0),frames=Math.ceil(duration*p.config.fps);
   if(frames<p.scenes.length)throw new Error('Voiceover is too short for the scene count.');
   let assigned=0;for(let i=0;i<p.scenes.length;i++){const scene=p.scenes[i],remaining=p.scenes.length-i-1;const count=i===p.scenes.length-1?frames-assigned:Math.max(1,Math.min(frames-assigned-remaining,Math.round(scene.duration/total*frames)));scene.start=assigned/p.config.fps;scene.duration=count/p.config.fps;assigned+=count;}
   s.limitations.push('Voice duration is primary; scene boundaries are estimated reading-load allocations. No verified speech alignment was supplied; word-level synchronization is not claimed.');
  }
  s.limitations.push('Voice is not time-stretched. AAC export is lossy; normalization and fades are disabled for the conversational voiceover workflow.');
 }
 if(style==='clay')s.limitations.push('Clay assets are animated 2.5D illustrations, not true editable 3D models.');
 if(voice&&s.brief.wordAlignment){await applyWordAlignment(p,s.brief.wordAlignment);s.limitations=s.limitations.filter(x=>!x.includes('estimated reading-load'));}
 if(voice&&!p.alignmentEvidence)for(const scene of p.scenes)scene.animation='phrase-rise';
 if(voice&&p.config.voiceTiming==='required'&&!p.alignmentEvidence){
  try{
   const analysis=await analyzeProjectAudio(p);s.limitations.push('Local audio analysis and review: '+analysis.review);
  }catch(error){s.limitations.push('Local audio analysis unavailable: '+(error instanceof Error?error.message:String(error)));}
  s.limitations.push('EXACT SYNC BLOCKED: reviewed word-level alignment for this audio is unavailable. Previews use estimated phrase holds; final exact-sync rendering is blocked.');
 }
 if(s.directorSession){const director=await readDirector(s.directorSession);applyDirector(p,director.style);await planDirectorSound(p);s.limitations.push(...directorView(director).limitations,...(p.directorWarnings??[]));}
 await save(p);await store(s);const result=await preview(p);s.prepared=true;await store(s);return {session:id,projectId:p.id,preview:result,limitations:s.limitations};
}
export async function finishBrief(id:string,approved:boolean){
 const s=await read(id);if(!s.projectId||!s.prepared)throw new Error('Prepare the brief and inspect its preview first.');
 if(!approved)throw new Error('Codex must inspect preview images before finishing.');
 if(s.productionJob)return produce({resume:s.productionJob,approve:true});
 const p=await load(s.projectId),output=await render(p,true);
 return {...output,filename:path.basename(output.file),animationStyle:s.brief.preferences.style||'auto',limitations:s.limitations};
}
