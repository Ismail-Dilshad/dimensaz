import {explainerRequestSchema} from './explainer-schema.js';
import {pendulumStyleSchema} from './pendulum-style.js';
import {presenterInsertsSchema} from './presenter-inserts.js';
import {cardNameSchema, type ReferenceStyle} from './reference-motion-schema.js';
import {collectionCards,cardForReference,cardLock} from './collection-cards.js';
import {chooseExplainerTheme,readThemeHistory,rememberTheme,assertExplainer,recentIconWarnings} from './explainer-design.js';
import {authorizeAcousticAlignment} from './acoustic-alignment.js';
import {applyReferenceStyle,assertReferenceScenes} from './reference-styles.js';
import {planReference} from './reference-storyboard.js';
import {assetBoard,referenceAssetBlockers,acceptReferenceReview,assertReferenceReview} from './reference-production.js';
import {assertActiveCard,assertActivePreset,defaultProductionPreset,fidelityCriteria} from './reference-policy.js';
import {directorSchema} from './style-director-schema.js';
import {applyDirector,planDirectorSound} from './director-integration.js';
import {renderProfiles} from '../renderer/performance.js';
import {resolveFontPreset} from './font-catalog.js';
import {styleDNASchema,deriveStyle,applyStyle} from './style-dna.js';
import {lockAssets} from './asset-locks.js';
import {assetNeedSchema,sourceAsset} from './asset-sourcing.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {ROOT,defaults} from './config.js';
import {languageInputSchema,resolveLanguage} from './languages.js';
import {defaultFontPath} from './font-catalog.js';
import {brandProfile} from './brand.js';
import {create,load,save,dir,importMedia,writeJSON,revise} from './project.js';
import {sceneSchema} from './schema.js';
import {planProject} from './timeline-builder.js';
import {validateTimeline} from './scene-planner.js';
import {checkGlyphs} from './text-shaper.js';
import {applyWordAlignment,assertVoiceAlignment,voiceAlignmentSchema} from './voice-alignment.js';
import {analyzeProjectAudio,readAudioAnalysis,analysisToAlignment} from './audio-analysis.js';
import {productionPresets,applyPreset} from './production-presets.js';
import {indexSfx,eligibleSfx} from './sfx.js';
import {preview,render,fingerprint} from '../renderer/render-controller.js';
import {validateVideo,run,ffmpeg,ffprobe} from '../renderer/ffmpeg-encoder.js';
import {sceneVisualSchema,pieceThemeSchema,sceneIndexFor,type PieceTheme} from './scene-pieces-schema.js';
const presetNames=Object.keys(productionPresets) as [keyof typeof productionPresets,...(keyof typeof productionPresets)[]];
const productionRequest=z.object({
 styleCard:cardNameSchema.optional(),
 explainer:explainerRequestSchema.optional(),
 authorizedAutomaticAlignment:z.string().optional(),
 director:directorSchema.optional(),
 purpose:z.enum(['production','test']).default('production'),exportCategory:z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/).default('general'),schemaVersion:z.literal(1),title:z.string().trim().min(1),script:z.string().refine(s=>!!s.trim()),
 language:languageInputSchema.default('auto'),voiceover:z.string().optional(),
 sync:z.enum(['exact','estimated']).default('exact'),
 media:z.array(z.object({file:z.string(),kind:z.enum(['image','video','music','sfx']),at:z.number().nonnegative().default(0)}).strict()).default([]),
 aspectRatio:z.enum(['9:16','1:1','16:9']).default('9:16'),
 resolution:z.object({width:z.number().int().positive(),height:z.number().int().positive()}).strict().optional(),
 renderPreset:z.enum(['draft','preview','final']).default('final'),captureConcurrency:z.number().int().min(1).max(4).optional(),fontPreset:z.string().min(1).optional(),fps:z.number().int().min(1).max(120).optional(),font:z.string().optional(),
 preset:z.enum(presetNames).default(defaultProductionPreset),background:z.enum(['auto','white-grid','solid','black-grid','flow-gradient']).default('auto'),
 energy:z.enum(['smooth','balanced','high']).default('balanced'),
 pendulum:pendulumStyleSchema.optional(),
 presenterInserts:presenterInsertsSchema.optional(),
 styleDNA:styleDNASchema.optional(),assetNeeds:z.array(assetNeedSchema).default([]),
 // Animated scene pieces by planned scene index (UI mockups, dashboards, tasks, charts...), and their colours.
 sceneVisuals:z.array(sceneVisualSchema).default([]),pieceTheme:pieceThemeSchema.partial().optional(),
 // Finishing after the final render: extra shapes of the same video, and a cover image.
 formats:z.array(z.enum(['9:16','1:1','16:9','4:5'])).default([]),thumbnail:z.union([z.boolean(),z.object({title:z.string().min(1).max(80).optional(),at:z.number().nonnegative().optional()}).strict()]).default(false),wordAlignment:voiceAlignmentSchema.optional(),scenes:z.array(sceneSchema).optional(),
 referenceQuery:z.string().default(''),sfx:z.enum(['off','auto']).default('off'),
 // Subtle default motion (camera drift, animated backgrounds, rich entrances). Defaults to config/brand.json preferences.autoMotion (true).
 autoMotion:z.boolean().optional(),
 previewScale:z.number().min(.2).max(1).default(.5),
 output:z.object({codec:z.enum(['libx264','h264_nvenc','auto']).default('libx264'),pixelFormat:z.literal('yuv420p').default('yuv420p'),crf:z.number().int().min(0).max(51).optional()}).strict().default({codec:'libx264',pixelFormat:'yuv420p'})
}).strict().superRefine((r,c)=>{if(r.director&&r.preset.startsWith('reference-')&&r.director.resolved.referenceStyle!==r.preset.slice('reference-'.length))c.addIssue({code:'custom',message:'Director referenceStyle must match the selected reference preset'});if(r.resolution){const [a,b]=r.aspectRatio.split(':').map(Number);if(Math.abs(r.resolution.width/r.resolution.height-a/b)>.001)c.addIssue({code:'custom',message:'Resolution contradicts aspectRatio'});}});
// Resolve a named card at the public request boundary as well as at video:create.
export const requestSchema=z.preprocess(raw=>{
 if(!raw||typeof raw!=='object'||!('styleCard' in raw)||('preset' in raw&&raw.preset!==undefined))return raw;
 const card=cardNameSchema.safeParse(raw.styleCard);
 return card.success?{...raw,preset:'reference-'+collectionCards[card.data].base}:raw;
},productionRequest);
const jobSchema=z.object({schemaVersion:z.literal(1),project:z.string(),request:requestSchema,planned:z.boolean(),realisticObjects:z.boolean().default(false),status:z.enum(['pending','asset-review','pilot-review','alignment-review','preview-review','rendering','complete','failed']),fingerprint:z.string().optional(),output:z.string().optional(),error:z.string().optional()});
type Job=z.infer<typeof jobSchema>;
export async function produce(options:{manifest?:string;resume?:string;approve?:boolean;alignment?:string;revision?:string;storyboard?:string;review?:string;legacyStyle?:boolean;onPhase?:(phase:"planning"|"rendering",project:string)=>Promise<void>}){
 if(!!options.manifest===!!options.resume)throw new Error('Supply exactly one of --manifest or --resume');
 if(options.approve&&!options.resume)throw new Error('Inspect the generated evidence before --resume ID --approve-preview');
 if((options.storyboard||options.review)&&!options.resume)throw new Error('Storyboard and pilot review updates require the existing --resume job');
 let job:Job;
 if(options.manifest){
  const source=path.resolve(options.manifest),base=path.dirname(source);
  const raw=JSON.parse(await fs.readFile(source,'utf8'));
  const named=raw.styleCard===undefined?undefined:cardNameSchema.parse(raw.styleCard);
  const preset=raw.preset??(named?'reference-'+collectionCards[named].base:options.legacyStyle?'kinetic':defaultProductionPreset);
  const request=requestSchema.parse({...raw,preset});
  if(named)assertActiveCard(named);
  if(preset==='clay'||preset==='object-motion'||request.director?.resolved.creativeDirection==='clay')
   throw new Error('Clay treatments are available for saved projects only.');
  if(named&&!preset.startsWith('reference-'))throw new Error('A collection styleCard requires a reference preset.');
  if(!options.legacyStyle&&preset.startsWith('reference-')){
   const id=preset.slice('reference-'.length) as ReferenceStyle['id'];
   request.styleCard=named??cardForReference(id);
   cardLock(request.styleCard!,id);
  }
  if(!options.legacyStyle)assertActivePreset(request.preset);
  if((preset==='presenter-inserts')!==!!request.presenterInserts)throw new Error('Presenter inserts require their registered preset and design snapshot.');
  if(request.presenterInserts){
   const footage=request.media.filter(m=>m.kind==='video'),end=request.scenes?.at(-1);
   if(footage.length!==1||footage[0].at!==0||!end||request.voiceover||request.director||request.presenterInserts.inserts.some(s=>s.end>end.start+end.duration))throw new Error('Supply one presenter clip at zero and complete caption scenes covering all design inserts.');
  }
  if((preset==='pendulum-reveal')!==!!request.pendulum)throw new Error('Pendulum Reveal needs a pendulum style snapshot and the pendulum-reveal preset.');
  if(request.pendulum&&(!request.scenes?.length||named||request.director||request.voiceover||request.scenes.some(s=>s.direction!==request.scenes![0].direction)))throw new Error('Pendulum Reveal requires a single-direction, unvoiced phrase sequence with explicit timing.');
  request.media=request.media.map(m=>({...m,file:path.resolve(base,m.file)}));if(request.voiceover)request.voiceover=path.resolve(base,request.voiceover);
  if(request.authorizedAutomaticAlignment)request.authorizedAutomaticAlignment=path.resolve(base,request.authorizedAutomaticAlignment);
  if(request.preset==='script-explainer'&&(!request.explainer||!request.scenes))throw new Error('Script explainer needs a semantic brief and exact planned scenes. See docs/guides/explainer-workflow.md.');
  if(request.explainer&&request.preset!=='script-explainer')throw new Error('Explainer brief requires script-explainer preset');
  if(request.explainer&&request.director)throw new Error('Use explainer.overrides for explicit design choices, not a second Director theme');
  for(const m of [...request.media,...(request.voiceover?[{file:request.voiceover}]:[])])await fs.access(m.file);
  const language=resolveLanguage(request.language,request.script);
  const profile=renderProfiles[request.renderPreset];
  const [width,height]=request.resolution?[request.resolution.width,request.resolution.height]:({'9:16':[profile.width,profile.height],'1:1':[profile.width,profile.width],'16:9':[profile.height,profile.width]})[request.aspectRatio];
  const config=await defaults({...profile,...request.output,renderPurpose:request.purpose,exportCategory:request.exportCategory,captureConcurrency:request.captureConcurrency??profile.captureConcurrency,width,height,fps:request.fps??profile.fps,font:request.fontPreset?await resolveFontPreset(request.fontPreset):request.font??await defaultFontPath(language,request.script),language,referenceQuery:request.referenceQuery,
   background:request.background==='auto'?'white-grid':request.background,textTreatment:'kinetic',voiceTiming:request.voiceover&&request.sync==='exact'?'required':'estimated',
   reducedMotion:!(request.autoMotion??(await brandProfile()).preferences.autoMotion),
   intensity:{smooth:.3,balanced:.6,high:.85}[request.energy],normalize:!request.voiceover,fadeIn:request.voiceover?0:.2,fadeOut:request.voiceover?0:.5});
  if(request.explainer){config.explainer=chooseExplainerTheme({...request.explainer,overrides:{...request.explainer.overrides,...(raw.font?{font:request.font}:{})}},await readThemeHistory(config),config.font);config.font=config.explainer.font;config.primary=config.explainer.accent;config.ink=config.explainer.ink;config.fontSize=96;config.minFontSize=48;config.progress=false;}
  checkGlyphs(request.script,config);await run(ffmpeg,['-version']);await run(ffprobe,['-version']);
  if(request.pendulum){config.pendulum=request.pendulum;config.progress=false;config.fadeIn=0;config.fadeOut=0;config.normalize=false;}
  if(request.presenterInserts){config.presenterInserts=request.presenterInserts;config.progress=false;config.preserveOriginal=true;config.originalVolume=1;config.fadeIn=0;config.fadeOut=0;config.normalize=false;}
  if(request.styleCard)config.referenceStyle=cardLock(request.styleCard,request.preset.slice('reference-'.length) as ReferenceStyle['id']);
  const p=await create(request.title,request.script,config);p.styleDNA=request.styleDNA??deriveStyle(config);
  if(config.explainer){const t=config.explainer;p.styleDNA={version:1,palette:[t.accent,t.background,t.ink,t.tint],typography:t.font,material:t.iconSet+' '+t.iconRendering+' native vectors',lighting:'flat',perspective:'front',spacing:'airy',composition:['center'],animation:{energy:.3,easing:'cubic',entranceSeconds:t.duration},variation:'Script-led symbols; static holds; non-overlapping matched slides.'};}
  if(!options.legacyStyle&&request.preset.startsWith('reference-'))p.referenceWorkflow={version:1};await save(p);
  job={schemaVersion:1,project:p.id,request,planned:false,realisticObjects:!options.legacyStyle,status:'pending'};
 }else{
  const c=await defaults();job=jobSchema.parse(JSON.parse(await fs.readFile(path.join(dir(options.resume!,c),'job.json'),'utf8')));
 }
 const jobId=options.resume||job.project,jobFile=path.join(dir(jobId,await defaults()),'job.json');
 const log=async(stage:string,data:unknown={})=>{await fs.appendFile(path.join(path.dirname(jobFile),'events.jsonl'),JSON.stringify({at:new Date().toISOString(),stage,data})+'\n');};
 await writeJSON(jobFile,job);await log('start',{project:job.project});
 const started=performance.now();
 try{
  let p=await load(job.project);
  if(options.storyboard){
   if(job.planned)throw new Error('A prepared project requires a separate revision; use --revision instead of replacing its storyboard');
   const input=JSON.parse(await fs.readFile(options.storyboard,'utf8'));
   const scenes=sceneSchema.array().parse(Array.isArray(input)?input:input.scenes);validateTimeline(scenes,p.script);
   p.scenes=scenes;job.request.scenes=scenes;await save(p);await writeJSON(jobFile,job);
  }
  if(options.revision){
   const replacement=await load(options.revision);
   if(replacement.id!==p.id&&replacement.parentId!==(p.parentId||p.id))throw new Error('Revision must be a separate descendant of this job project');
   if(p.referenceWorkflow&&!replacement.referenceWorkflow)throw new Error('Reference workflow cannot be removed from a revision');
   if(p.config.referenceStyle?.card&&!replacement.config.referenceStyle?.card)throw new Error('A collection revision must retain a layered style card.');
   p=replacement;job.project=p.id;job.planned=true;job.status='pending';delete job.fingerprint;await writeJSON(jobFile,job);
  }
  if(!job.planned){
   await options.onPhase?.("planning",p.id);
   const inputs=[...(job.request.voiceover?[{file:job.request.voiceover,kind:'voice' as const,at:0}]:[]),...job.request.media];
   for(let i=p.media.length;i<inputs.length;i++){const m=inputs[i];await importMedia(p,m.file,m.kind,m.at);await log('import',{kind:m.kind});}
   p.scenes=p.referenceWorkflow?planReference(p.script,job.request.preset.slice('reference-'.length) as 'style-1',job.request.styleCard).request.scenes:planProject(p);
   applyPreset(p,job.request.preset);if(job.request.scenes)p.scenes=job.request.scenes;
   if(p.referenceWorkflow){
    await save(p);const blockers=referenceAssetBlockers(p,job.realisticObjects);
    if(blockers.length){
     const board=await assetBoard(p,job.realisticObjects),file=path.join(dir(p.id,p.config),'asset-board.json');await writeJSON(file,board);
     job.status='asset-review';await writeJSON(jobFile,job);await log('asset-review',{blockers,file});
     return {job:jobId,project:p.id,status:job.status,blockers,assetBoard:file,next:board.next};
    }
   }
   if(p.media.some(m=>m.kind==='voice'))for(const s of p.scenes)s.animation='phrase-rise';
   if(job.request.wordAlignment&&!options.alignment)await applyWordAlignment(p,job.request.wordAlignment);
   p.production={preset:job.request.preset,sfx:job.request.sfx};
   if(job.request.director?.resolved.referenceStyle)applyReferenceStyle(p,job.request.director.resolved.referenceStyle);
   if(job.request.sceneVisuals.length||job.request.pieceTheme){
    const b=(await brandProfile()).colors,base={primary:b.primary??p.config.primary,accent:b.accent??'#F97316',surface:'#FFFFFF',background:b.background??'#F6F7FB',text:b.text??p.config.ink,muted:'#6B7280',radius:18};
    p.config.pieces=pieceThemeSchema.parse({...base,...job.request.pieceTheme}) as PieceTheme; // highlighted words take its primary after the style is applied
    const placed=job.request.sceneVisuals.map(v=>{const i=sceneIndexFor(v,p.scenes);p.scenes[i]!.piece=v.piece;return {scene:i,kind:v.piece.kind};});
    await log('scene-pieces',{scenes:placed});
   }
   for(const need of job.request.assetNeeds){
    const scene=p.scenes[need.scene];if(!scene)throw new Error('Asset need references missing scene');
    const result=await sourceAsset({...need,style:p.styleDNA?.material??need.style});await log('asset-sourcing',{need,result});
    if(result.status!=='ready')throw new Error('Asset sourcing requires agent review; inspect events.jsonl, import an evaluated asset, then resume this job');
    scene.asset=result.asset.id;p.config.visuals=true;
   }
   if(job.request.sfx==='auto'&&!job.request.director){
    const sounds=eligibleSfx(await indexSfx(path.join(ROOT,'assets/sfx')));
    // At most one short licensed event per two seconds; no automatic effects over narration.
    if(!p.media.some(m=>m.kind==='voice')){let previous=-2;for(const s of p.scenes)if(s.start-previous>=2&&sounds.length){const sound=sounds.find(x=>x.category==='whooshes')||sounds[0];if(!p.media.some(m=>m.kind==='sfx'&&m.at===s.start))await importMedia(p,sound.file,'sfx',s.start);previous=s.start;}}
    await log('sfx',{eligible:sounds.length,voicePriority:true});
   }
   applyStyle(p);if(p.config.pieces)p.config.primary=p.config.pieces.primary;if(p.config.referenceStyle)applyReferenceStyle(p,p.config.referenceStyle.id);if(job.request.director){applyDirector(p,job.request.director);await planDirectorSound(p);}assertReferenceScenes(p);validateTimeline(p.scenes,p.script);await lockAssets(p);await save(p);
   if(job.request.authorizedAutomaticAlignment)await authorizeAcousticAlignment(p,job.request.authorizedAutomaticAlignment);
   assertExplainer(p);if(p.config.explainer)p.config.explainer.warnings.push(...recentIconWarnings(p,await readThemeHistory(p.config)));await save(p);await rememberTheme(p);job.planned=true;await writeJSON(jobFile,job);
  }
  if(options.alignment){
   const raw=JSON.parse(await fs.readFile(options.alignment,'utf8'));
   const evidence=raw.schemaVersion===1?analysisToAlignment(await readAudioAnalysis(options.alignment)):raw;
   const candidate=structuredClone(p);await applyWordAlignment(candidate,evidence);
   p=await revise(p.id);await applyWordAlignment(p,evidence);await save(p);job.project=p.id;job.status='pending';await writeJSON(jobFile,job);
  }
  if(p.config.director){applyDirector(p,p.config.director);await planDirectorSound(p);await save(p);}
  try{await assertVoiceAlignment(p);}catch(error){
   job.status='alignment-review';job.error=String(error);
   let analysis:Awaited<ReturnType<typeof analyzeProjectAudio>>|undefined;let analysisError:string|undefined;
   try{analysis=await analyzeProjectAudio(p);await log('audio-analysis',analysis);}catch(e){analysisError=String(e);await log('audio-blocker',{error:analysisError});}
   const evidence=await preview(p,job.request.previewScale);await writeJSON(jobFile,job);
   return {job:jobId,project:p.id,status:job.status,error:job.error,analysis,analysisError,preview:evidence};
  }
  const hash=await fingerprint(p);
  if(p.referenceWorkflow){
   if(job.realisticObjects){
    if(p.config.referenceStyle?.card)assertActiveCard(p.config.referenceStyle.card);
    const blockers=referenceAssetBlockers(p,true);
    if(blockers.length)throw new Error(blockers.join('; '));
   }
   if(options.review)await acceptReferenceReview(p,JSON.parse(await fs.readFile(options.review,'utf8')));
   let reviewed=false;try{await assertReferenceReview(p,hash);reviewed=true;}catch{}
   if(!reviewed){
    const evidence=await preview(p,job.request.previewScale,{pilot:true});
    const board=await assetBoard(p,job.realisticObjects),template=path.join(dir(p.id,p.config),'pilot-review-template.json');
    await writeJSON(template,{version:1,fingerprint:hash,reviewer:'',referenceImages:[],reviewed:false,
     assessments:fidelityCriteria.map(criterion=>({criterion,result:'pending',notes:''})),limitations:[]});
    job.status='pilot-review';await writeJSON(jobFile,job);
    return {job:jobId,project:p.id,status:job.status,pilot:evidence,references:board.evidence.images,reviewTemplate:template,
     next:'Inspect pilot against actual reference images; complete all fidelity assessments and resume with --review FILE.json. Accepted departures must be disclosed.'};
   }
  }
  if(job.status==='complete'&&job.fingerprint===hash&&job.output){await validateVideo(job.output,{...p.config,duration:validateTimeline(p.scenes,p.script),audio:p.media.some(m=>['voice','music','sfx'].includes(m.kind)||(m.kind==='video'&&p.config.preserveOriginal&&m.metadata?.streams?.some((s:{codec_type:string})=>s.codec_type==='audio')))});return {job:jobId,status:'complete',file:job.output,cached:true};}
  if(!options.approve||job.fingerprint!==hash){
   const evidence=await preview(p,job.request.previewScale);job.status='preview-review';job.fingerprint=hash;delete job.error;await writeJSON(jobFile,job);
   return {job:jobId,project:p.id,status:job.status,preview:evidence,director:p.config.director,warnings:p.directorWarnings,next:'Inspect all sheets, then video:create --resume '+jobId+' --approve-preview'};
  }
  job.status='rendering';await writeJSON(jobFile,job);await options.onPhase?.('rendering',p.id);const output=await render(p,true);
  job.status='complete';job.output=output.file;job.fingerprint=await fingerprint(p);delete job.error;await writeJSON(jobFile,job);
  await log('complete',{...output,elapsedMs:performance.now()-started});
  if(job.request.purpose==='production'){
   // Learning: every finished video is recorded in the brain (never blocks delivery).
   try{const {recordJob}=await import('./brain/brain.js');
    recordJob({id:jobId,kind:'video',title:job.request.title,brief:job.request.script.slice(0,400),language:p.config.language,format:job.request.aspectRatio,preset:job.request.preset,
     durationSeconds:validateTimeline(p.scenes,p.script),scenes:p.scenes.length,pieces:p.scenes.map(s=>s.piece?.kind??'none'),transitions:[...new Set(p.scenes.map(s=>s.piece?.transition??p.config.transition))],
     renderSeconds:Math.round((performance.now()-started)/1000),output:output.file,checks:{voiceover:!!job.request.voiceover,sceneVisuals:job.request.sceneVisuals.length}});
   }catch(e){await log('brain',{error:String(e)});}
  }
  // Finishing: other shapes of the master and a thumbnail (never blocks delivery).
  const finishing:Record<string,unknown>={};
  if(job.request.formats.length||job.request.thumbnail){
   try{const f=await import('../editor/finishing.js');
    if(job.request.formats.length)finishing.formats=(await f.exportFormats(output.file,{to:job.request.formats})).formats;
    if(job.request.thumbnail){const t=job.request.thumbnail===true?{}:job.request.thumbnail;finishing.thumbnail=await f.makeThumbnail(output.file,{title:t.title,at:t.at});}
    await log('finishing',finishing);
   }catch(e){finishing.error=String(e);await log('finishing',{error:String(e)});}
  }
  return {job:jobId,status:'complete',...output,...(Object.keys(finishing).length?{finishing}:{})};
 }catch(error){job.status='failed';job.error=String(error);await writeJSON(jobFile,job);await log('failed',{error:job.error});throw new Error('Job '+jobId+' failed: '+job.error+'; resume with --resume '+jobId);}
}



