import {z} from 'zod';
export const categories=[
 'Viral Typography','CapCut-Style Animations','Instagram Reels','SaaS Motion Graphics',
 'Claymorphism and 3D','Text Transitions','Object Animations','Camera Movements','Motion Effects','Tutorials'
] as const;
export const categorySchema=z.enum(categories);
export const techniqueSchema=z.object({
 name:z.string().min(1),start:z.number().nonnegative(),end:z.number().positive(),
 confidence:z.number().min(0).max(1),evidence:z.string().min(1),
 implementation:z.array(z.string()),presets:z.array(z.string()).default([]),
 assetTags:z.array(z.string()).default([]),roles:z.array(z.string()).default([]),
 guidance:z.object({objectMotion:z.enum(['float','pendulum']).optional(),entranceSeconds:z.number().min(.2).max(.9),easing:z.enum(['linear','smooth','cubic','back','elastic','bounce']),intensity:z.number().min(.1).max(.9)}).optional(),
 approximate:z.boolean().default(true)
}).refine(t=>t.end>t.start,'Technique range must be positive');
export const reviewSchema=z.object({
 contentHash:z.string().regex(/^[a-f0-9]{64}$/),
 kind:z.enum(['finished-animation','tutorial','demonstration','mixed','uncertain']),
 confidence:z.number().min(0).max(1),
 categories:z.array(categorySchema),tags:z.array(z.string()),
 description:z.string().min(1),techniques:z.array(techniqueSchema),
 typography:z.string(),composition:z.string(),effects:z.string(),easing:z.string(),
 tutorial:z.object({
  interface:z.string(),animationRegions:z.string(),steps:z.array(z.string()),
  limitations:z.string()
 }).optional(),
 uncertainties:z.array(z.string()),reviewer:z.string().min(1),reviewedAt:z.string().optional()
});
export type Review=z.infer<typeof reviewSchema>;
export const recordSchema=z.object({
 id:z.string(),source:z.string(),name:z.string(),size:z.number(),mtimeMs:z.number(),
 contentHash:z.string(),available:z.boolean(),status:z.enum(['analyzed','error']),
 error:z.string().optional(),analyzerVersion:z.number(),analyzedAt:z.string(),
 media:z.object({duration:z.number(),width:z.number(),height:z.number(),fps:z.number(),audio:z.boolean()}).optional(),
 automatic:z.object({
  kind:z.enum(['finished-animation','tutorial','demonstration','mixed','uncertain']),
  confidence:z.number(),categories:z.array(categorySchema),tags:z.array(z.string()),
  description:z.string(),uncertainties:z.array(z.string())
 }),
 measurements:z.object({
  sampledWindow:z.number(),cutCandidates:z.array(z.number()),
  meanLumaDifference:z.number().optional(),motionSamples:z.number(),notes:z.array(z.string())
 }).optional(),
 previews:z.array(z.object({time:z.number(),path:z.string()})),
 contactSheet:z.string().optional(),
 clips:z.array(z.object({start:z.number(),duration:z.number(),path:z.string()})).default([]),
 review:reviewSchema.optional()
});
export type ReferenceRecord=z.infer<typeof recordSchema>;
export const indexSchema=z.object({
 version:z.literal(1),updatedAt:z.string(),categories:z.array(categorySchema),records:z.array(recordSchema)
});
export type ReferenceIndex=z.infer<typeof indexSchema>;
export type ReferenceMatch={record:ReferenceRecord;score:number;technique?:Review['techniques'][number]};
