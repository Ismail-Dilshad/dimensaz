import {z} from 'zod';

// Normalized badge center and cord intersection with the upper frame edge.
export const pendulumStyleSchema=z.object({
 brand:z.string().trim().min(1).max(40),footer:z.string().trim().max(90),
 showTopBrand:z.boolean().optional(),topImageId:z.string().uuid().optional(),badgeImageId:z.string().uuid().optional(),
 referenceLook:z.enum(['green-saas-pendulum','light-editorial-pendulum']).optional(),
 palette:z.literal('monochrome-blue-answers').optional(),
 headlineFit:z.literal('proportional').optional(),
 sourceHash:z.string().regex(/^[a-f0-9]{64}$/),sampleFps:z.number().int().positive().max(120),
 samples:z.array(z.tuple([z.number().min(0).max(1),z.number().min(.1).max(.9),z.number().min(0).max(1)])).min(2).max(3600),
 center:z.string().regex(/^#[a-fA-F0-9]{6}$/),edge:z.string().regex(/^#[a-fA-F0-9]{6}$/)
}).strict();
