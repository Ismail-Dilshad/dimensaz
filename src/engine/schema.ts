import {explainerThemeSchema,explainerSceneSchema} from './explainer-schema.js';
import {pendulumStyleSchema} from './pendulum-style.js';
import {presenterInsertsSchema} from './presenter-inserts.js';
import {referenceStyleSchema,referenceSceneSchema} from './reference-motion-schema.js';
import {directorSchema,directorValuesSchema} from './style-director-schema.js';
import {styleDNASchema} from './style-dna.js';
import { z } from 'zod';
import {languageSchema} from './languages.js';
import {animationNames} from '../animations/animation-registry.js';
// Saved projects made before 3.3.0 point at the removed duplicate assets/Rabar_021.ttf.
const LEGACY_FONTS:Record<string,string>={'assets/Rabar_021.ttf':'assets/fonts/Rabar-021-Bold.ttf'};
export const legacyFontPath=(p:string)=>LEGACY_FONTS[p.replaceAll('\\','/')]??p;
export const configSchema = z.object({
 pendulum:pendulumStyleSchema.optional(),
 presenterInserts:presenterInsertsSchema.optional(),
 explainer:explainerThemeSchema.optional(),
 referenceStyle:referenceStyleSchema.optional(),
 director:directorSchema.optional(),
 illustrationLayout:z.enum(['classic','clay-stage']).optional(),
 renderPurpose:z.enum(['production','test']).default('production'),exportCategory:z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/).default('general'),
 language:languageSchema.default('en'),
 textTreatment:z.enum(['classic','kinetic']).default('classic'),
 voiceTiming:z.enum(['estimated','required','acoustic']).default('estimated'),
 backgroundDesign:z.object({gridSize:z.number().min(40).max(240),gridOpacity:z.number().min(0).max(.2),gridColor:z.string().regex(/^#[0-9a-f]{6}$/i),glow:z.boolean(),drift:z.number().min(0).max(10)}).optional(),
 width:z.number().int().min(160).max(3840).refine(n=>n%2===0,'Width must be even'),
 height:z.number().int().min(160).max(3840).refine(n=>n%2===0,'Height must be even'),
 fps:z.number().int().min(1).max(120), crf:z.number().int().min(0).max(51),
 referenceQuery:z.string().default(''),useReferences:z.boolean().default(true),mode:z.literal('auto-directed'), theme:z.enum(['minimal-kinetic','saas-motion','clay-motion','bold-viral','editorial','highlight-explainer']),
 background:z.enum(['white-grid','black-grid','solid','soft-gradient','subtle-noise','abstract','flow-gradient']),
 progress:z.boolean(), visuals:z.boolean(), fit:z.enum(['cover','contain','background-fill']),
 safeX:z.number().min(.04).max(.3),safeTop:z.number().min(.04).max(.3),safeBottom:z.number().min(.04).max(.4),
 fontSize:z.number().positive(),minFontSize:z.number().positive(),fontWeight:z.number().int().min(100).max(900).optional(),lineHeight:z.number().min(1).max(2),
 reducedMotion:z.boolean(),animation:z.union([z.literal('auto-directed'),z.enum(animationNames)]),transition:z.enum(animationNames),transitionDuration:z.number().min(0).max(2),
 primary:z.string().regex(/^#[\da-f]{6}$/i),ink:z.string(),white:z.string(),dark:z.string(),muted:z.string(),radius:z.number(),
 font:z.string().transform(legacyFontPath),fallbacks:z.array(z.string().transform(legacyFontPath)),direction:z.enum(['auto','rtl','ltr']),preserveText:z.literal(true),
 intensity:z.number().min(0).max(1),entrance:z.number().positive(),exit:z.number().positive(),wordsPerSecond:z.number().positive(),minSceneDuration:z.number().positive(),
 captureConcurrency:z.number().int().min(1).max(4).default(1),reuseRenderCache:z.boolean().default(true),codec:z.enum(['libx264','h264_nvenc','auto']),pixelFormat:z.literal('yuv420p'),preset:z.string(),workspace:z.string(),output:z.string(),
 preserveOriginal:z.boolean(),originalVolume:z.number().min(0).max(2),voiceVolume:z.number().min(0).max(2),musicVolume:z.number().min(0).max(2),
 fadeIn:z.number().min(0),fadeOut:z.number().min(0),normalize:z.boolean()
}).refine(c=>c.safeTop+c.safeBottom<.8,'Safe area too small').refine(c=>c.minFontSize<=c.fontSize,'Invalid font size range');
export type Config=z.infer<typeof configSchema>;
export const roles=['hook','question','problem','explanation','comparison','benefit','statistic','product','brand','cta'] as const;
export const sceneSchema=z.object({
 explainer:explainerSceneSchema.optional(),
 referenceMotion:referenceSceneSchema.optional(),
 director:directorValuesSchema.optional(),
 wordCues:z.array(z.object({from:z.number().int().nonnegative(),to:z.number().int().positive(),start:z.number().nonnegative(),end:z.number().positive()})).optional(),
 emphasisScale:z.number().min(1).max(1.6).default(1.22),
 id:z.string(),text:z.string().min(1),start:z.number().nonnegative(),duration:z.number().positive(),direction:z.enum(['rtl','ltr']),
 role:z.enum(roles),animation:z.enum(animationNames),layout:z.enum(['center','stack','split','card','counter']),highlights:z.array(z.object({start:z.number().int().nonnegative(),end:z.number().int().positive()})),
 asset:z.string().optional(),number:z.number().optional(),
 objectMotion:z.enum(['float','pendulum']).optional(),
 motion:z.object({duration:z.number().min(.2).max(.9),easing:z.enum(['linear','smooth','cubic','back','elastic','bounce']),intensity:z.number().min(.1).max(.9)}).optional(),
 reference:z.object({id:z.string(),contentHash:z.string(),source:z.string(),technique:z.string(),start:z.number(),end:z.number(),approximate:z.boolean(),notes:z.array(z.string())}).optional()
}).superRefine((s,ctx)=>{
 const headline=s.referenceMotion?.headline;
 if(headline){const words=[...s.text.matchAll(/\S+/gu)];if(!words.some(w=>w.index===headline.from)||!words.some(w=>w.index+w[0].length===headline.to)||headline.to<=headline.from)ctx.addIssue({code:'custom',message:'Reference headline must select complete source words.'});}
 if(!s.wordCues)return;
 const tokens=[...s.text.matchAll(/\S+/gu)];
 let end=0;
 if(s.wordCues.length!==tokens.length)ctx.addIssue({code:'custom',message:'Speech cues must cover every whole word'});
 s.wordCues.forEach((cue,i)=>{
  const token=tokens[i];
  if(!token||cue.from!==token.index||cue.to!==token.index+token[0].length||cue.start<end-.00001||cue.end<=cue.start||cue.end>s.duration+.001)ctx.addIssue({code:'custom',message:'Invalid word cue offsets or scene-relative timing'});
  end=cue.end;
 });
});
export type Scene=z.infer<typeof sceneSchema>;
export const mediaSchema=z.object({id:z.string(),path:z.string(),kind:z.enum(['video','image','voice','music','sfx']),metadata:z.any().optional(),at:z.number().nonnegative().default(0)});
export const projectSchema=z.object({
 referenceWorkflow:z.object({version:z.literal(1)}).strict().optional(),
 directorWarnings:z.array(z.string()).optional(),
 soundTimeline:z.array(z.object({id:z.string(),eventId:z.string(),sceneId:z.string(),type:z.enum(['word','icon','transition']),time:z.number().nonnegative(),offset:z.number().min(-1).max(1),duration:z.number().positive().max(10),gain:z.number().min(0).max(1),fadeIn:z.number().min(0).max(1),fadeOut:z.number().min(0).max(1),priority:z.number(),confidence:z.number().min(0).max(1),mediaId:z.string(),source:z.string(),license:z.string(),manual:z.boolean(),approved:z.boolean(),disabled:z.boolean()}).strict()).optional(),
 speechAnchors:z.array(z.object({kind:z.enum(["object","camera","sfx"]),wordIndex:z.number().int().nonnegative(),edge:z.enum(["start","end"]).default("start"),offset:z.number().min(-1).max(1).default(0),mediaId:z.string().optional()}).strict()).optional(),
 styleDNA:styleDNASchema.optional(),assetLocks:z.array(z.object({id:z.string(),path:z.string(),hash:z.string().regex(/^[a-f0-9]{64}$/),source:z.string(),license:z.string(),tags:z.array(z.string()),width:z.number(),height:z.number(),provenance:z.unknown().optional(),libraryEvidence:z.unknown().optional()})).optional(),schemaVersion:z.literal(1).default(1),
 production:z.object({preset:z.string(),sfx:z.enum(['off','auto']).default('off')}).optional(),
 acousticAlignment:z.object({analysisPath:z.string(),wordConfidence:z.array(z.number().min(0).max(1)),analysisSha256:z.string().regex(/^[a-f0-9]{64}$/),sourceAudioSha256:z.string().regex(/^[a-f0-9]{64}$/),authorization:z.literal('user-authorized-automatic-alignment'),accuracy:z.literal('machine-aligned-not-human-reviewed')}).strict().optional(),
 alignmentEvidence:z.object({audioSha256:z.string().regex(/^[a-f0-9]{64}$/),method:z.enum(['provider','forced-aligner','manual-review']),source:z.string().min(1),reviewed:z.literal(true)}).optional(),
 id:z.string(),title:z.string(),slug:z.string(),sequence:z.number().int().positive(),createdAt:z.string(),version:z.number().int().positive(),
 script:z.string(),config:configSchema,scenes:z.array(sceneSchema),media:z.array(mediaSchema),exports:z.array(z.string()),parentId:z.string().optional()
});
export type Project=z.infer<typeof projectSchema>;

