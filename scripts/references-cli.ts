import {saveResearch} from '../motion-library/research.js';
import {parseArgs} from 'node:util';
import {updateLibrary,annotate,extractClip} from '../motion-library/library.js';
import {loadIndex,search} from '../motion-library/search.js';
const command=process.argv[2];
const {values:v}=parseArgs({args:process.argv.slice(3),options:{
 full:{type:'boolean'},query:{type:'string'},category:{type:'string'},id:{type:'string'},file:{type:'string'},start:{type:'string'},duration:{type:'string'},limit:{type:'string'},'reviewed-only':{type:'boolean'}
}});
async function main(){
 if(command==='source'){if(!v.file)throw new Error('source requires --file');return saveResearch(v.file);}
 if(command==='update')return updateLibrary({full:!!v.full});
 if(command==='search')return search(loadIndex(),v.query||'',{category:v.category,limit:v.limit?Number(v.limit):10,reviewedOnly:!!v['reviewed-only']}).map(({record:r,score,technique})=>({id:r.id,name:r.name,source:r.source,score,kind:r.review?.kind||r.automatic.kind,reviewed:!!r.review,categories:r.review?.categories||r.automatic.categories,description:r.review?.description||r.automatic.description,technique,contactSheet:r.contactSheet}));
 if(command==='show'){const entry=loadIndex().records.find(r=>r.id===v.id);if(!entry)throw new Error('Use --id with an indexed reference ID');return entry;}
 if(command==='annotate'){if(!v.id||!v.file)throw new Error('annotate requires --id and --file');return annotate(v.id,v.file);}
 if(command==='clip'){if(!v.id||v.start===undefined)throw new Error('clip requires --id and --start');return extractClip(v.id,Number(v.start),Number(v.duration||3));}
 if(command==='status'){const i=loadIndex();return {updatedAt:i.updatedAt,categories:i.categories.map(c=>({name:c,count:i.records.filter(r=>r.available&&(r.review?.categories||r.automatic.categories).includes(c)).length})),total:i.records.filter(r=>r.available).length,reviewed:i.records.filter(r=>r.available&&r.review).length,errors:i.records.filter(r=>r.status==='error').map(r=>({id:r.id,error:r.error}))};}
 throw new Error('Commands: update [--full], search --query WORDS [--category NAME] [--reviewed-only], show --id ID, annotate --id ID --file REVIEW.json, clip --id ID --start SECONDS [--duration 3], status');
}
main().then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(String(e));process.exitCode=1;});
