import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {recordSchema,type ReferenceRecord} from './model.js';
import {ROOT} from '../engine/config.js';
export function extractRecipes(input:ReferenceRecord){
 const record=recordSchema.parse(input);const review=record.review?.contentHash===record.contentHash?record.review:undefined;
 const rhythm=record.measurements?.cutCandidates.map((t,i,a)=>i?t-a[i-1]:t)||[];
 return (review?.techniques||[]).map(t=>{
 const evidence={source:record.source,referenceId:record.id,contentHash:record.contentHash,start:t.start,end:t.end};
 const recipe={version:1,evidence,motion:t.name,camera:review!.categories.includes('Camera Movements')?t.evidence:null,typography:review!.typography,transitions:review!.effects,easing:t.guidance?.easing??null,timing:{entranceSeconds:t.guidance?.entranceSeconds??null,observedCutIntervals:rhythm},layers:review!.composition,interactions:t.implementation,visualRhythm:record.measurements?.notes||[],presets:t.presets,guidance:t.guidance,confidence:Math.min(t.confidence,review!.confidence),confidenceBasis:'Minimum of reviewer and technique confidence; uncalibrated human assessment',approximate:true,limitations:[...review!.uncertainties,'Rendered footage does not establish exact keyframes, easing curves, camera or layer geometry.'],observation:t.evidence};
 return {id:'recipe-'+createHash('sha256').update(JSON.stringify(recipe)).digest('hex'),...recipe};
 });
}
export async function saveRecipes(record:ReferenceRecord,root=ROOT){const recipes=extractRecipes(record);const folder=path.join(root,'references/motion-library/_library/recipes');await fs.mkdir(folder,{recursive:true});for(const recipe of recipes)try{await fs.writeFile(path.join(folder,recipe.id+'.json'),JSON.stringify(recipe,null,2),{flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}return {recipes,blocker:recipes.length?null:'Hash-bound reviewed techniques required; automatic pixel changes are not motion semantics'};}
