// The consolidated reference library (references/catalog.json): one folder per reusable style
// with a written reference (style.md), data (style.json) and a few hash-pinned frames, plus
// motion references. Old paths from the previous library layout map to kept frames.
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {ROOT} from './config-root.js';

const frameSchema=z.object({path:z.string(),sha256:z.string().regex(/^[a-f0-9]{64}$/),alias:z.string(),subject:z.string()}).strict();
export const catalogSchema=z.object({version:z.literal(1),description:z.string(),
 styles:z.array(z.object({id:z.string(),name:z.string(),kind:z.literal('card'),folder:z.string(),aliases:z.array(z.string()),frames:z.array(frameSchema),motionSheet:z.string().nullable()}).strict()),
 motion:z.array(z.object({id:z.string(),kind:z.literal('motion'),folder:z.string(),category:z.string(),reviewed:z.boolean()}).strict()),
 legacy:z.record(z.string(),z.string())}).strict();
export type ReferenceCatalog=z.infer<typeof catalogSchema>;

let cached:ReferenceCatalog|undefined;
export function referenceCatalog(){return cached??=catalogSchema.parse(JSON.parse(readFileSync(path.join(ROOT,'references/catalog.json'),'utf8')));}

export const styleSlug=(card:string)=>card.toLowerCase().replaceAll(' ','-');

/** Folder of a named card, e.g. "Red Signal" -> references/styles/red-signal. */
export function styleFolder(card:string){
 const style=referenceCatalog().styles.find(s=>s.name===card||s.id===styleSlug(card));
 if(!style)throw new Error('Unknown reference style: '+card);
 return style.folder;
}

/** Hash-pinned frames of a named card. */
export function styleFrames(card:string){
 const style=referenceCatalog().styles.find(s=>s.name===card||s.id===styleSlug(card));
 return style?style.frames:[];
}

/** Maps an older reference path (style library, numbered folders, output copies) to its kept frame. */
export function currentReferencePath(file:string){
 const normalized=file.replaceAll('\\','/').replace(/^output\/style-library\//,'references/style-library/');
 return referenceCatalog().legacy[normalized]??normalized;
}
