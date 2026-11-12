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
import {pieceSoundBed} from './piece-sounds.js';
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
 /** Sounds timed to the scene pieces (transitions, clicks, pops, ticks, chimes); auto = on when scenes have pieces. */
 pieceSounds:z.enum(['auto','off']).default('auto'),
 /** Visuals for scenes without one: auto designs a new one from zero for every sentence (kinetic
  *  and other motion presets; never over footage, a reference style, an explainer or a director). */
 scenePieces:z.enum(['auto','off']).default('auto'),
 /** The art director: measures each designed visual (sparse, crowded, off-balance, text into an
  *  icon, like the scene before) and redesigns the weak ones. auto = on for visuals designed
  *  automatically (make, scenePieces auto); off leaves approved storyboards exactly as they are. */
 artDirector:z.enum(['auto','off']).optional(),
 /** A look learned from a video the user likes (pnpm tempoloom look learn): it nudges the style and the music's mood, never copies. */
 like:z.string().regex(/^[a-z0-9][a-z0-9-]{0,40}$/).optional(),
 /** Copy parts of the look as they are, only when the user asks: colors uses the reference's own colours instead of the brand's. */
 likeCopy:z.array(z.enum(['colors'])).default([]),
 /** The user's own words for the look ("dark and glowing", "calm paper"); the style is still generated new. */
 look:z.string().max(200).optional(),
 /** Keep an exact earlier style (only when the user asks to repeat a look); otherwise every video gets a new one. */
 pieceGenome:z.unknown().optional(),
 /** Background music: auto uses a fitting track from assets/music, else composes an original piece for the video; library or composed forces one; off has none. */
 music:z.enum(['auto','library','composed','off']).default('auto'),
 /** The music's mood (calm, warm, inspiring, upbeat, playful, energetic, dark); read from the script and style when left out. */
 musicMood:z.enum(['calm','warm','inspiring','upbeat','playful','energetic','dark']).optional(),
 /** Caption files (.srt, .vtt) for a voiced video: auto writes them; burned also makes a copy with the captions drawn on; off skips them. */
 captions:z.enum(['auto','burned','off']).default('auto'),
 /** The sound family for piece sounds: auto (the style's), library, soft, digital, punchy or minimal. */
 soundKit:z.enum(['auto','library','soft','digital','punchy','minimal']).default('auto'),
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
const jobSchema=z.object({schemaVersion:z.literal(1),project:z.string(),request:requestSchema,planned:z.boolean(),artDirected:z.boolean().optional(),realisticObjects:z.boolean().default(false),status:z.enum(['pending','asset-review','pilot-review','alignment-review','preview-review','rendering','complete','failed']),fingerprint:z.string().optional(),output:z.string().optional(),error:z.string().optional()});
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
  // Type sizes are set for a 1080-pixel short side; smaller renders (draft, preview) scale them so text still fits.
  {const k=Math.min(config.width,config.height)/1080;if(Math.abs(k-1)>.01){config.fontSize=Math.round(config.fontSize*k);config.minFontSize=Math.max(12,Math.round(config.minFontSize*k));}}
  // A learned look sets the headline size and, without a voice-over, the scene pacing.
  if(request.like&&!request.explainer&&!preset.startsWith('reference-')){const l=await (await import('./looks.js')).readLook(request.like);
   if(l.type)config.fontSize=Math.round(config.fontSize*l.type.scale);
   if(l.pacing&&!request.voiceover){config.minSceneDuration=l.pacing.minSceneDuration;config.wordsPerSecond=l.pacing.wordsPerSecond;}}
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
   // Scene visuals: designed from zero for this video (unless the request brings its own), in a
   // style generated new for it. Never a ready-made piece or a fixed look.
   const autoPieces=job.request.scenePieces==='auto'&&!job.request.sceneVisuals.length&&!p.referenceWorkflow&&!job.request.director&&!job.request.explainer&&!job.request.pendulum&&!job.request.presenterInserts&&!p.media.some(m=>m.kind==='video');
   if(job.request.sceneVisuals.length||job.request.pieceTheme||autoPieces){
    const b=(await brandProfile()).colors,base={primary:b.primary??p.config.primary,accent:b.accent??'#F97316',surface:'#FFFFFF',background:b.background??'#F6F7FB',text:b.text??p.config.ink,muted:'#6B7280',radius:18};
    const lk=await likeFor(job.request);
    // The look's own colours only when the user asked to copy them; otherwise the brand's.
    const copied=lk&&job.request.likeCopy.includes('colors')?(await import('./looks.js')).copiedTheme(lk.look):{};
    p.config.pieces=pieceThemeSchema.parse({...base,...copied,...job.request.pieceTheme}) as PieceTheme; // highlighted words take its primary after the style is applied
    const {designStyle,styleKnowledge,rememberStyle,usedGenomes,learnedTraits}=await import('./style-choice.js');
    const {genomeSchema}=await import('../components/pieces/genome.js');const learned=await learnedTraits();
    if(job.request.pieceGenome){p.config.pieces.genome=genomeSchema.parse(job.request.pieceGenome);await log('piece-style',{kept:p.config.pieces.genome.id,name:p.config.pieces.genome.name});}
    else if(!p.config.pieces.genome){
     const like=await likeFor(job.request);
     const d=designStyle({seed:jobId,brief:job.request.title+'\n'+job.request.script,direction:job.request.look,brand:p.config.pieces,preset:job.request.preset+' '+job.request.background,
      knowledge:await styleKnowledge(job.request.script),used:await usedGenomes(),learned,like});
     p.config.pieces.genome=d.genome;await log('piece-style',{genome:d.genome.id,name:d.genome.name,why:d.why,novelty:Number(d.novelty.toFixed(2))});}
    await rememberStyle(p.config.pieces.genome.name,jobId,p.config.pieces.genome);
    const placed=[];
    if(autoPieces){const {designScenes}=await import('./storyboard.js');
     for(const pl of designScenes(p.scenes.map(s=>s.text),{seed:jobId,genome:p.config.pieces.genome,learned,layout:lk?.look.layout})){p.scenes[pl.index]!.piece=pl.piece;placed.push({scene:pl.index,designed:pl.piece.designed?.archetype});}}
    else for(const v of job.request.sceneVisuals){const i=sceneIndexFor(v,p.scenes);p.scenes[i]!.piece=v.piece;placed.push({scene:i,designed:v.piece.designed?.archetype??'agent'});}
    await log('scene-pieces',{auto:autoPieces,scenes:placed});
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
    if(!p.media.some(m=>m.kind==='voice')){let previous=-2;for(const s of p.scenes)if(!(s.piece&&job.request.pieceSounds==='auto')&&s.start-previous>=2&&sounds.length){const sound=sounds.find(x=>x.category==='whooshes')||sounds[0];if(!p.media.some(m=>m.kind==='sfx'&&m.at===s.start))await importMedia(p,sound.file,'sfx',s.start);previous=s.start;}}
    await log('sfx',{eligible:sounds.length,voicePriority:true});
   }
   if(job.request.pieceSounds==='auto')await addPieceSounds(p,job.request.soundKit,log);
   await addMusic(p,await withLikeMood(job.request),jobId,log);
   applyStyle(p);if(p.config.pieces)p.config.primary=p.config.pieces.primary;
   // The whole frame follows the video's generated style: background, pattern, headline colour, font and motion.
   await applyFrame(p,log);
   if(p.config.referenceStyle)applyReferenceStyle(p,p.config.referenceStyle.id);if(job.request.director){applyDirector(p,job.request.director);await planDirectorSound(p);}assertReferenceScenes(p);validateTimeline(p.scenes,p.script);await lockAssets(p);await save(p);
   if(job.request.authorizedAutomaticAlignment)await authorizeAcousticAlignment(p,job.request.authorizedAutomaticAlignment);
   assertExplainer(p);if(p.config.explainer)p.config.explainer.warnings.push(...recentIconWarnings(p,await readThemeHistory(p.config)));await save(p);await rememberTheme(p);job.planned=true;await writeJSON(jobFile,job);
  }
  if(options.alignment){
   const raw=JSON.parse(await fs.readFile(options.alignment,'utf8'));
   const evidence=raw.schemaVersion===1?analysisToAlignment(await readAudioAnalysis(options.alignment)):raw;
   const candidate=structuredClone(p);await applyWordAlignment(candidate,evidence);
   p=await revise(p.id);await applyWordAlignment(p,evidence);
   // The visuals now enter on their spoken words; their sounds move with them.
   if(job.request.pieceSounds==='auto'&&p.scenes.some(x=>x.piece))await addPieceSounds(p,job.request.soundKit,log);
   await addMusic(p,await withLikeMood(job.request),jobId,log); // re-cut to the new scene timing
   await save(p);job.project=p.id;job.status='pending';await writeJSON(jobFile,job);
  }
  if(p.config.director){applyDirector(p,p.config.director);await planDirectorSound(p);await save(p);}
  try{await assertVoiceAlignment(p);}catch(error){
   job.status='alignment-review';job.error=String(error);
   let analysis:Awaited<ReturnType<typeof analyzeProjectAudio>>|undefined;let analysisError:string|undefined;
   try{analysis=await analyzeProjectAudio(p);await log('audio-analysis',analysis);}catch(e){analysisError=String(e);await log('audio-blocker',{error:analysisError});}
   const evidence=await preview(p,job.request.previewScale);await writeJSON(jobFile,job);
   return {job:jobId,project:p.id,status:job.status,error:job.error,analysis,analysisError,preview:evidence};
  }
  // The art director, once per job: weak designed visuals get another composition before anyone looks.
  let artDirection:import('./art-direction.js').ArtDirection|undefined;
  const directed=job.request.artDirector==='auto'||(job.request.artDirector===undefined&&job.request.scenePieces==='auto'&&!job.request.sceneVisuals.length);
  if(directed&&!job.artDirected&&!p.referenceWorkflow&&p.scenes.some(s=>s.piece?.designed)){
   const {artDirect}=await import('./art-direction.js'),{learnedTraits}=await import('./style-choice.js');
   artDirection=await artDirect(p,{seed:jobId,learned:await learnedTraits(),evidence:'art-director:'+jobId});await log('art-director',artDirection);
   if(artDirection.changes.length){if(job.request.pieceSounds==='auto')await addPieceSounds(p,job.request.soundKit,log);await save(p);}
   job.artDirected=true;await writeJSON(jobFile,job);
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
   let evidence=await preview(p,job.request.previewScale),fp=hash;
   // Quality: if the generated style makes frames fail (contrast, empty), design another and check again.
   const styleIssue=(q:typeof evidence.quality)=>!!q&&q.scenes.some(s=>s.issues.some(i=>i.severity==='hard'&&(i.kind==='contrast'||i.kind==='empty')));
   for(let k=1;k<=2&&styleIssue(evidence.quality)&&p.config.pieces?.genome&&!job.request.pieceGenome;k++){
    const failed=p.config.pieces.genome,{designStyle,usedGenomes,learnedTraits,styleKnowledge,rememberStyle,registerTraits}=await import('./style-choice.js');
    const ids=(await registerTraits(failed)).filter(id=>/pt-(tone|fill|accent|shadow|backdrop)-/.test(id));
    try{(await import('./brain/brain.js')).nudge(ids,false,`quality:${jobId}:${failed.id}`);}catch{/* the brain learns next time */}
    const d=designStyle({seed:jobId+'#quality'+k,brief:job.request.title+'\n'+job.request.script,direction:job.request.look,brand:p.config.pieces,knowledge:await styleKnowledge(job.request.script),
     used:[...await usedGenomes(),failed],learned:await learnedTraits(),like:await likeFor(job.request)});
    await log('quality',{redesign:k,failed:failed.name,score:evidence.quality!.score,issues:evidence.quality!.scenes.flatMap(s=>s.issues.filter(i=>i.severity==='hard').map(i=>i.detail)).slice(0,6),next:d.genome.name});
    p.config.pieces.genome=d.genome;await applyFrame(p,log);if(job.request.pieceSounds==='auto')await addPieceSounds(p,job.request.soundKit,log);
    await rememberStyle(d.genome.name,jobId,d.genome);await save(p);fp=await fingerprint(p);evidence=await preview(p,job.request.previewScale);
   }
   if(evidence.quality)await log('quality',{score:evidence.quality.score,passed:evidence.quality.passed,hard:evidence.quality.hard,soft:evidence.quality.soft});
   job.status='preview-review';job.fingerprint=fp;delete job.error;await writeJSON(jobFile,job);
   return {job:jobId,project:p.id,status:job.status,preview:evidence,director:p.config.director,warnings:p.directorWarnings,...(artDirection?{artDirector:{before:artDirection.before,after:artDirection.after,changes:artDirection.changes.map(c=>`scene ${c.scene+1}: ${c.how==='layout'?c.from+' moved and resized':c.how==='variant'?c.from+' drawn again':c.from+' → '+c.to} (${c.scoreBefore} → ${c.scoreAfter}${c.fixed.length?', fixed '+c.fixed.join(', '):''})`),notes:artDirection.kept.flatMap(k=>k.issues.map(i=>`scene ${k.scene+1}: ${i}`)).slice(0,8)}}:{}),quality:evidence.quality?{score:evidence.quality.score,passed:evidence.quality.passed,issues:evidence.quality.scenes.flatMap(s=>s.issues.map(i=>`${s.scene}: ${i.severity} ${i.kind}: ${i.detail}`)).slice(0,12)}:undefined,
    next:(evidence.quality&&!evidence.quality.passed?'Quality checks found problems (see quality); fix them or tell the user, then ':'')+'Inspect all sheets, then video:create --resume '+jobId+' --approve-preview'};
  }
  job.status='rendering';await writeJSON(jobFile,job);await options.onPhase?.('rendering',p.id);const output=await render(p,true);
  job.status='complete';job.output=output.file;job.fingerprint=await fingerprint(p);delete job.error;await writeJSON(jobFile,job);
  await log('complete',{...output,elapsedMs:performance.now()-started});
  // Sound check on the finished file (never blocks delivery).
  let sound:import('../renderer/visual-qa.js').SoundQuality|undefined;
  try{sound=await (await import('./sound-quality.js')).soundQuality(output.file,p);await log('sound-quality',sound);}catch(e){await log('sound-quality',{error:String(e)});}
  if(job.request.purpose==='production'){
   // Learning: every finished video is recorded in the brain (never blocks delivery).
   try{const {recordJob}=await import('./brain/brain.js');
    recordJob({id:jobId,kind:'video',title:job.request.title,brief:job.request.script.slice(0,400),language:p.config.language,format:job.request.aspectRatio,preset:job.request.preset,
     durationSeconds:validateTimeline(p.scenes,p.script),scenes:p.scenes.length,pieces:p.scenes.map(s=>s.piece?.designed?.archetype??(s.piece?'composed':'none')),transitions:[...new Set(p.scenes.map(s=>s.piece?.transition??p.config.transition))],
     renderSeconds:Math.round((performance.now()-started)/1000),output:output.file,checks:{voiceover:!!job.request.voiceover,sceneVisuals:job.request.sceneVisuals.length,sound:sound??null,pieceStyle:p.config.pieces?.genome?.name??null,genome:p.config.pieces?.genome?.id??null},
     ...(p.config.pieces?.genome?{applied:[...(await (await import('./style-choice.js')).registerTraits(p.config.pieces.genome)),...(await (await import('./style-choice.js')).registerDesigns(p.scenes.map(s=>s.piece)))]}:{})});
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
  // Credits for music that asks for them (CC BY tracks from the library).
  {const m=p.media.find(x=>x.metadata?.autoMusic);if(m){finishing.music={title:m.metadata.title,source:m.metadata.source,mood:m.metadata.mood,license:m.metadata.license,...(m.metadata.credit?{credit:m.metadata.credit}:{})};
   if(m.metadata.credit){const f=output.file.replace(/\.[^.]+$/,'')+'.credits.txt';try{await fs.writeFile(f,'Music: '+m.metadata.credit+'\n',{flag:'wx'});(finishing.music as Record<string,unknown>).creditsFile=f;}catch{/* already there */}}}}
  // Captions: the script timed by the voice, beside the video and each other shape.
  if(job.request.captions!=='off'&&p.scenes.some(s=>s.wordCues?.length)){
   try{const shapes=((finishing.formats??[]) as {file:string}[]).map(x=>x.file);
    const c=await (await import('../editor/subtitles.js')).exportCaptions(p,[output.file,...shapes],{burn:job.request.captions==='burned'});
    if(c){finishing.captions=c;await log('captions',c);}
   }catch(e){finishing.captionsError=String(e);await log('captions',{error:String(e)});}
  }
  return {job:jobId,status:'complete',...output,...(Object.keys(finishing).length?{finishing}:{}),...(sound?{sound}:{})};
 }catch(error){job.status='failed';job.error=String(error);await writeJSON(jobFile,job);await log('failed',{error:job.error});throw new Error('Job '+jobId+' failed: '+job.error+'; resume with --resume '+jobId);}
}




type Project=import('./schema.js').Project;
type Log=(stage:string,data:unknown)=>Promise<void>;
/** One sound bed with every piece's cues, in the style's kit and tuning (never blocks the video). */
async function addPieceSounds(p:Project,soundKit:string,log:Log){
 if(!p.scenes.some(s=>s.piece))return;
 p.media=p.media.filter(m=>!m.metadata?.pieceSounds);
 try{const {skinFor}=await import('../components/pieces/skins.js');
  const kit=(soundKit==='auto'?skinFor(p.config.pieces?.genome).sound:soundKit) as import('./sound-kits.js').SoundKit;
  const g=p.config.pieces?.genome;const bed=await pieceSoundBed(p,kit,g?{pitch:g.sound.pitch,bright:g.sound.bright}:{});
  if(bed){await importMedia(p,bed.file,'sfx',0);const m=p.media.at(-1)!;m.metadata={...m.metadata,pieceSounds:true,kit,cues:bed.cues.map(c=>({time:c.time,scene:c.scene,sound:c.sound,why:c.why}))};
   await fs.rm(bed.dir,{recursive:true,force:true});await log('piece-sounds',{cues:bed.cues.length,kit});}
 }catch(e){await log('piece-sounds',{error:String(e)});}
}
/** The look the request asks for (a missing one stops the job with the saved looks named). */
async function likeFor(request:z.infer<typeof productionRequest>){
 if(!request.like)return undefined;const l=await (await import('./looks.js')).readLook(request.like);return {name:l.name,steer:l.steer,summary:l.summary,mood:l.music.mood,bpm:l.music.bpm,look:l};
}
/** The look's music mood (unless the request chose one) and tempo. */
async function withLikeMood(request:z.infer<typeof productionRequest>){
 const l=await likeFor(request);return l?{...request,musicMood:request.musicMood??l.mood,likeBpm:l.bpm}:request;
}
/** Background music cut to the video (a library track or an original score), lowered under the voice. */
async function addMusic(p:Project,request:z.infer<typeof productionRequest>&{likeBpm?:number},jobId:string,log:Log){
 const own=p.media.some(m=>m.kind==='music'&&!m.metadata?.autoMusic);
 if(request.music==='off'||own||p.referenceWorkflow||request.director||request.explainer||request.pendulum||request.presenterInserts||p.media.some(m=>m.kind==='video'))return;
 p.media=p.media.filter(m=>!m.metadata?.autoMusic);
 const duration=p.scenes.reduce((a,s)=>Math.max(a,s.start+s.duration),0);if(duration<2)return;
 const tmp=await fs.mkdtemp(path.join(dir(p.id,p.config),'music-'));
 try{const {musicFor}=await import('./music/library.js');const voice=p.media.some(m=>m.kind==='voice');
  const m=await musicFor({script:p.script,duration,seed:jobId,cuts:p.scenes.map(s=>s.start),genome:p.config.pieces?.genome,mood:request.musicMood,underVoice:voice,
   prefer:request.music==='auto'?undefined:request.music,out:path.join(tmp,'music.m4a'),bpm:request.likeBpm});
  await importMedia(p,m.file,'music',0);const media=p.media.at(-1)!;
  // Under a voice it sits lower and ducks while words are spoken; alone it carries the video.
  media.metadata={...media.metadata,autoMusic:true,gain:voice?.3:.55,loop:false,...m,file:undefined};
  await log('music',{source:m.source,title:m.title,mood:m.mood,bpm:m.bpm,license:m.license});
 }catch(e){if(request.music==='library')throw e;await log('music',{error:String(e)});}
 finally{await fs.rm(tmp,{recursive:true,force:true});}
}
/** Paints the whole frame in the video's generated style. */
async function applyFrame(p:Project,log:Log){
 if(!p.config.pieces?.genome||p.config.director||p.config.referenceStyle||p.config.explainer)return;
 const {frameFor}=await import('../components/pieces/frame.js');const f=frameFor(p.config.pieces.genome,p.config.pieces);
 p.config.frame=f;p.config.background='solid';p.config.white=f.background;p.config.ink=f.text;p.config.primary=f.highlight;p.config.muted=f.muted;
 for(const s of p.scenes)if(!s.motion||s.motion.duration===.55)s.motion={duration:.55,easing:f.easing,intensity:f.intensity};
 await log('frame',{background:f.background,text:f.text,highlight:f.highlight,pattern:f.pattern.kind,font:f.font});
}
