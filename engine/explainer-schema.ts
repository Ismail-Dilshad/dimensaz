import {z} from 'zod';

export const iconNames=['store','bag','hidden','diamond','price','pin','video','hourglass','megaphone','message','people','target','seed','sun','water','sprout','leaf','flower','folder','list','timer','check','flag','book'] as const;
export const briefSchema=z.object({topic:z.string().min(3),industry:z.string().min(2),audience:z.string().min(3),emotion:z.string().min(2),tone:z.string().min(2),domain:z.enum(['commerce','nature','learning','productivity','general'])}).strict();
const color=z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const explainerStyleSchema=z.object({palette:z.string().min(1),background:color,ink:color,accent:color,tint:color,backgroundStyle:z.enum(['none','grid','dots','gradient','texture','mesh']),iconSet:z.enum(['rounded','geometric','organic']),iconRendering:z.enum(['outline','duotone','solid']),highlight:z.enum(['underline','pill','color']),duration:z.number().min(.4).max(.6),font:z.string().min(1)}).strict();
export const explainerRequestSchema=z.object({brief:briefSchema,overrides:explainerStyleSchema.partial().default({})}).strict();
export const explainerThemeSchema=explainerStyleSchema.extend({version:z.literal(1),brief:briefSchema,rationale:z.array(z.string()).min(1),warnings:z.array(z.string()),explicit:z.array(z.string())}).strict();
export type ExplainerTheme=z.infer<typeof explainerThemeSchema>;
export const explainerSceneSchema=z.object({
 template:z.enum(['hook','problem','comparison','steps','stat','cta']),
 icons:z.array(z.object({name:z.enum(iconNames),meaning:z.string().min(8),callback:z.string().min(12).optional(),at:z.number().nonnegative().default(0)}).strict()).min(1).max(4),
 phrases:z.array(z.object({from:z.number().int().nonnegative(),to:z.number().int().positive(),at:z.number().nonnegative(),highlight:z.boolean().default(false)}).strict()).min(1),
 transition:z.enum(['match-slide','match-cut']).default('match-slide'),transitionReason:z.string().min(12),
 copyCallback:z.string().min(12).optional()
}).strict();
