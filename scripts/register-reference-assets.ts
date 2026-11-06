import fs from 'node:fs/promises';
import path from 'node:path';
import {registerAsset} from '../engine/asset-library.js';
import {referenceStyles} from '../engine/reference-styles.js';
import {assessAsset,similarAssets} from '../engine/asset-intelligence.js';
import {libraryRecords} from '../engine/asset-library.js';
const folder=path.resolve('workspace/reference-production-assets');
const descriptions:Record<string,{subject:string;part:string;notes:string}>={
 'matte-phone':{subject:'blank white smartphone',part:'hero',notes:'Inspected on white, lavender and black. Pale blank screen, soft white edges; opposite tilt to reference requires authored rotation. No baked text.'},
 'pale-bubble':{subject:'empty round speech bubble',part:'message',notes:'Inspected on white, lavender and black. Pale center with cobalt rim, readable at mobile size. Small blue fringe remains at full scale; no generated text.'},
 'paper-plane':{subject:'folded white paper airplane',part:'message flight',notes:'Inspected on white, lavender and black. Legible folded wings; upper-right flight direction. Raster silhouette supports 2.5D flight, not true 3D banking.'},
 'blue-target':{subject:'blue white concentric target bullseye',part:'hero',notes:'Inspected on white, lavender and black. Near-frontal target, clean mobile silhouette. Small full-resolution fringe remains; use light styles only, no embedded dart.'},
 'blue-dart':{subject:'blue fin silver dart',part:'projectile',notes:'Inspected on white, lavender and black. Points lower-left, independent from target. Metallic barrel is more realistic than the softer reference; review scene scale.'},
 'phone':{subject:'glossy blue screen silver smartphone',part:'hero',notes:'Inspected on white, lavender and black. Metallic edges and dark bezel depart from matte reference; only for explicitly reviewed glossy compositions.'},
 'bubble':{subject:'glossy blue rectangular speech bubble',part:'message',notes:'Inspected on white, lavender and black. Saturated glossy blue center; use only where deep-blue material fits, not as the pale reference balloon.'},
};
const results:Record<string,unknown>={};
for(const [name,d] of Object.entries(descriptions)){
 const input={name:'Reference '+name,category:'objects-3d',format:'png',tags:[...name.split('-'),...d.subject.split(' '),'independent-layer','blue-white'],
 style:referenceStyles['style-1'].material,description:d.subject+'. '+d.notes,
 referenceIdentity:{styles:['style-1','style-2'],subject:d.subject,part:d.part,material:referenceStyles['style-1'].material,perspective:'fixed camera; inspect preview before combining',lighting:'soft upper-left studio',reviewNotes:d.notes},
 provenance:{sourceWebsite:'OpenAI image generation in this authorized project session',originalUrl:'https://openai.com/policies/row-terms-of-use/',creator:'OpenAI image generation, directed for this project',license:'OpenAI output terms; not CC0',licenseUrl:'https://openai.com/policies/row-terms-of-use/',licenseEvidence:'Generated on user instruction for this project, 2026-10-29/30. OpenAI terms Content section assigns Output to the user as between the parties to the extent permitted by law. Generic unbranded objects. No third-party asset copied; not a warranty of exclusive copyright.',commercial:true,modification:true,attribution:'',verified:true,origin:'original',referenceIds:['references/styles/custom-motion-shorts/style-1','references/styles/custom-motion-shorts/style-2']},
 evaluation:{reviewed:true,quality:.8,relevance:.9,styleConsistency:name==='phone'||name==='bubble'?.65:.85,notes:d.notes+' Ratings are editorial estimates, not measured similarity.'}};
 await fs.writeFile(path.join(folder,name+'.metadata.json'),JSON.stringify(input,null,2));
 const {asset,duplicate}=await registerAsset(input,await fs.readFile(path.join(folder,name+'.png')));
 results[name]={id:asset.id,path:asset.path,preview:asset.preview,hash:asset.hash,duplicate,checks:assessAsset(asset,{transparent:true}),similar:similarAssets(libraryRecords(),asset.metrics!.signature).slice(0,3).map(r=>({id:r.asset.id,distance:r.distance}))};
 console.log(name,asset.id);
}
await fs.writeFile(path.join(folder,'registered-assets.json'),JSON.stringify(results,null,2));
