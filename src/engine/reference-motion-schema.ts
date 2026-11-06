import {z} from 'zod';

// Keep off-frame voice cues exact. Count the video samples in [start, end).
export function sceneScoreFrames(start:number,end:number,fps:number){
 return Math.ceil(end*fps-1e-8)-Math.ceil(start*fps-1e-8);
}

export const referenceStyleIds=['style-1','style-2','style-3','style-4','style-5','style-6','style-7'] as const;
export const cardNames=['Blue Editorial','Classic','Red Signal','Apricot Miniatures','Emerald Contrast','Lavender Glass','Green Beacon','Tangerine Counter'] as const;
export const cardNameSchema=z.enum(cardNames);
export type CardName=z.infer<typeof cardNameSchema>;
const color=z.string().regex(/^#[a-f0-9]{6}$/i);
export const referenceStyleSchema=z.object({
 card:cardNameSchema.optional(),
 version:z.literal(1),id:z.enum(referenceStyleIds),name:z.string(),
 background:color,corner:color,accent:color,ink:color,onAccent:color,shadow:color,
 grid:z.object({geometry:z.enum(['square','dotted']),color,spacing:z.number().min(40).max(240),opacity:z.number().min(0).max(1),width:z.number().min(1).max(4).optional()}).strict(),
 lines:z.object({count:z.number().int().min(0).max(4),color,opacity:z.number().min(0).max(.3),angle:z.number().min(-80).max(80),width:z.number().min(1).max(18).optional()}).strict(),
 material:z.string(),lighting:z.string(),texture:z.enum(['flat','paper','glass']),
 motion:z.enum(['smooth','snappy','gentle']),
}).strict();
export type ReferenceStyle=z.infer<typeof referenceStyleSchema>;
export const entranceSchema=z.enum(['rise','drop','left','right','pop','fade']);
export const mechanismKeyframeSchema=z.object({
 at:z.number().min(0).max(1),x:z.number().min(-.8).max(.8).default(0),y:z.number().min(-.8).max(.8).default(0),
 rotation:z.number().min(-360).max(360).default(0),scale:z.number().min(.05).max(3).default(1),opacity:z.number().min(0).max(1).default(1),
 easing:z.enum(['linear','smooth','cubic']).default('smooth')
}).strict();
const rectSchema=z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1),w:z.number().positive().max(1),h:z.number().positive().max(1)}).strict().refine(r=>r.x+r.w<=1.00001&&r.y+r.h<=1.00001,'Composition rectangle exceeds frame');
const originSchema=z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1)}).strict();
const trackSchema=z.array(mechanismKeyframeSchema).min(2).max(24)
 .refine(keys=>keys.every((k,i)=>i===0||k.at>keys[i-1].at),'Mechanism keyframes must have strictly increasing scene-time fractions');
export const referencePartSchema=z.object({
 beat:z.object({start:z.number().nonnegative(),duration:z.number().min(.4).max(.6),fromX:z.number().min(-.5).max(.5).default(0),fromY:z.number().min(-.5).max(.5).default(0),fromRotation:z.number().min(-90).max(90).default(0),fromScale:z.number().min(.6).max(1.3).default(1),fromOpacity:z.number().min(0).max(1).default(1)}).strict().optional(),
 asset:z.string().min(1),role:z.enum(['part','accent']),
 x:z.number().min(.05).max(.95),y:z.number().min(.05).max(.95),
 width:z.number().min(.02).max(.85),height:z.number().min(.02).max(.8),
 depth:z.enum(['behind','front']).default('front'),
 delay:z.number().min(0).max(.65).default(.12),
 entrance:entranceSchema.default('pop'),rotation:z.number().min(-180).max(180).default(0),
 travelX:z.number().min(-.8).max(.8).default(0),travelY:z.number().min(-.8).max(.8).default(0),
 loop:z.enum(['none','float','pulse','rotate']).default('float'),
 action:z.string().min(1).optional(),
 origin:originSchema.optional(),
 keyframes:trackSchema.optional(),
}).strict();
export const referenceSceneSchema=z.object({
 metaphor:z.string().trim().min(1),
 headline:z.object({from:z.number().int().nonnegative(),to:z.number().int().positive()}).strict().optional(),
 layout:z.enum(['headline-top','headline-bottom','headline-left','headline-right']),
 entrance:entranceSchema.default('rise'),
 transition:z.enum(['fade','wipe','push','cut']).default('fade'),
 camera:z.enum(['static','push','pull','pan']).default('push'),
 rotation:z.number().min(-180).max(180).default(0),
 ghost:z.boolean().default(false),
 // Authored visual reveal only; reviewed voice cues always take precedence.
 headlineRevealSeconds:z.number().min(.15).max(2).optional(),
 highlightJoin:z.boolean().optional(),
 // Optional authored composition. Old manifests keep their existing layout.
 composition:z.object({hero:rectSchema,text:rectSchema,textDepth:z.enum(['behind','front']).default('front')}).strict().optional(),
 continuity:z.enum(['new','carry-hero']).optional(),
 heroLoop:z.enum(['none','float']).optional(),
 scoreFrames:z.number().int().positive().optional(),
 heroMotion:z.object({origin:originSchema,action:z.string().trim().min(1),keyframes:trackSchema}).strict().optional(),
 holdArtwork:z.literal(true).optional(),
 evidence:z.array(z.string().min(1)).optional(),
 layers:z.array(referencePartSchema).max(16).default([]),
}).strict().superRefine((s,ctx)=>{
 if(s.layers.filter(l=>l.role==='accent').length>2)ctx.addIssue({code:'custom',message:'Use at most two supporting accents; split hero mechanisms into part layers.'});
});
export type ReferenceScene=z.infer<typeof referenceSceneSchema>;

