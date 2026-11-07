import {parseArgs} from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {referenceStyleIds,cardNameSchema} from '../engine/reference-motion-schema.js';
import {activeCardNames,assertActiveCard} from '../engine/reference-policy.js';
import {collectionCards,cardForReference} from '../engine/collection-cards.js';
import {referenceStyles} from '../engine/reference-styles.js';
import {planReference} from '../engine/reference-storyboard.js';
import {referenceEvidence,assetBoard,acceptReferenceReview} from '../engine/reference-production.js';
import {load} from '../engine/project.js';
const {values:v,positionals}=parseArgs({allowPositionals:true,options:{style:{type:'string'},project:{type:'string'},file:{type:'string'},out:{type:'string'}}});
async function main(){
 if(positionals[0]==='cards')return activeCardNames.map(name=>({name,default:name==='Blue Editorial',...collectionCards[name]}));
 if(positionals[0]==='list')return Object.values(referenceStyles).map(s=>({id:s.id,preset:'reference-'+s.id,name:s.name,folder:'references/styles/'+s.id}));
 const legacy=z.enum(referenceStyleIds).safeParse(v.style);
 const card=legacy.success?cardForReference(legacy.data):cardNameSchema.parse(v.style??'Blue Editorial');
 const chosenId=legacy.success?legacy.data:collectionCards[card].base;
 if(positionals[0]==='evidence')return referenceEvidence(chosenId,legacy.success?undefined:card);
 if(positionals[0]==='assets'){if(!v.project)throw new Error('--project required');return assetBoard(await load(v.project));}
 if(positionals[0]==='review'){if(!v.project||!v.file)throw new Error('--project and --file required');return acceptReferenceReview(await load(v.project),JSON.parse(await fs.readFile(v.file,'utf8')));}
 if(positionals[0]!=='plan')throw new Error('Use list, evidence --style style-N, assets --project ID, review --project ID --file REVIEW.json, or plan --style style-N --file SCRIPT.txt --out NEW.json');
 assertActiveCard(card);
 if(!v.file||!v.out)throw new Error('Exact UTF-8 script file and new output path required');
 const result=planReference(await fs.readFile(v.file,'utf8'),chosenId,card);
 for(const scene of result.request.scenes)scene.referenceMotion!.scoreFrames=Math.round(scene.duration*60);
 const destination=path.resolve(v.out);await fs.mkdir(path.dirname(destination),{recursive:true});
 await fs.writeFile(destination,JSON.stringify(result,null,2),{flag:'wx'});
 return {status:result.status,file:destination,scenes:result.request.scenes.length,next:'Complete the seven-section scene packet and resolve its registry before sourcing. Compile its isolated-asset queue, inspect the assembled stills, then pass the completed request to video:create.'};
}
main().then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(String(e));process.exitCode=1;});

