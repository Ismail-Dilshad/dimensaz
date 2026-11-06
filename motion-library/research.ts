import fs from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {MANAGED} from './paths.js';
import {categorySchema} from './model.js';
import {writeJSON} from '../engine/project.js';
export const researchSchema=z.object({
 url:z.string().url().refine(u=>u.startsWith('https://'),'Use an HTTPS source'),
 title:z.string().min(1),publisher:z.string().min(1),checkedAt:z.string(),
 categories:z.array(categorySchema),findings:z.array(z.string().min(1)).min(1),
 implementation:z.array(z.string()),limitations:z.string(),primarySource:z.literal(true)
});
export async function saveResearch(file:string){
 const data=researchSchema.parse(JSON.parse(await fs.readFile(file,'utf8')));
 const target=path.join(MANAGED,'sources.json');let sources:z.infer<typeof researchSchema>[]=[];
 try{sources=JSON.parse(await fs.readFile(target,'utf8')).map((s:unknown)=>researchSchema.parse(s));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 const i=sources.findIndex(s=>s.url===data.url);if(i<0)sources.push(data);else sources[i]=data;
 await writeJSON(target,sources);return data;
}
