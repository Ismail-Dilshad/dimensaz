import {z} from 'zod';
import {referenceStyleIds} from './reference-motion-schema.js';
const color=z.string().regex(/^#[a-f0-9]{6}$/i);
export const directorValuesSchema=z.object({
 referenceStyle:z.enum(referenceStyleIds).optional(),
 creativeDirection:z.enum(['saas','viral','minimal','clay','glass','cinematic','editorial','hybrid']),
 background:z.enum(['solid','white-grid','black-grid','soft-gradient','flow-gradient','abstract','subtle-noise']),
 grid:z.object({spacing:z.number().min(40).max(240),opacity:z.number().min(0).max(.2),color,width:z.number().min(.5).max(3),geometry:z.enum(['square','dotted']),movement:z.enum(['static','horizontal','vertical','diagonal']),speed:z.number().min(0).max(10)}).strict(),
 palette:z.object({primary:color,background:color,text:color,highlight:color}).strict(),
 illustrations:z.enum(['none','existing-assets']),
 composition:z.enum(['center','stack','card']),
 animation:z.object({energy:z.number().min(0).max(1),duration:z.number().min(.1).max(1.5),easing:z.enum(['linear','smooth','cubic','back','elastic','bounce'])}).strict(),
 camera:z.enum(['static','gentle-zoom','pan']),
 transitions:z.enum(['cut','fade','slide','zoom','mask']),
 typography:z.object({font:z.string().min(1),size:z.number().min(14).max(240),lineHeight:z.number().min(1).max(2),align:z.enum(['center','start','end']),position:z.enum(['center','top','bottom']),width:z.number().min(.5).max(1)}).strict(),
 textReveal:z.enum(['sentence','progressive','active','replacement','phrase']),
 textEntrance:z.enum(['fade','slide-up','slide-down','slide-left','slide-right','bounce','spring','scale','blur','mask']),
 textExit:z.enum(['cut','fade','slide','scale','blur']),
 textHighlight:z.enum(['color','underline','background','scale','none']),
 objectEntrance:z.enum(['fade','pop','slide-up','spring']),
 soundEffects:z.boolean(),soundSelection:z.enum(['automatic','approval','manual']),soundPlacement:z.enum(['automatic','approval','manual']),
 soundSynchronization:z.array(z.enum(['word','icon','transition'])).min(1),
 soundIntensity:z.enum(['subtle','balanced','energetic']),soundCategories:z.array(z.enum(['clicks','pops','whooshes','impacts','notifications','digital','ticks'])).min(1),
 backgroundMusic:z.enum(['off','provided']),
 audioMixing:z.object({voiceGain:z.number().min(.1).max(2),musicGain:z.number().min(0).max(.5),sfxGain:z.number().min(0).max(.8),ducking:z.boolean()}).strict(),
 export:z.object({width:z.number().int().min(160).max(3840).refine(n=>n%2===0),height:z.number().int().min(160).max(3840).refine(n=>n%2===0),fps:z.union([z.literal(24),z.literal(30),z.literal(60),z.literal(120)]),crf:z.number().int().min(14).max(30)}).strict()
}).strict();
export type DirectorValues=z.infer<typeof directorValuesSchema>;
export const directorSchema=z.object({version:z.literal(1),selection:z.record(z.string(),z.object({mode:z.enum(['explicit','auto','default','skip']),value:z.unknown().optional()}).strict()),resolved:directorValuesSchema,confirmed:z.boolean().default(false),sceneOverrides:z.record(z.string(),directorValuesSchema.partial()).default({})}).strict();
export type Director=z.infer<typeof directorSchema>;
export const factoryStyle:DirectorValues={creativeDirection:'saas',background:'white-grid',grid:{spacing:90,opacity:.06,color:'#111318',width:1,geometry:'square',movement:'static',speed:2},palette:{primary:'#2563eb',background:'#ffffff',text:'#111318',highlight:'#2563eb'},illustrations:'existing-assets',composition:'center',animation:{energy:.45,duration:.45,easing:'cubic'},camera:'static',transitions:'fade',typography:{font:'auto',size:84,lineHeight:1.35,align:'center',position:'center',width:1},textReveal:'sentence',textEntrance:'slide-up',textExit:'fade',textHighlight:'color',objectEntrance:'pop',soundEffects:false,soundSelection:'automatic',soundPlacement:'automatic',soundSynchronization:['icon','transition'],soundIntensity:'subtle',soundCategories:['pops','whooshes'],backgroundMusic:'off',audioMixing:{voiceGain:1,musicGain:.12,sfxGain:.16,ducking:true},export:{width:1080,height:1920,fps:60,crf:18}};
export const directorLimitations=[
 '3D styles use existing 2.5D assets; real-time 3D, material relighting and mesh morphing are unavailable.',
 'Unsupported: curved/perspective grids, arbitrary keyframes, character/line reveals, true glass refraction, motion blur and object morph transitions.',
 'Music must be supplied with permission; automatic music sourcing and audio synthesis are unavailable.',
 'Sound acquisition uses the existing reviewed asset workflow; the director never downloads or assumes licenses automatically.',
 'Auto is deterministic local creative rules, not an external language model. Spoken-word modes require reviewed acoustic cues; missing cues block final rendering.'
];
export function styleForScene(d:Director,id:string){return directorValuesSchema.parse({...d.resolved,...d.sceneOverrides[id]});}
