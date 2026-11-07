// The user's brand profile (config/brand.json): logo, colors, fonts, voice and preferences.
// The agent applies it to every video; reference recreations use it instead of the reference's branding.
import fs from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {ROOT} from './config-root.js';
const hex=z.string().regex(/^#[0-9a-f]{6}$/i);
export const brandSchema=z.object({
 version:z.literal(1),name:z.string().min(1),note:z.string().optional(),
 logo:z.object({primary:z.string().optional(),onLight:z.string().optional(),onDark:z.string().optional(),mark:z.string().optional(),placement:z.enum(['end-card','corner','intro','none']).default('end-card'),minWidthPx:z.number().int().positive().default(120)}).default({placement:'end-card',minWidthPx:120}),
 colors:z.object({primary:hex,accent:hex,background:hex,text:hex,neutral:hex.optional()}).partial().default({}),
 fonts:z.record(z.string(),z.string().nullable()).default({}),
 voice:z.object({tone:z.string().optional(),avoid:z.array(z.string()).default([])}).default({avoid:[]}),
 preferences:z.object({autoMotion:z.boolean().default(true),format:z.enum(['9:16','1:1','16:9']).default('9:16'),captions:z.enum(['auto','on','off']).default('auto'),sfx:z.enum(['auto','on','off']).default('auto')}).default({autoMotion:true,format:'9:16',captions:'auto',sfx:'auto'}),
}).passthrough();
export type Brand=z.infer<typeof brandSchema>;
export const BRAND_FILE=path.join(ROOT,'config','brand.json');
/** Missing profile means defaults (automatic motion on). An invalid profile is an error, never silently ignored. */
export async function brandProfile():Promise<Brand>{
 const text=await fs.readFile(BRAND_FILE,'utf8').catch(e=>{if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;});
 return brandSchema.parse(text?JSON.parse(text):{version:1,name:'Unbranded'});
}
