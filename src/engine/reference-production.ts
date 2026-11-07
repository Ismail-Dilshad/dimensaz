import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {ROOT} from './config.js';
import {dir,writeJSON} from './project.js';
import {planReference} from './reference-storyboard.js';
import {referenceStyles} from './reference-styles.js';
import {collectionCards,layerPlanIssues,cardForReference} from './collection-cards.js';
import type {CardName} from './reference-motion-schema.js';
import {referenceStyleIds} from './reference-motion-schema.js';
import {referenceAssetPrompt,fidelityCriteria} from './reference-policy.js';
import {libraryRecords,reusable,recordSchema} from './asset-library.js';
import {searchAssets,assessAsset} from './asset-intelligence.js';
import {currentReferencePath,styleFolder,styleFrames} from './reference-catalog.js';
import type {Project} from './schema.js';

const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const currentAnchor=currentReferencePath;
function collectionAnchors(card:CardName){
 return styleFrames(card).map(f=>({path:f.path,sha256:f.sha256,subject:f.subject}));
}
export async function referenceEvidence(id:typeof referenceStyleIds[number],card?:CardName){
 if(card){
  const images=collectionAnchors(card);
  if(!images.length)throw new Error('Missing collection references for '+card);
  for(const f of images)if(hash(await fs.readFile(path.join(ROOT,f.path)))!==f.sha256)throw new Error('Collection reference changed: '+f.path);
  return {id,card,images,sources:images.map(({path,sha256})=>({path,sha256}))};
 }
 const catalog=JSON.parse(await fs.readFile(path.join(ROOT,'config/reference-evidence.json'),'utf8'));
 const evidence=catalog.styles[id];
 if(!evidence)throw new Error('Missing reference evidence '+id);
 for(const source of evidence.sources){
  if(hash(await fs.readFile(path.join(ROOT,source.path)))!==source.sha256)throw new Error('Reference evidence changed: '+source.path+'; inspect and update its inventory before production');
 }
 return evidence;
}
function realisticObject(record: z.infer<typeof recordSchema>) {
 return record.category === 'objects-3d' && !/\b(?:clay|claymorphism|flat|cutout)\b/i.test(record.style);
}
export async function assetBoard(p:Project, realisticOnly = false){
 const style=p.config.referenceStyle!;
 const evidence=await referenceEvidence(style.id,style.card);
 const storyboard=planReference(p.script,style.id);
 const records=libraryRecords().filter(record => !realisticOnly || realisticObject(record));
 const tasks=p.scenes.map((scene,i)=>{
  const subject=scene.referenceMotion?.metaphor??storyboard.tasks[i]?.source??scene.text;
  const candidates=searchAssets(records,subject,p.styleDNA).slice(0,6).map(r=>({id:r.asset.id,name:r.asset.name,preview:r.asset.preview,
   checks:assessAsset(r.asset),reviewed:r.asset.evaluation.reviewed,compatibleStyles:r.asset.referenceIdentity?.styles??[],
   note:'Candidate only: inspect subject, perspective, materials and edges before assigning.'}));
  return {scene:scene.id,source:scene.text,metaphor:subject,hero:scene.asset??null,parts:scene.referenceMotion?.layers??[],
   referenceFolder:styleFolder(style.card??cardForReference(style.id)),candidates,
   composition:style.card?{card:style.card,example:collectionCards[style.card].example,required:'Name the specific poster, hero, companion and relationship. Provide distinct asset IDs, depth, contact or separation, an action per layer, and staggered beat times in seconds.'}:undefined,
   generationPrompt:referenceAssetPrompt(style,subject,'hero object'),
   missing:['Choose a physical mechanism and its attachment points','Assign reviewed hero and moving-part asset IDs','Author part actions and composition','Inspect at mobile size'],
   acquisition:{order:['local-search-and-visual-review','agent-image-generation','verified-official-provider-download','user-download-handoff'],
    importCommand:'pnpm assets:library import --manifest METADATA.json --file ASSET.png',
    handoff:'If acquisition is blocked, provide the exact official asset page/file URL, format, license evidence and required part; never invent a download link.'}};
 });
 return {version:1,project:p.id,status:'asset-review',style,evidence,scenes:p.scenes,tasks,
  next:'Complete the scenes with reviewed separate assets, then resume the same job with --storyboard FILE.json. Supply {scenes:[...]} preserving exact source slices.'};
}
export function referenceAssetBlockers(p:Project, realisticOnly = false){
 if(!p.referenceWorkflow)return [];
 const records=libraryRecords(),blockers:string[]=[];
 const card=p.config.referenceStyle?.card;
 const anchors=new Set(card?collectionAnchors(card).map(f=>f.path):[]);
 for(const s of p.scenes){
  if(card)blockers.push(...layerPlanIssues(s).map(issue=>s.id+': '+issue));
  if(card&&(!s.referenceMotion?.evidence?.length||s.referenceMotion.evidence.some(f=>!anchors.has(currentAnchor(f)))))blockers.push(s.id+': cite a source anchor from the selected style card.');
  if(!s.asset||!s.referenceMotion||/^REQUIRED:/i.test(s.referenceMotion.metaphor)){blockers.push(s.id+': complete the physical storyboard and hero');continue;}
  for(const id of [s.asset,...s.referenceMotion.layers.map(l=>l.asset)]){
   const pinned=p.assetLocks?.find(a=>a.id===id);
   const snapshot=recordSchema.safeParse(pinned?.libraryEvidence);
   const record=pinned&&snapshot.success?snapshot.data:records.find(a=>a.id===id);
   if(!record){blockers.push(s.id+': import asset '+id+' with reviewed provenance');continue;}
   if(realisticOnly&&!realisticObject(record)){blockers.push(s.id+': '+id+' must be a reviewed realistic 3D object');continue;}
   if(pinned&&record.hash!==pinned.hash){blockers.push(s.id+': pinned evidence does not match asset bytes');continue;}
   const compatible=card?(record.style===card||collectionCards[card].compatible.some(i=>record.referenceIdentity?.styles.includes(i))):record.referenceIdentity?.styles.includes(p.config.referenceStyle!.id);
   if(!reusable(record)||!compatible)blockers.push(s.id+': '+id+' needs reviewed rights, reference style compatibility and identity metadata');
  }
 }
 return [...new Set(blockers)];
}
const assessment=z.object({criterion:z.enum(fidelityCriteria),result:z.enum(['pass','accepted-departure','fail']),notes:z.string().trim().min(12)}).strict();
export const referenceReviewSchema=z.object({version:z.literal(1),fingerprint:z.string().regex(/^[a-f0-9]{64}$/),reviewer:z.string().trim().min(1),
 referenceImages:z.array(z.string()).min(1),assessments:z.array(assessment).length(fidelityCriteria.length),
 limitations:z.array(z.string().min(1)),reviewed:z.literal(true)}).strict().superRefine((r,c)=>{
 if(new Set(r.assessments.map(a=>a.criterion)).size!==fidelityCriteria.length)c.addIssue({code:'custom',message:'Review each fidelity criterion exactly once'});
 if(r.assessments.some(a=>a.result==='fail'))c.addIssue({code:'custom',message:'Correct failed pilot criteria in a separate revision before expansion'});
 if(r.assessments.some(a=>a.result==='accepted-departure')&&!r.limitations.length)c.addIssue({code:'custom',message:'Disclose accepted departures in limitations'});
});
export async function acceptReferenceReview(p:Project,input:unknown){
 const r=referenceReviewSchema.parse(input);
 const {fingerprint}=await import('../renderer/render-controller.js');
 const pilot=JSON.parse(await fs.readFile(path.join(dir(p.id,p.config),'pilot.json'),'utf8'));
 if(pilot.fingerprint!==r.fingerprint||r.fingerprint!==await fingerprint(p))throw new Error('Pilot review is stale; inspect a fresh pilot');
 if(p.config.referenceStyle?.card&&(!pilot.layerQA||pilot.layerQA.failures.length))throw new Error('Fix the pilot layer bounds or headline collision before accepting it.');
 const evidence=await referenceEvidence(p.config.referenceStyle!.id,p.config.referenceStyle!.card);
 if(r.referenceImages.some(file=>!evidence.images.some((i:{path:string})=>i.path===currentAnchor(file))))throw new Error('Pilot review must name actual images from the selected reference folder');
 await writeJSON(path.join(dir(p.id,p.config),'reference-review.json'),{...r,acceptedAt:new Date().toISOString(),referenceSources:evidence.sources});
 return r;
}
export async function assertReferenceReview(p:Project,currentFingerprint:string){
 if(!p.referenceWorkflow)return;
 const blockers=referenceAssetBlockers(p);if(blockers.length)throw new Error(blockers.join('; '));
 const stored=JSON.parse(await fs.readFile(path.join(dir(p.id,p.config),'reference-review.json'),'utf8'));
 const {acceptedAt,referenceSources,...input}=stored;
 if(typeof acceptedAt!=='string'||!Array.isArray(referenceSources))throw new Error('Missing pilot acceptance evidence');
 const r=referenceReviewSchema.parse(input);
 if(r.fingerprint!==currentFingerprint)throw new Error('Reference pilot review is stale; inspect and review the changed project before rendering');
 const evidence=await referenceEvidence(p.config.referenceStyle!.id,p.config.referenceStyle!.card);
 const normalizedSources=referenceSources.map(source=>({...source,path:typeof source?.path==='string'?currentAnchor(source.path):null}));
 if(JSON.stringify(normalizedSources)!==JSON.stringify(evidence.sources))throw new Error('Reviewed reference sources changed; inspect a fresh pilot');
 if(r.referenceImages.some(file=>!evidence.images.some((i:{path:string})=>i.path===currentAnchor(file))))throw new Error('Review references do not belong to the selected style');
}
