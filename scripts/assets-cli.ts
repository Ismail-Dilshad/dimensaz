import {catalogIndex} from '../src/engine/asset-selector.js';
import {assessAsset,searchAssets,similarAssets} from '../src/engine/asset-intelligence.js';
import {stylePrompt,deriveStyle} from '../src/engine/style-dna.js';
import {load,list} from '../src/engine/project.js';
import {checkCompatibility} from '../src/engine/asset-compatibility.js';
import {saveRecipes} from '../src/motion-library/recipes.js';
import {parseArgs} from 'node:util';
import fs from 'node:fs/promises';
import {discoverLucide} from '../src/engine/asset-sourcing.js';
import {libraryRecords,registerAsset,obtainAsset,captureReference} from '../src/engine/asset-library.js';
const {values:v,positionals}=parseArgs({allowPositionals:true,options:{project:{type:'string'},id:{type:'string'},query:{type:'string'},manifest:{type:'string'},file:{type:'string'},url:{type:'string'},hosts:{type:'string'}}});
async function main(){
 const action=positionals[0];
 if(action==='list')return libraryRecords();
 const entries=await catalogIndex();
 if(action==='search'){const usage:Record<string,string[]>={};for(const p of await list())for(const a of p.assetLocks??[])(usage[a.id]??=[]).push(p.title);const p=v.project?await load(v.project):undefined;return searchAssets(entries,v.query??'',p?.styleDNA,usage).map(r=>({id:r.asset.id,score:r.score,matches:r.reasons,quality:r.quality}));}
 if(action==='style'){if(!v.project)throw new Error('Project required');const p=await load(v.project),profile=p.styleDNA??deriveStyle(p.config);return {profile,prompt:stylePrompt(profile)};}
 if(['assess','similar','check'].includes(action)){const a=entries.find(a=>a.id===v.id);if(!a)throw new Error('Asset ID not found');if(action==='assess')return assessAsset(a);if(action==='check')return checkCompatibility(a);if(!a.metrics)throw new Error('No visual signature; reimport as a new variant');return similarAssets(entries,a.metrics.signature).map(r=>({id:r.asset.id,distance:r.distance,method:r.method}));}
 if(action==='recipes'){if(!v.file)throw new Error('Reference record JSON required');return saveRecipes(JSON.parse(await fs.readFile(v.file,'utf8')));}
 if(action==='discover')return discoverLucide(v.query||'');
 if(!v.manifest)throw new Error('A metadata manifest is required');
 const metadata=JSON.parse(await fs.readFile(v.manifest,'utf8'));
 if(action==='download'){if(!v.url||!v.hosts)throw new Error('URL and authorized hosts required');return obtainAsset(metadata,v.url,v.hosts.split(','));}
 if(!v.file)throw new Error('Local file required');
 const bytes=await fs.readFile(v.file);
 if(action==='import')return registerAsset(metadata,bytes);
 if(action==='reference')return captureReference(metadata,bytes);
 throw new Error('Expected list, search, assess, similar, style, check, recipes, discover, download, import or reference');
}
main().then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(JSON.stringify({status:'failed',error:String(e)}));process.exitCode=1;});



