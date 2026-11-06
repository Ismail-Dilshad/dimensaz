import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {searchAssets} from './asset-intelligence.js';
import {z} from 'zod';
import {download,type Transport} from './asset-download.js';
import {libraryRecords,reusable,obtainAsset,type Submission,type LibraryRecord} from './asset-library.js';
import {assets,selectAsset,catalogIndex} from './asset-selector.js';
import {ROOT} from './config.js';
export const assetNeedSchema=z.object({scene:z.number().int().nonnegative(),query:z.string().min(1).max(100),tags:z.array(z.string()).min(1),style:z.string().default('minimal'),online:z.boolean().default(true)}).strict();
export type AssetNeed=z.infer<typeof assetNeedSchema>;
export type Candidate={submission:Submission;url:string;authorizedHosts:string[]};
export type Capabilities={
 discover?:(query:string)=>Promise<Candidate[]>;
 browserDownload?:(candidate:Candidate)=>Promise<Buffer>;
 generate?:(need:AssetNeed)=>Promise<{submission:Submission;bytes:Buffer}>;
 evaluate?:(candidates:Candidate[],need:AssetNeed)=>Promise<Candidate|undefined>;
};
// Official repository, pinned commit discovered through GitHub's public API.
// Whole license text is retained, including notices for Feather-derived icons.
async function discoverLucideUncached(query:string,transport?:Transport):Promise<Candidate[]>{
 const get=async(url:string)=>download(url,['api.github.com','raw.githubusercontent.com'],{limit:2*1024*1024,transport});
 const commit=JSON.parse((await get('https://api.github.com/repos/lucide-icons/lucide/commits/main')).bytes.toString()).sha;
 if(!/^[a-f0-9]{40}$/.test(commit))throw new Error('Invalid provider revision');
 const base='https://raw.githubusercontent.com/lucide-icons/lucide/'+commit;
 const tree=JSON.parse((await get('https://api.github.com/repos/lucide-icons/lucide/git/trees/'+commit)).bytes.toString());
 const icons=tree.tree?.find((e:{path:string;sha:string})=>e.path==='icons');
 if(!icons||!/^[a-f0-9]{40}$/.test(icons.sha))throw new Error('Provider icon tree missing');
 const iconTree=JSON.parse((await get('https://api.github.com/repos/lucide-icons/lucide/git/trees/'+icons.sha)).bytes.toString());
 if(iconTree.truncated)throw new Error('Provider listing truncated');
 const listing=iconTree.tree?.map((e:{path:string})=>({name:e.path}));
 if(!Array.isArray(listing))throw new Error('Invalid provider listing');
 const license=(await get(base+'/LICENSE')).bytes.toString();
 if(!license.includes('ISC License')||!license.includes('Permission to use, copy, modify'))throw new Error('Provider license changed; review required');
 const terms=query.toLowerCase().split(/\W+/).filter(Boolean);
 return listing.filter((a:{name?:string})=>a.name&&/^[a-z0-9-]+\.svg$/.test(a.name)&&terms.some(t=>a.name!.includes(t))).slice(0,8).map((a:{name:string})=>({url:base+'/icons/'+a.name,authorizedHosts:['raw.githubusercontent.com'],submission:{name:a.name.slice(0,-4),category:'icons',tags:a.name.slice(0,-4).split('-'),style:'minimal',format:'svg',provenance:{sourceWebsite:'https://lucide.dev',originalUrl:'https://github.com/lucide-icons/lucide/blob/'+commit+'/icons/'+a.name,creator:'Lucide contributors; derived Feather notices retained in license evidence',license:'ISC',licenseUrl:base+'/LICENSE',licenseEvidence:license,commercial:true,modification:true,attribution:'Retain the complete copyright and permission notices in licenseEvidence with distributed copies.',verified:true,origin:'internet',referenceIds:[]},evaluation:{reviewed:false,quality:0,relevance:0,styleConsistency:0,notes:'Candidate only. Agent must inspect visual quality, relevance, and style before automatic reuse.'}}}));
}
export async function sourceAsset(need:AssetNeed,capabilities:Capabilities={},root=ROOT){
 const entries=root===ROOT?await assets():libraryRecords(root).filter(reusable);
 const semantic=searchAssets(root===ROOT?await catalogIndex():libraryRecords(root),need.query+' '+need.tags.join(' ')).find(r=>reusable(r.asset)&&r.asset.style===need.style)?.asset;
 const local=semantic??selectAsset(entries.filter(a=>!('style' in a)||(a as LibraryRecord).style===need.style),need.tags);
 if(local)return {status:'ready' as const,asset:local,method:'local'};
 if(!need.online)return {status:'missing' as const,reason:'No suitable local asset'};
 let candidates:Candidate[]=[];const blockers:string[]=[];
 try{candidates=await (capabilities.discover??discoverLucide)(need.query);}catch(e){blockers.push(String(e));}
 const chosen=capabilities.evaluate?await capabilities.evaluate(candidates,need):undefined;
 if(chosen){
  if(!chosen.submission.evaluation.reviewed)throw new Error('Candidate evaluation must be reviewed');
  try{const result=await obtainAsset(chosen.submission,chosen.url,chosen.authorizedHosts,root);if(reusable(result.asset))return {status:'ready' as const,asset:result.asset,method:'download'};}
  catch(e){blockers.push(String(e)); // Browser adapter must use normal provider UI and stop for login/CAPTCHA.
   if(capabilities.browserDownload){const {registerAsset}=await import('./asset-library.js');const result=await registerAsset(chosen.submission,await capabilities.browserDownload(chosen),{root});if(reusable(result.asset))return {status:'ready' as const,asset:result.asset,method:'browser'};}
  }
 }
 if((!candidates.length||capabilities.evaluate)&&capabilities.generate){const {registerAsset}=await import('./asset-library.js');const generated=await capabilities.generate(need);if(generated.submission.provenance.origin!=='original')throw new Error('Generator must declare original provenance');const result=await registerAsset(generated.submission,generated.bytes,{root});if(reusable(result.asset))return {status:'ready' as const,asset:result.asset,method:'original'};}
 return {status:'review-needed' as const,candidates,blockers,capabilities:{browser:!!capabilities.browserDownload,generation:!!capabilities.generate,evaluation:!!capabilities.evaluate}};
}





export async function discoverLucide(query:string,transport?:Transport):Promise<Candidate[]>{
 if(transport)return discoverLucideUncached(query,transport);
 const key=createHash('sha256').update('lucide-v2:'+query.toLowerCase().trim()).digest('hex');const file=path.join(ROOT,'workspace/cache/asset-discovery',key+'.json');
 try{const cached=JSON.parse(await fs.readFile(file,'utf8'));if(Date.now()-cached.at<86400000&&Array.isArray(cached.results))return cached.results;}catch{}
 const results=await discoverLucideUncached(query);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify({at:Date.now(),results}));return results;
}

